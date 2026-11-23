import { describe, it, expect } from "vitest";
import {
  buildAbandonedCartQuery,
  buildAbandonedCartCountsPipeline,
  emptyAbandonedCartCounts,
  escapeRegex,
} from "@/app/api/admin/abandoned-carts/listQuery";

describe("admin abandoned carts list query", () => {
  it("defaults to live, not-yet-completed carts", () => {
    expect(buildAbandonedCartQuery()).toEqual({ $and: [{ isDeleted: { $ne: true } }, { status: "active" }] });
  });

  it("recovered and all views exclude trashed records", () => {
    expect(buildAbandonedCartQuery({ view: "recovered" }).$and).toEqual([{ isDeleted: { $ne: true } }, { status: "recovered" }]);
    expect(buildAbandonedCartQuery({ view: "all" }).$and).toEqual([{ isDeleted: { $ne: true } }]);
  });

  it("trash view shows only trashed records, whatever their status", () => {
    expect(buildAbandonedCartQuery({ view: "trash" }).$and).toEqual([{ isDeleted: true }]);
  });

  it("unknown views fall back to active", () => {
    expect(buildAbandonedCartQuery({ view: "bogus" }).$and[1]).toEqual({ status: "active" });
  });

  it("search escapes regex characters and covers name, email and phone", () => {
    const q = buildAbandonedCartQuery({ view: "all", search: " a.b(c " });
    const or = q.$and[1].$or;
    expect(or.map((c) => Object.keys(c)[0])).toEqual([
      "contact.email", "contact.firstName", "contact.lastName", "contact.phone", "shippingAddress.fullName",
    ]);
    expect(or[0]["contact.email"]).toEqual({ $regex: "a\\.b\\(c", $options: "i" });
    expect(escapeRegex("1+1*[x]")).toBe("1\\+1\\*\\[x\\]");
  });

  it("counts pipeline groups every tab and only matches when searching", () => {
    const plain = buildAbandonedCartCountsPipeline("");
    expect(plain).toHaveLength(1);
    expect(Object.keys(plain[0].$group).sort()).toEqual(["_id", "active", "all", "recovered", "trash"]);
    const searched = buildAbandonedCartCountsPipeline("bob");
    expect(searched[0].$match.$or).toHaveLength(5);
    expect(emptyAbandonedCartCounts()).toEqual({ active: 0, recovered: 0, all: 0, trash: 0 });
  });
});
