import { describe, it, expect, vi, beforeEach } from "vitest";

// Pure unit tests: no database. The product lookup, the promotion engine and the shipping rules are stubbed.
const stub = vi.hoisted(() => ({
  products: [],
  engine: { appliedPromotions: [], discountTotal: 0, freeShipping: false },
  shipping: { shippingEnabled: true, rates: [] },
}));

vi.mock("@/models/Product", () => ({
  default: { find: () => ({ select: async () => stub.products }) },
}));
vi.mock("@/lib/promotionEngine/Engine", () => ({
  default: { evaluate: vi.fn(async () => stub.engine) },
}));
vi.mock("@/services/shipping/ShippingService", () => ({
  shippingService: { getRatesForAddress: vi.fn(async () => stub.shipping) },
}));

import { computeAuthoritativeCheckout, getMissingAttributeError } from "@/lib/checkoutPricing";

const ADDRESS = { fullName: "Test Buyer", street: "1 Test Street", city: "Austin", country: "United States", countryCode: "US" };
const RATE_ID = "665f1c2a9b1e8a0012345678";
const PRODUCT_ID = "507f1f77bcf86cd799439011";
const product = { _id: { toString: () => PRODUCT_ID }, name: "Jacket", price: 100 };
const item = { id: PRODUCT_ID, name: "Jacket", quantity: 1 };

describe("computeAuthoritativeCheckout: free-shipping promotions", () => {
  beforeEach(() => {
    stub.products = [product];
    stub.engine = { appliedPromotions: [], discountTotal: 0, freeShipping: false };
    stub.shipping = { shippingEnabled: true, rates: [{ methodId: RATE_ID, cost: 15 }] };
  });

  const price = (shippingSnapshot = { methodId: RATE_ID }) =>
    computeAuthoritativeCheckout({ items: [item], financials: {}, shippingAddress: ADDRESS, shippingSnapshot, dryRun: true });

  it("charges the matched rate when no free-shipping promotion applies", async () => {
    const result = await price();
    expect(result.freeShipping).toBe(false);
    expect(result.authoritativeShippingCost).toBe(15);
    expect(result.authoritativeTotal).toBe(115);
  });

  it("charges no shipping when a promotion grants free shipping, and the total follows", async () => {
    stub.engine = { appliedPromotions: [], discountTotal: 0, freeShipping: true };
    const result = await price();
    expect(result.freeShipping).toBe(true);
    expect(result.authoritativeShippingCost).toBe(0);
    expect(result.authoritativeTotal).toBe(100);
  });

  it("still refuses a shipping method that is not one of the real rates", async () => {
    stub.engine = { appliedPromotions: [], discountTotal: 0, freeShipping: true };
    await expect(price({ methodId: "free-delivery" })).rejects.toThrow(/no longer available/);
  });
});

describe("getMissingAttributeError", () => {
  const jacket = {
    name: "Jacket",
    productType: "variable",
    attributes: [{ name: "Size" }, { name: "Color" }],
  };

  it("requires every attribute on a variable product", () => {
    expect(getMissingAttributeError({ selectedOptions: { Size: "M" } }, jacket)).toMatch(/select Color for "Jacket"/);
    expect(getMissingAttributeError({}, jacket)).toMatch(/select Size and Color/);
    expect(getMissingAttributeError({ selectedOptions: { Size: "M", Color: "Black" } }, jacket)).toBeNull();
  });

  it("made-to-measure skips Size only: Color is still required", () => {
    const m2m = { madeToMeasure: { enabled: true } };
    expect(getMissingAttributeError({ ...m2m, selectedOptions: {} }, jacket)).toMatch(/select Color/);
    expect(getMissingAttributeError({ ...m2m, selectedOptions: { Color: "Black" } }, jacket)).toBeNull();
  });

  it("does not apply to simple products or corporate gifting lines", () => {
    expect(getMissingAttributeError({}, { name: "Socks", productType: "simple", attributes: [] })).toBeNull();
    expect(getMissingAttributeError({ corporateGifting: { enabled: true } }, jacket)).toBeNull();
  });
});
