import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// What the shipping rules answer for the address under test.
const shipping = vi.hoisted(() => ({ result: { shippingEnabled: true, rates: [] } }));
vi.mock("@/services/shipping/ShippingService", () => ({
  shippingService: { getRatesForAddress: vi.fn(async () => shipping.result) },
}));

// The public routes are called directly: no real captcha, rate limit, session or Stripe.
vi.mock("next-auth", () => ({ default: () => () => {}, getServerSession: () => Promise.resolve(null) }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstileToken: async () => ({ success: true }) }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: async () => ({ success: true }), getClientIp: () => "203.0.113.9" }));
vi.mock("@/lib/stripe", () => ({ default: { paymentIntents: { create: vi.fn(), update: vi.fn() } } }));

import Product from "@/models/Product";
import Order from "@/models/Order";
import {
  assertValidCartItems,
  computeAuthoritativeCheckout,
  resolveAuthoritativeShippingCost,
  MAX_LINE_QUANTITY,
  MAX_CART_LINES,
} from "@/lib/checkoutPricing";
import stripe from "@/lib/stripe";

const TAG = `qty${Date.now()}`;
const ADDRESS = { fullName: "Forger Test", street: "1 Test Street", city: "Austin", country: "United States", countryCode: "US", zip: "73301" };
const line = (product, quantity, extra = {}) => ({ id: product._id.toString(), name: product.name, price: product.price, quantity, ...extra });

describe("assertValidCartItems", () => {
  const ok = { id: "507f1f77bcf86cd799439011", name: "Jacket", quantity: 1 };

  it("accepts whole quantities from 1 up to the limit", () => {
    for (const quantity of [1, 2, 10, MAX_LINE_QUANTITY]) expect(() => assertValidCartItems([{ ...ok, quantity }])).not.toThrow();
  });

  it.each([
    ["negative", -1],
    ["zero", 0],
    ["fractional", 1.5],
    ["a numeric string", "2"],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["null", null],
    ["missing", undefined],
    ["over the limit", MAX_LINE_QUANTITY + 1],
  ])("rejects a quantity that is %s", (_label, quantity) => {
    expect(() => assertValidCartItems([{ ...ok, quantity }])).toThrow(/Invalid quantity/);
  });

  it("rejects an empty, missing or oversized cart and names the offending line", () => {
    expect(() => assertValidCartItems([])).toThrow(/empty/i);
    expect(() => assertValidCartItems(undefined)).toThrow(/empty/i);
    expect(() => assertValidCartItems("jacket")).toThrow(/empty/i);
    expect(() => assertValidCartItems(Array.from({ length: MAX_CART_LINES + 1 }, () => ok))).toThrow(/too many/i);
    expect(() => assertValidCartItems([ok, { ...ok, name: "Gloves", quantity: -3 }])).toThrow(/"Gloves"/);
    expect(() => assertValidCartItems([null])).toThrow(/Invalid quantity/);
  });
});

describe("resolveAuthoritativeShippingCost: the 'free' placeholders are never honoured when real rates exist", () => {
  const args = (methodId) => ({ shippingAddress: ADDRESS, shippingSnapshot: { methodId }, subtotal: 100, items: [] });

  it("does not give free shipping for 'free-delivery' or 'free-order'", async () => {
    shipping.result = { shippingEnabled: true, rates: [{ methodId: "665f1c2a9b1e8a0012345678", cost: 15 }] };
    await expect(resolveAuthoritativeShippingCost(args("free-delivery"))).rejects.toThrow(/no longer available/);
    await expect(resolveAuthoritativeShippingCost(args("free-order"))).rejects.toThrow(/no longer \$0/);
    await expect(resolveAuthoritativeShippingCost(args(undefined))).rejects.toThrow(/no longer available/);
  });

  it("still charges the real rate the shopper picked", async () => {
    shipping.result = { shippingEnabled: true, rates: [{ methodId: "665f1c2a9b1e8a0012345678", cost: 15 }, { methodId: "665f1c2a9b1e8a0012345679", cost: 0 }] };
    expect(await resolveAuthoritativeShippingCost(args("665f1c2a9b1e8a0012345678"))).toBe(15);
    expect(await resolveAuthoritativeShippingCost(args("665f1c2a9b1e8a0012345679"))).toBe(0);
  });

  it("is free when shipping is switched off or the address has no rates at all", async () => {
    shipping.result = { shippingEnabled: false, rates: [{ methodId: "free-delivery", cost: 0 }] };
    expect(await resolveAuthoritativeShippingCost(args("free-delivery"))).toBe(0);
    shipping.result = { shippingEnabled: true, rates: [] };
    expect(await resolveAuthoritativeShippingCost(args("anything"))).toBe(0);
  });
});

