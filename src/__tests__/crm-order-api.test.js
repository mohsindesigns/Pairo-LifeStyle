import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config({ path: ".env.local" });
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

vi.mock("@/lib/events", () => ({ default: { dispatch: vi.fn(), on: vi.fn() } }));

import Order from "@/models/Order";
import Product from "@/models/Product";
import pairoEvents from "@/lib/events";
import { ensureOrderCounter } from "@/lib/orderNumber";
import { dispatchOrderToCRM } from "@/lib/crmWebhook";

const TAG = `crmapi${Date.now()}`;
const KEY = "test-crm-key-123";
let product, draft;

const call = async (path, method, body, key = KEY) => {
  const route = path.startsWith("/products")
    ? await import("@/app/api/crm/products/route")
    : path.split("?")[0] === "/orders" ? await import("@/app/api/crm/orders/route") : await import("@/app/api/crm/orders/[orderNumber]/route");
  const url = `http://localhost/api/crm${path}`;
  const req = new Request(url, { method, headers: { "Content-Type": "application/json", ...(key ? { "x-api-key": key } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const ctx = { params: Promise.resolve({ orderNumber: decodeURIComponent(path.split("/")[2] || "") }) };
  const res = await route[method](req, ctx);
  return { status: res.status, json: await res.json() };
};

const base = (extra = {}) => ({
  externalId: `${TAG}-${Math.random().toString(36).slice(2, 8)}`,
  customer: { email: `buyer-${TAG}@example.invalid`, name: "Buyer", phone: "+15550001" },
  shippingAddress: { fullName: "Buyer One", street: "1 Main St", city: "Austin", country: "United States" },
  items: [{ productId: String(product._id), quantity: 2 }],
  ...extra,
});
const stockNow = async () => (await Product.findById(product._id).lean()).stock;
const events = () => vi.mocked(pairoEvents.dispatch).mock.calls.map((c) => c[0]);

beforeAll(async () => {
  process.env.CRM_API_KEY = KEY;
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pairo");
  await ensureOrderCounter();
  product = await Product.create({ id: 4_000_000 + Math.floor(Math.random() * 900_000), name: `CRM Jacket ${TAG}`, slug: `crm-jacket-${TAG}`, sku: `SKU-${TAG}`, price: 120, stock: 100, manageStock: true, status: "Published" });
  draft = await Product.create({ id: 4_900_000 + Math.floor(Math.random() * 90_000), name: `CRM Draft ${TAG}`, slug: `crm-draft-${TAG}`, price: 50, stock: 5, status: "Draft" });
});
afterAll(async () => {
  delete process.env.CRM_API_KEY;
  await Order.deleteMany({ idempotencyKey: { $regex: TAG } });
  await Product.deleteMany({ slug: { $regex: TAG } });
  await mongoose.connection.close();
});
beforeEach(() => vi.mocked(pairoEvents.dispatch).mockClear());

describe("CRM order API: access", () => {
  it("refuses a missing or wrong key on every method", async () => {
    expect((await call("/orders", "GET", null, null)).status).toBe(401);
    expect((await call("/orders", "POST", base(), "nope")).status).toBe(401);
    expect((await call("/orders/PL-1", "PATCH", { status: "Shipped" }, "nope")).status).toBe(401);
    expect((await call("/orders/PL-1", "DELETE", null, "nope")).status).toBe(401);
    expect((await call("/products", "GET", null, "nope")).status).toBe(401);
  });
});

describe("POST /api/crm/orders", () => {
  it("creates an order, takes stock, is safe to retry", async () => {
    const before = await stockNow();
    const body = base({ shippingCost: 10, note: "gift" });
    const first = await call("/orders", "POST", body);
    expect(first.status).toBe(201);
    expect(first.json).toMatchObject({ success: true, duplicate: false });
    const o = first.json.order;
    expect(o.status).toBe("Confirmed");
    expect(o.financials).toMatchObject({ subtotal: 240, shippingCost: 10, total: 250 });
    expect(o.payment).toMatchObject({ method: "Manual/Gift", status: "Paid" });
    expect(o.timeline[0].message).toMatch(/created from CRM/);
    expect(await stockNow()).toBe(before - 2);
    expect(vi.mocked(pairoEvents.dispatch)).toHaveBeenCalledWith("ORDER_CREATED", expect.objectContaining({ origin: "crm", skipEmails: true }));

    const again = await call("/orders", "POST", body);
    expect(again.status).toBe(200);
    expect(again.json).toMatchObject({ success: true, duplicate: true });
    expect(again.json.order.orderNumber).toBe(o.orderNumber);
    expect(await stockNow()).toBe(before - 2); // no second deduction
  });

  it("creates by sku and honours priceOverride", async () => {
    const res = await call("/orders", "POST", base({ items: [{ sku: `SKU-${TAG}`, quantity: 1, priceOverride: 99 }] }));
    expect(res.status).toBe(201);
    expect(res.json.order.items[0]).toMatchObject({ priceAtPurchase: 99, quantity: 1 });
  });

  it("rejects bad input with 400 and a field name", async () => {
    const cases = [
      [{ externalId: undefined }, "externalId"],
      [{ customer: { email: "nope" } }, "customer.email"],
      [{ shippingAddress: { fullName: "A" } }, "shippingAddress.street"],
      [{ items: [] }, "items"],
      [{ items: [{ productId: String(product._id), quantity: 0 }] }, "items[0].quantity"],
      [{ items: [{ productId: String(product._id), quantity: 1.5 }] }, "items[0].quantity"],
      [{ status: "Weird" }, "status"],
      [{ payment: { method: "Bitcoin" } }, "payment.method"],
      [{ shippingCost: -1 }, "shippingCost"],
    ];
    for (const [patch, field] of cases) {
      const res = await call("/orders", "POST", { ...base(), ...patch });
      expect(res.status, field).toBe(400);
      expect(res.json).toMatchObject({ success: false, field });
    }
  });

  it("rejects unknown, draft products, and short stock (without losing stock)", async () => {
    expect((await call("/orders", "POST", base({ items: [{ sku: "NOPE-" + TAG, quantity: 1 }] }))).status).toBe(400);
    const d = await call("/orders", "POST", base({ items: [{ productId: String(draft._id), quantity: 1 }] }));
    expect(d.status).toBe(400);
    expect(d.json.error).toMatch(/draft/i);
    const before = await stockNow();
    const big = await call("/orders", "POST", base({ items: [{ productId: String(product._id), quantity: 999 }] }));
    expect(big.status).toBe(409);
    expect(await stockNow()).toBe(before);
  });
});

describe("PATCH /api/crm/orders/{orderNumber}", () => {
  let order;
  beforeAll(async () => { order = (await call("/orders", "POST", base())).json.order; });

  it("changes status, tracking, payment, address and notes, and says what changed", async () => {
    const res = await call(`/orders/${order.orderNumber}`, "PATCH", {
      status: "Shipped", trackingNumber: "TRK1", carrier: "DHL", trackingUrl: "https://dhl.example/TRK1",
      paymentStatus: "Pending", shippingAddress: { city: "Dallas", bogus: "x" }, customerNote: "ring bell", adminNote: "packed",
    });
    expect(res.status).toBe(200);
    expect(res.json.changed.sort()).toEqual(["adminNote", "customerNote", "paymentStatus", "shippingAddress", "status", "tracking"]);
    const o = res.json.order;
    expect(o).toMatchObject({ status: "Shipped", trackingNumber: "TRK1", carrier: "DHL", paymentStatus: "Pending" });
    expect(o.tracking.url).toBe("https://dhl.example/TRK1");
    expect(o.shippingAddress.city).toBe("Dallas");
    expect(o.shippingAddress.street).toBe("1 Main St"); // partial merge keeps the rest
    expect(o.shippingAddress.bogus).toBeUndefined();
    expect(events()).toEqual(expect.arrayContaining(["ORDER_STATUS_UPDATED", "ORDER_PAYMENT_UPDATED", "ORDER_UPDATED"]));
    expect(vi.mocked(pairoEvents.dispatch).mock.calls.every((c) => c[1].origin === "crm")).toBe(true);
    order = o;
  });

  it("marks paid with a paid date, and does nothing when nothing changed", async () => {
    const paid = await call(`/orders/${order.orderNumber}`, "PATCH", { paymentStatus: "Paid" });
    expect(paid.json.order.payment.paidAt).toBeTruthy();
    vi.mocked(pairoEvents.dispatch).mockClear();
    const same = await call(`/orders/${order.orderNumber}`, "PATCH", { status: "Shipped" });
    expect(same.status).toBe(200);
    expect(same.json.changed).toEqual([]);
    expect(events()).toEqual([]);
  });

  it("refuses an invalid status / payment status and a missing order", async () => {
    const bad = await call(`/orders/${order.orderNumber}`, "PATCH", { status: "Lost" });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toContain("Pending, Confirmed");
    expect((await call(`/orders/${order.orderNumber}`, "PATCH", { paymentStatus: "Maybe" })).status).toBe(400);
    expect((await call(`/orders/PL-NOPE-${TAG}`, "PATCH", { status: "Shipped" })).status).toBe(404);
  });

  it("detects a stale write with expectedUpdatedAt", async () => {
    const cur = (await call(`/orders/${order.orderNumber}`, "GET")).json.order;
    const stale = await call(`/orders/${order.orderNumber}`, "PATCH", { status: "Delivered", expectedUpdatedAt: "2000-01-01T00:00:00Z" });
    expect(stale.status).toBe(409);
    expect(stale.json).toMatchObject({ success: false, error: "conflict" });
    expect(new Date(stale.json.currentUpdatedAt).getTime()).toBe(new Date(cur.updatedAt).getTime());
    const ok = await call(`/orders/${order.orderNumber}`, "PATCH", { status: "Delivered", expectedUpdatedAt: cur.updatedAt });
    expect(ok.status).toBe(200);
    expect(ok.json.order.status).toBe("Delivered");
  });

  it("puts stock back once on Cancelled, takes it again if reactivated", async () => {
    const created = (await call("/orders", "POST", base())).json.order;
    const afterCreate = await stockNow();
    expect((await call(`/orders/${created.orderNumber}`, "PATCH", { status: "Cancelled" })).status).toBe(200);
    expect(await stockNow()).toBe(afterCreate + 2);
    await call(`/orders/${created.orderNumber}`, "PATCH", { status: "Refunded" }); // already inactive: no second restock
    expect(await stockNow()).toBe(afterCreate + 2);
    const back = await call(`/orders/${created.orderNumber}`, "PATCH", { status: "Confirmed" });
    expect(back.status).toBe(200);
    expect(await stockNow()).toBe(afterCreate);
  });
});

describe("DELETE, restore, GET and sync", () => {
  it("soft-deletes (idempotent), hides, restores", async () => {
    const o = (await call("/orders", "POST", base())).json.order;
    const del = await call(`/orders/${o.orderNumber}`, "DELETE");
    expect(del.status).toBe(200);
    expect(del.json).toMatchObject({ success: true, alreadyDeleted: false });
    expect(del.json.order.isDeleted).toBe(true);
    expect(events()).toContain("ORDER_DELETED");
    expect(await Order.exists({ orderNumber: o.orderNumber })).toBeTruthy(); // never really removed

    expect((await call(`/orders/${o.orderNumber}`, "DELETE")).json.alreadyDeleted).toBe(true);
    expect((await call(`/orders/${o.orderNumber}`, "PATCH", { status: "Shipped" })).status).toBe(404); // trashed
    const hidden = await call(`/orders?orderNumber=${o.orderNumber}`, "GET");
    expect(hidden.json.orders.find((x) => x.orderNumber === o.orderNumber)).toBeUndefined();

    const rest = await call(`/orders/${o.orderNumber}`, "PATCH", { restore: true });
    expect(rest.status).toBe(200);
    expect(rest.json.order.isDeleted).toBe(false);
    expect(events()).toContain("ORDER_RESTORED");
  });

  it("lists orders (with trashed ones on request) and finds products by sku", async () => {
    const o = (await call("/orders", "POST", base())).json.order;
    await call(`/orders/${o.orderNumber}`, "DELETE");
    const withTrash = await (async () => {
      const { GET } = await import("@/app/api/crm/orders/route");
      const res = await GET(new Request(`http://localhost/api/crm/orders?includeDeleted=true&orderNumber=${o.orderNumber}`, { headers: { "x-api-key": KEY } }));
      return res.json();
    })();
    expect(withTrash.orders[0]).toMatchObject({ orderNumber: o.orderNumber, isDeleted: true });

    const found = await (async () => {
      const { GET } = await import("@/app/api/crm/products/route");
      return (await GET(new Request(`http://localhost/api/crm/products?sku=SKU-${TAG}`, { headers: { "x-api-key": KEY } }))).json();
    })();
    expect(found.products).toHaveLength(1);
    expect(found.products[0]).toMatchObject({ name: `CRM Jacket ${TAG}`, sku: `SKU-${TAG}`, price: 120, manageStock: true });
  });

  it("the /api/orders alias exposes the same handlers", async () => {
    const a = await import("@/app/api/orders/route");
    const c = await import("@/app/api/crm/orders/route");
    expect([a.GET, a.POST, a.PATCH, a.OPTIONS]).toEqual([c.GET, c.POST, c.PATCH, c.OPTIONS]);
    const ai = await import("@/app/api/orders/[orderNumber]/route");
    const ci = await import("@/app/api/crm/orders/[orderNumber]/route");
    expect([ai.GET, ai.PATCH, ai.DELETE]).toEqual([ci.GET, ci.PATCH, ci.DELETE]);
  });
});

describe("webhook payload", () => {
  it("carries a delivery id, the origin, tracking and isDeleted, signed over the raw body", async () => {
    process.env.CRM_WEBHOOK_URL = "https://crm.example.invalid/hook";
    process.env.CRM_WEBHOOK_SECRET = "whsec";
    const sent = [];
    const realFetch = global.fetch;
    global.fetch = vi.fn(async (url, init) => { sent.push(init); return { ok: true, status: 200 }; });
    try {
      await dispatchOrderToCRM("ORDER_UPDATED", { _id: "660000000000000000000001", orderNumber: "PL-7", status: "Shipped", isDeleted: false, tracking: { number: "T1", carrier: "DHL" }, items: [] }, { origin: "crm", extra: { fields: ["tracking"] } });
      await new Promise((r) => setTimeout(r, 50));
      expect(sent).toHaveLength(1);
      const { headers, body } = sent[0];
      const payload = JSON.parse(body);
      expect(payload).toMatchObject({ event: "ORDER_UPDATED", origin: "crm" });
      expect(payload.id).toBe(headers["X-Pairo-Delivery"]);
      expect(payload.data).toMatchObject({ orderNumber: "PL-7", isDeleted: false, fields: ["tracking"], tracking: { number: "T1", carrier: "DHL" } });
      expect(headers["X-Pairo-Signature"]).toBe("sha256=" + crypto.createHmac("sha256", "whsec").update(body).digest("hex"));
    } finally {
      global.fetch = realFetch;
      delete process.env.CRM_WEBHOOK_URL;
      delete process.env.CRM_WEBHOOK_SECRET;
    }
  });
});
