import { describe, it, expect } from "vitest";
import { promotionCopyCode, promotionCopyTitle, buildPromotionCopy } from "@/components/admin/promotions/promotionCopy";

describe("promotion duplicate helpers", () => {
  it("builds -COPY codes without piling up suffixes", () => {
    expect(promotionCopyCode("summer", 1)).toBe("SUMMER-COPY");
    expect(promotionCopyCode("SUMMER", 2)).toBe("SUMMER-COPY-2");
    expect(promotionCopyCode("SUMMER-COPY", 1)).toBe("SUMMER-COPY");
    expect(promotionCopyCode("SUMMER-COPY-3", 4)).toBe("SUMMER-COPY-4");
  });

  it("adds (Copy) to the title once", () => {
    expect(promotionCopyTitle("Sale")).toBe("Sale (Copy)");
    expect(promotionCopyTitle("Sale (Copy)")).toBe("Sale (Copy)");
  });

  it("copies as a Draft with usage, analytics, Stripe and ids reset", () => {
    const src = {
      _id: "a", id: "a", __v: 3, status: "Active", title: "BOGO", code: "BOGO", adminStatus: "Active",
      createdAt: "x", updatedAt: "y", priority: 7,
      analytics: { timesUsed: 9, discountDistributed: 50, revenueGenerated: 500 },
      usageLimits: { maxTotalUses: 100, currentTotalUses: 42, maxUsesPerCustomer: null },
      stripeCouponId: "c", stripePromotionCodeId: "p", stripeSyncStatus: "synced", stripeSyncError: null, stripeSyncKey: "k",
      conditions: { operator: "AND", rules: [] },
      actions: [{ _id: "x1", type: "quantity_tier", target: "cart", quantityTiers: [{ _id: "t1", quantity: 2, priceType: "percentage", value: 10 }] }],
    };
    const copy = buildPromotionCopy(src, "BOGO-COPY");
    expect(copy).toMatchObject({ title: "BOGO (Copy)", code: "BOGO-COPY", adminStatus: "Draft", priority: 7 });
    expect(copy.usageLimits).toEqual({ maxTotalUses: 100, maxUsesPerCustomer: null, currentTotalUses: 0 });
    for (const k of ["_id", "id", "__v", "status", "createdAt", "updatedAt", "analytics", "stripeCouponId", "stripePromotionCodeId", "stripeSyncStatus", "stripeSyncError", "stripeSyncKey"]) {
      expect(copy).not.toHaveProperty(k);
    }
    expect(copy.actions[0]).not.toHaveProperty("_id");
    expect(copy.actions[0].quantityTiers[0]).toEqual({ quantity: 2, priceType: "percentage", value: 10 });
    // source untouched
    expect(src.actions[0]._id).toBe("x1");
  });

  it("leaves automatic promotions without a code", () => {
    const copy = buildPromotionCopy({ title: "Auto", isAutomatic: true, actions: [] });
    expect(copy).not.toHaveProperty("code");
    expect(copy.usageLimits.maxUsesPerCustomer).toBe(1);
  });
});
