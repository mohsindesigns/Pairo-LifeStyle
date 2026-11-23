import { describe, it, expect } from "vitest";
import { normalizeMethodSettings } from "@/app/admin/settings/shipping/methodSettings";
import FreeShippingProvider from "@/services/shipping/providers/FreeShippingProvider";
import FlatRateProvider from "@/services/shipping/providers/FlatRateProvider";

describe("normalizeMethodSettings", () => {
  it("requires a flat-rate cost instead of saving 0 for a blank field", () => {
    expect(normalizeMethodSettings("FLAT_RATE", { cost: "" }).error).toMatch(/required/);
    expect(normalizeMethodSettings("FLAT_RATE", {}).error).toMatch(/required/);
  });

  it("converts numeric strings and keeps a real 0", () => {
    expect(normalizeMethodSettings("FLAT_RATE", { cost: "12.5" }).settings).toEqual({ cost: 12.5 });
    expect(normalizeMethodSettings("FLAT_RATE", { cost: "0" }).settings).toEqual({ cost: 0 });
    expect(normalizeMethodSettings("FLAT_RATE", { cost: 7 }).settings).toEqual({ cost: 7 });
  });

  it("rejects non-numbers and negatives", () => {
    expect(normalizeMethodSettings("FLAT_RATE", { cost: "abc" }).error).toMatch(/number/);
    expect(normalizeMethodSettings("LOCAL_PICKUP", { cost: "-1" }).error).toMatch(/negative/);
  });

  it("omits blank optional fields and leaves other settings alone", () => {
    const { settings } = normalizeMethodSettings("FREE_SHIPPING", { minimumOrderAmount: "", fallbackCost: " ", note: "x" });
    expect(settings).toEqual({ note: "x" });
    const pickup = normalizeMethodSettings("LOCAL_PICKUP", { cost: "", pickupLocationId: "abc" }).settings;
    expect(pickup).toEqual({ pickupLocationId: "abc" });
  });

  it("free shipping with a blank minimum is still always free", () => {
    const { settings } = normalizeMethodSettings("FREE_SHIPPING", { minimumOrderAmount: "" });
    expect(FreeShippingProvider.calculate({ settings }, { subtotal: 1 }).cost).toBe(0);
    const withMin = normalizeMethodSettings("FREE_SHIPPING", { minimumOrderAmount: "100", fallbackCost: "9" }).settings;
    expect(FreeShippingProvider.calculate({ settings: withMin }, { subtotal: 50 }).cost).toBe(9);
    expect(FreeShippingProvider.calculate({ settings: withMin }, { subtotal: 150 }).cost).toBe(0);
  });

  it("flat rate provider uses the normalized cost", () => {
    const { settings } = normalizeMethodSettings("FLAT_RATE", { cost: "15" });
    expect(FlatRateProvider.calculate({ settings }, {}).cost).toBe(15);
  });
});
