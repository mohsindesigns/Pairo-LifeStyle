import { describe, it, expect } from "vitest";
import { blogListQuery, restoreBlogStatus, buildBlogDuplicate, copySlugCandidate } from "@/app/api/admin/blogs/helpers";

describe("admin blog helpers", () => {
  it("builds list queries per view", () => {
    expect(blogListQuery("all")).toEqual({ isDeleted: { $ne: true } });
    expect(blogListQuery("published")).toEqual({ isDeleted: { $ne: true }, status: "Published" });
    expect(blogListQuery("draft")).toEqual({ isDeleted: { $ne: true }, status: "Draft" });
    expect(blogListQuery("trash")).toEqual({ isDeleted: true });
  });

  it("restores the pre-trash status, Draft when unknown", () => {
    expect(restoreBlogStatus("Published")).toBe("Published");
    expect(restoreBlogStatus("Draft")).toBe("Draft");
    expect(restoreBlogStatus(null)).toBe("Draft");
    expect(restoreBlogStatus("weird")).toBe("Draft");
  });

  it("copy slugs don't pile up suffixes", () => {
    expect(copySlugCandidate("my-post", 1)).toBe("my-post-copy");
    expect(copySlugCandidate("my-post", 3)).toBe("my-post-copy-3");
    expect(copySlugCandidate("my-post-copy-2", 1)).toBe("my-post-copy");
  });

  it("duplicates as a fresh Draft without identity or trash fields", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const src = {
      _id: "abc", __v: 3, createdAt: "x", updatedAt: "y",
      title: "Hello", slug: "hello", status: "Published", isFeatured: true,
      isDeleted: true, deletedAt: new Date(), statusBeforeTrash: "Published",
      content: "<p>body</p>", seo: { title: "S" },
      faqs: [{ _id: "f1", question: "Q", answer: "A" }],
    };
    const copy = buildBlogDuplicate(src, "hello-copy", now);
    expect(copy.title).toBe("Hello (Copy)");
    expect(copy.slug).toBe("hello-copy");
    expect(copy.status).toBe("Draft");
    expect(copy.isFeatured).toBe(false);
    expect(copy.isDeleted).toBe(false);
    expect(copy.deletedAt).toBeNull();
    expect(copy.publishedAt).toBe(now);
    expect(copy.content).toBe("<p>body</p>");
    expect(copy.seo).toEqual({ title: "S" });
    expect(copy.faqs).toEqual([{ question: "Q", answer: "A" }]);
    for (const k of ["_id", "__v", "createdAt", "updatedAt", "statusBeforeTrash"]) expect(copy).not.toHaveProperty(k);
  });
});
