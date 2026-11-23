import { describe, it, expect } from "vitest";
import { escapeRegex, parseSearchWords, buildWordFilter } from "@/app/api/admin/search/searchQuery";

describe("admin search query helpers", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegex("a.b*(c)")).toBe("a\\.b\\*\\(c\\)");
    expect(new RegExp(escapeRegex("#1001 (x)"), "i").test("order #1001 (X)")).toBe(true);
  });

  it("parses, lowercases, dedupes and caps words", () => {
    expect(parseSearchWords("  Leather  JACKET leather ")).toEqual(["leather", "jacket"]);
    expect(parseSearchWords(null)).toEqual([]);
    expect(parseSearchWords("a b c d e f g h")).toHaveLength(6);
    expect(parseSearchWords("x".repeat(500))[0]).toHaveLength(60);
  });

  it("requires every word to match one of the fields", () => {
    const f = buildWordFilter(["jo", "1001"], ["name", "email"], { isDeleted: false });
    expect(f.$and[0]).toEqual({ isDeleted: false });
    expect(f.$and).toHaveLength(3);
    expect(f.$and[1].$or).toEqual([
      { name: { $regex: "jo", $options: "i" } },
      { email: { $regex: "jo", $options: "i" } },
    ]);
    expect(buildWordFilter([], ["name"])).toBeNull();
  });
});
