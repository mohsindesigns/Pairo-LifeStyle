import { describe, it, expect } from "vitest";
import {
  slugifyScriptName, slugCandidate, copySlugCandidate, firstFreeSlug, buildScriptCopy, scriptListFilter, stripServerFields,
} from "@/app/api/admin/scripts/helpers";

describe("script slugs", () => {
  it("slugifies names", () => {
    expect(slugifyScriptName("Google Analytics 4!")).toBe("google-analytics-4");
    expect(slugifyScriptName("  ")).toBe("script");
  });
  it("numbers and copy suffixes", () => {
    expect(slugCandidate("ga", 1)).toBe("ga");
    expect(slugCandidate("ga", 3)).toBe("ga-3");
    expect(copySlugCandidate("ga", 1)).toBe("ga-copy");
    expect(copySlugCandidate("ga-copy", 2)).toBe("ga-copy-2");
    expect(copySlugCandidate("ga-copy-4", 1)).toBe("ga-copy");
  });
  it("finds the first free slug", async () => {
    const taken = new Set(["ga-copy", "ga-copy-2"]);
    expect(await firstFreeSlug((n) => copySlugCandidate("ga", n), async (s) => taken.has(s))).toBe("ga-copy-3");
  });
});

describe("script copy", () => {
  it("is paused, renamed, with a fresh trail", () => {
    const src = { _id: "1", name: "Pixel", slug: "pixel", code: "x", isActive: true, version: 7, auditLog: [{ action: "CREATE" }], isDeleted: true, createdAt: "2020", targeting: { type: "all", routes: [] } };
    const c = buildScriptCopy(src, "pixel-copy", "staff1");
    expect(c).toMatchObject({ name: "Pixel (Copy)", slug: "pixel-copy", isActive: false, isDeleted: false, version: 1, code: "x", createdBy: "staff1" });
    expect(c._id).toBeUndefined();
    expect(c.createdAt).toBeUndefined();
    expect(c.auditLog).toHaveLength(1);
    expect(c.targeting).toEqual({ type: "all", routes: [] });
  });
});

describe("script list filter / PUT body", () => {
  it("defaults to live scripts", () => {
    expect(scriptListFilter(new URLSearchParams(""))).toEqual({ isDeleted: { $ne: true } });
    expect(scriptListFilter(new URLSearchParams("trash=1"))).toEqual({ isDeleted: true });
    expect(scriptListFilter(new URLSearchParams("scope=all"))).toEqual({});
  });
  it("strips server-managed fields", () => {
    expect(stripServerFields({ name: "a", isDeleted: false, version: 3, auditLog: [], slug: "x", _id: "1", isActive: true })).toEqual({ name: "a", isActive: true });
  });
});
