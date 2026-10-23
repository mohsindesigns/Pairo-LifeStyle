import { describe, it, expect } from "vitest";
import { escapeRegex, parsePaging, mediaListQuery } from "@/app/api/admin/media/helpers";

describe("admin media helpers", () => {
  it("escapes regex special characters", () => {
    expect(escapeRegex("a(b).png*")).toBe("a\\(b\\)\\.png\\*");
    expect(() => new RegExp(escapeRegex("[(*"))).not.toThrow();
  });

  it("parses paging safely", () => {
    expect(parsePaging("2", "30")).toEqual({ page: 2, limit: 30, skip: 30 });
    expect(parsePaging("-5", "abc")).toEqual({ page: 1, limit: 30, skip: 0 });
    expect(parsePaging("1", "5000").limit).toBe(100);
  });

  it("builds list queries", () => {
    expect(mediaListQuery({})).toEqual({ isDeleted: { $ne: true } });
    expect(mediaListQuery({ trash: true })).toEqual({ isDeleted: true });
    const q = mediaListQuery({ search: "  shirt (1) ", type: "image" });
    expect(q.mediaType).toBe("image");
    expect(q.$or).toHaveLength(5);
    expect(q.$or[0].filename.test("Black SHIRT (1).jpg")).toBe(true);
    expect(q.$or[0].filename.test("shirt 1.jpg")).toBe(false);
  });
});