describe("forged carts are rejected before anything is created, charged or taken out of stock", () => {
  let jacket;
  let gloves;
  const orderKeys = [];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pairo");
    const base = 7_000_000 + Math.floor(Math.random() * 900_000);
    jacket = await Product.create({ id: base, name: `Qty Test Jacket ${TAG}`, slug: `qty-jacket-${TAG}`, price: 100, manageStock: true, stock: 5, status: "Published" });
    gloves = await Product.create({ id: base + 1, name: `Qty Test Gloves ${TAG}`, slug: `qty-gloves-${TAG}`, price: 40, manageStock: true, stock: 5, status: "Published" });
  });

  afterAll(async () => {
    await Order.deleteMany({ idempotencyKey: { $in: orderKeys } });
    await Product.deleteMany({ slug: { $regex: TAG } });
    await mongoose.connection.close();
  });

  const price = (items) => computeAuthoritativeCheckout({ items, financials: {}, shippingAddress: null, dryRun: true });

  it("prices a normal cart from the database, whatever price the request claims", async () => {
    const result = await price([line(jacket, 2, { price: 1 }), line(gloves, 1, { price: 0.01 })]);
    expect(result.authoritativeSubtotal).toBe(240);
    expect(result.authoritativeTotal).toBe(240);
  });

  it("the exploit: one jacket plus a second line at quantity -1 can no longer make the order free", async () => {
    await expect(price([line(jacket, 1), line(jacket, -1)])).rejects.toThrow(/Invalid quantity/);
    await expect(price([line(jacket, 1), line(gloves, -1)])).rejects.toThrow(/Invalid quantity/);
    await expect(price([line(jacket, 0)])).rejects.toThrow(/Invalid quantity/);
    await expect(price([line(jacket, 1.5)])).rejects.toThrow(/Invalid quantity/);
    await expect(price([])).rejects.toThrow(/empty/i);
  });

  it("a made-up line with a negative price can no longer cancel out real ones", async () => {
    const ghost = { id: new mongoose.Types.ObjectId().toString(), name: "Ghost jacket", price: -99.5, quantity: 1 };
    await expect(price([line(jacket, 1), ghost])).rejects.toThrow(/no longer available/);
  });

  it("POST /api/checkout refuses the forged cart: no order, no stock change", async () => {
    const { POST } = await import("@/app/api/checkout/route");
    const idempotencyKey = `${TAG}-cod`;
    orderKeys.push(idempotencyKey);
    const body = {
      turnstileToken: "test",
      idempotencyKey,
      customerEmail: `${TAG}@example.invalid`,
      shippingAddress: ADDRESS,
      financials: {},
      items: [line(jacket, 1), line(gloves, -1)],
    };
    const res = await POST(new Request("http://localhost/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid quantity/);
    expect(await Order.countDocuments({ idempotencyKey })).toBe(0);
    const [j, g] = await Promise.all([Product.findById(jacket._id).lean(), Product.findById(gloves._id).lean()]);
    expect([j.stock, g.stock]).toEqual([5, 5]);
  });

  it("POST /api/checkout refuses an empty cart instead of creating an item-less $0 order", async () => {
    const { POST } = await import("@/app/api/checkout/route");
    const idempotencyKey = `${TAG}-empty`;
    orderKeys.push(idempotencyKey);
    const res = await POST(new Request("http://localhost/api/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnstileToken: "test", idempotencyKey, customerEmail: `${TAG}@example.invalid`, shippingAddress: ADDRESS, financials: {}, items: [] }),
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/empty/i);
    expect(await Order.countDocuments({ idempotencyKey })).toBe(0);
  });

  it("a normal cart still gets a card PaymentIntent for exactly the right amount", async () => {
    const { POST } = await import("@/app/api/checkout/create-payment-intent/route");
    const PendingCheckout = (await import("@/models/PendingCheckout")).default;
    stripe.paymentIntents.create.mockClear();
    stripe.paymentIntents.create.mockResolvedValueOnce({ id: `pi_${TAG}`, client_secret: `secret_${TAG}` });
    const idempotencyKey = `${TAG}-happy`;
    try {
      const res = await POST(new Request("http://localhost/api/checkout/create-payment-intent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey, customerEmail: `${TAG}@example.invalid`, shippingAddress: ADDRESS, financials: {}, items: [line(jacket, 2, { price: 1 }), line(gloves, 1)] }),
      }));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ success: true, clientSecret: `secret_${TAG}`, amount: 240 });
      expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
      expect(stripe.paymentIntents.create.mock.calls[0][0]).toMatchObject({ amount: 24000, currency: "usd" });
    } finally {
      await PendingCheckout.deleteMany({ idempotencyKey });
    }
  });

  it("POST /api/checkout/create-payment-intent refuses the forged cart before Stripe is contacted", async () => {
    const { POST } = await import("@/app/api/checkout/create-payment-intent/route");
    stripe.paymentIntents.create.mockClear();
    stripe.paymentIntents.update.mockClear();
    const res = await POST(new Request("http://localhost/api/checkout/create-payment-intent", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: `${TAG}-card`, customerEmail: `${TAG}@example.invalid`, shippingAddress: ADDRESS, financials: {},
        items: [line(jacket, 1), line(jacket, -1)],
      }),
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid quantity/);
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.update).not.toHaveBeenCalled();
  });
});
