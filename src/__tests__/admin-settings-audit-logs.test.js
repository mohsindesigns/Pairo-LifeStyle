import { describe, it, expect } from "vitest";
import { parseAuditParams, buildAuditFilter, totalPages, AUDIT_PAGE_SIZE, AUDIT_EXPORT_LIMIT } from "@/app/api/admin/audit-logs/query";

const sp = (s) => new URLSearchParams(s);

describe("audit log params", () => {
  it("legacy (no page) is not paginated", () => {
    expect(parseAuditParams(sp("")).paginated).toBe(false);
  });
  it("parses page and filters, rejects bad dates", () => {
    const p = parseAuditParams(sp("page=2&q=%20bob%20&action=UPDATE_PAGE&resource=page&from=2026-01-01&to=nope"));
    expect(p).toMatchObject({ paginated: true, page: 2, q: "bob", action: "UPDATE_PAGE", resource: "page", from: "2026-01-01", to: "", limit: AUDIT_PAGE_SIZE });
  });
  it("export uses the big limit from page 1", () => {
    expect(parseAuditParams(sp("export=1&page=5"))).toMatchObject({ paginated: true, page: 1, limit: AUDIT_EXPORT_LIMIT });
  });
});

describe("audit log filter", () => {
  it("empty -> {}", () => expect(buildAuditFilter({})).toEqual({}));
  it("combines search, action, dates", () => {
    const f = buildAuditFilter({ q: "a.b", action: "DELETE_ROLE", from: "2026-01-01", to: "2026-01-31" }, ["s1"]);
    expect(f.$and).toHaveLength(3);
    const or = f.$and[0].$or;
    expect(or[0].action.test("xa.bx")).toBe(true);
    expect(or[0].action.test("axb")).toBe(false);
    expect(or.at(-1)).toEqual({ staffId: { $in: ["s1"] } });
    expect(f.$and[1]).toEqual({ action: "DELETE_ROLE" });
    expect(f.$and[2].timestamp.$lte.toISOString()).toBe("2026-01-31T23:59:59.999Z");
  });
  it("single condition is not wrapped", () => {
    expect(buildAuditFilter({ resource: "page" })).toEqual({ resource: "page" });
  });
  it("pages", () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(51, 25)).toBe(3);
  });
});
