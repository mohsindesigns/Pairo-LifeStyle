import { describe, it, expect } from "vitest";
import {
  buildDuplicatePayload,
  copyCodeCandidate,
  isValidUsageLimitInput,
  toDateInput,
} from "@/components/admin/discounts/couponUtils";

describe("buildDuplicatePayload", () => {
  const source = {
    _id: "a".repeat(24),
    code: "SUMMER",
    type: "fixed",
    value: 10,
    minPurchase: 0,
    minQuantity: 0,
    usageLimit: 50,
    usageCount: 12,
    usagePerUserLimit: null,
    maxDiscountAmount: null,
    isActive: true,
    isDeleted: true,
    stripeCouponId: "co_123",
    stripePromotionCodeId: "promo_123",
    stripeSyncStatus: "synced",
    stripeSyncError: "boom",
    stripeSyncKey: "k",
    notifiedCustomerEmails: ["x@y.com"],
    redeemedFingerprints: ["fp"],
    createdAt: "2026-01-01T00:00:00.000Z",
    endDate: "2026-09-10T12:00:00.000Z",
    specificProducts: [{ _id: "b".repeat(24), name: "P" }],
    specificCategories: ["c".repeat(24)],
    specificCustomerEmails: ["x@y.com"],
  };

  it("copies only editable fields, inactive, flagged as duplicate", () => {
    const p = buildDuplicatePayload(source);
    expect(p.duplicate).toBe(true);
    expect(p.code).toBe("SUMMER");
    expect(p.isActive).toBe(false);
    for (const k of ["_id", "isDeleted", "usageCount", "stripeCouponId", "stripePromotionCodeId",
      "stripeSyncStatus", "stripeSyncError", "stripeSyncKey", "notifiedCustomerEmails",
      "redeemedFingerprints", "createdAt"]) {
      expect(p).not.toHaveProperty(k);
    }
    expect(p.specificProducts).toEqual(["b".repeat(24)]);
    expect(p.specificCategories).toEqual(["c".repeat(24)]);
    expect(p.specificCustomerEmails).toBe("x@y.com");
    expect(p.minPurchase).toBe(0);
    expect(p.minQuantity).toBe(0);
    expect(p.usageLimit).toBe(50);
    expect(p.usagePerUserLimit).toBe("");
    expect(p.endDate).toBe("2026-09-10");
  });
});

describe("copyCodeCandidate", () => {
  it("produces CODE-COPY, CODE-COPY-2, ...", () => {
    expect(copyCodeCandidate("summer", 1)).toBe("SUMMER-COPY");
    expect(copyCodeCandidate("SUMMER", 2)).toBe("SUMMER-COPY-2");
    expect(copyCodeCandidate("SUMMER", 7)).toBe("SUMMER-COPY-7");
  });
});

describe("isValidUsageLimitInput", () => {
  it("allows blank (unlimited) and whole numbers >= 1", () => {
    expect(isValidUsageLimitInput("")).toBe(true);
    expect(isValidUsageLimitInput("1")).toBe(true);
    expect(isValidUsageLimitInput(20)).toBe(true);
    expect(isValidUsageLimitInput("0")).toBe(false);
    expect(isValidUsageLimitInput("-3")).toBe(false);
    expect(isValidUsageLimitInput("1.5")).toBe(false);
  });
});

describe("toDateInput", () => {
  it("handles empty and invalid values", () => {
    expect(toDateInput(null)).toBe("");
    expect(toDateInput("nope")).toBe("");
  });
});
