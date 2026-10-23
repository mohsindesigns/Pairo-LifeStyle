import { describe, it, expect } from "vitest";
import {
  escapeRegex, buildSearchOr, parsePaging, buildListQuery, buildStatusCounts,
  pageInfo, validIds, trashUpdate, restoreUpdate,
} from "@/app/api/admin/submissions/inbox-utils";

const STATUSES = ["New", "Contacted", "Converted"];
const qs = (o) => new URLSearchParams(o);

describe("inbox list utils", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegex("a.b*c(1)+?")).toBe("a\\.b\\*c\\(1\\)\\+\\?");
    expect(new RegExp(escapeRegex("john+doe@x.com")).test("john+doe@x.com")).toBe(true);
  });

  it("builds a case-insensitive $or search, or null when empty", () => {
    expect(buildSearchOr("   ", ["name"])).toBeNull();
    expect(buildSearchOr(undefined, ["name"])).toBeNull();
    expect(buildSearchOr(" jo.e ", ["name", "email"])).toEqual([
      { name: { $regex: "jo\\.e", $options: "i" } },
      { email: { $regex: "jo\\.e", $options: "i" } },
    ]);
  });

  it("clamps paging", () => {
    expect(parsePaging(qs({}))).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(parsePaging(qs({ page: "3", limit: "10" }))).toEqual({ page: 3, limit: 10, skip: 20 });
    expect(parsePaging(qs({ page: "-2", limit: "5000" }))).toEqual({ page: 1, limit: 100, skip: 0 });
    expect(parsePaging(qs({ page: "abc", limit: "0" }))).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("excludes trashed docs from every view except Trash", () => {
    expect(buildListQuery({ view: "all", statuses: STATUSES })).toEqual({ isDeleted: { $ne: true } });
    expect(buildListQuery({ view: "Contacted", statuses: STATUSES })).toEqual({ isDeleted: { $ne: true }, status: "Contacted" });
    expect(buildListQuery({ view: "trash", statuses: STATUSES })).toEqual({ isDeleted: true });
    // unknown view falls back to "all" rather than leaking an arbitrary status filter
    expect(buildListQuery({ view: "$where", statuses: STATUSES })).toEqual({ isDeleted: { $ne: true } });
  });

  it("adds the search to the view filter", () => {
    const q = buildListQuery({ view: "trash", statuses: STATUSES, search: "acme", searchFields: ["company"] });
    expect(q).toEqual({ isDeleted: true, $or: [{ company: { $regex: "acme", $options: "i" } }] });
  });

  it("builds status counts including zeros and trash", () => {
    const counts = buildStatusCounts([{ _id: "New", count: 3 }, { _id: "Converted", count: 2 }, { _id: "Legacy", count: 1 }], STATUSES, 4);
    expect(counts).toEqual({ all: 6, New: 3, Contacted: 0, Converted: 2, trash: 4 });
  });

  it("page info never reports zero pages", () => {
    expect(pageInfo(0, 1, 20)).toEqual({ total: 0, pages: 1, page: 1, limit: 20 });
    expect(pageInfo(41, 2, 20).pages).toBe(3);
  });

  it("keeps only valid, unique ObjectIds", () => {
    const id = "6adb6a1f14ae99b364b1bb04";
    expect(validIds([id, id, "bogus", { $ne: 1 }, 12])).toEqual([id]);
    expect(validIds("nope")).toEqual([]);
  });

  it("trash / restore updates", () => {
    const now = new Date("2026-01-01");
    expect(trashUpdate(now)).toEqual({ isDeleted: true, deletedAt: now });
    expect(restoreUpdate()).toEqual({ isDeleted: false, deletedAt: null });
  });
});
