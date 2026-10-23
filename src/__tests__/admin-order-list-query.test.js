import { describe, it, expect } from "vitest";
import {
  buildOrderListQuery,
  buildOrderCountsPipeline,
  emptyOrderCounts,
} from "@/app/api/admin/orders/orderListQuery";

describe("buildOrderListQuery", () => {
  it("excludes trashed orders by default", () => {
    const q = buildOrderListQuery({ status: "all" });
    expect(q.$and).toEqual([{ isDeleted: { $ne: true } }]);
  });

  it("lists only trashed orders in trash view", () => {
    const q = buildOrderListQuery({ trash: true });
    expect(q.$and[0]).toEqual({ isDeleted: true });
  });

  it("filters by a real status (Completed tab = Delivered)", () => {
    const q = buildOrderListQuery({ status: "Delivered" });
    expect(q.$and).toContainEqual({ status: "Delivered" });
  });

  it("affiliateOnly / referred require affiliate attribution", () => {
    for (const q of [buildOrderListQuery({ affiliateOnly: true }), buildOrderListQuery({ referral: "referred" })]) {
      const clause = q.$and.find((c) => c.$or && c.$or.some((o) => "affiliateId" in o));
      expect(clause.$or).toEqual([
        { affiliateReferralCode: { $nin: [null, ""] } },
        { affiliateId: { $ne: null } },
      ]);
      expect(q.$and.some((c) => "status" in c)).toBe(false);
    }
  });

  it("non-referred requires no attribution", () => {
    const q = buildOrderListQuery({ referral: "non-referred" });
    expect(q.$and).toContainEqual({ affiliateReferralCode: { $in: [null, ""] }, affiliateId: null });
  });

  it("combines search with filters without clobbering $or", () => {
    const q = buildOrderListQuery({ status: "Processing", search: "abc", referral: "referred" });
    expect(q.$and).toHaveLength(4);
    expect(q.$and[3].$or[0]).toEqual({ orderNumber: { $regex: "abc", $options: "i" } });
  });
});

describe("buildOrderCountsPipeline", () => {
  it("returns one $group with a count for every tab", () => {
    const p = buildOrderCountsPipeline("");
    expect(p).toHaveLength(1);
    expect(Object.keys(p[0].$group).sort()).toEqual(["_id", ...Object.keys(emptyOrderCounts())].sort());
  });

  it("applies search as a leading $match", () => {
    const p = buildOrderCountsPipeline("x");
    expect(p[0].$match.$or).toHaveLength(3);
  });
});
