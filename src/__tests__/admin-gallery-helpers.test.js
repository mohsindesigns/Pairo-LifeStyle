import { describe, it, expect } from "vitest";
import { galleryListQuery, buildGalleryDuplicate, parseReorderIds, moveItem } from "@/app/api/admin/gallery-items/helpers";

describe("admin gallery helpers", () => {
  it("builds list queries per view", () => {
    expect(galleryListQuery("all")).toEqual({ isDeleted: { $ne: true } });
    expect(galleryListQuery("visible")).toEqual({ isDeleted: { $ne: true }, enabled: true });
    expect(galleryListQuery("hidden")).toEqual({ isDeleted: { $ne: true }, enabled: false });
    expect(galleryListQuery("trash")).toEqual({ isDeleted: true });
  });

  it("duplicates as a hidden copy right after the source", () => {
    const copy = buildGalleryDuplicate({
      _id: "x", title: "Jacket", image: "/a.jpg", description: "d", order: 4, enabled: true,
      linkedProduct: { _id: "p1", name: "P" }, isDeleted: true, createdAt: "t",
    });
    expect(copy).toEqual({
      image: "/a.jpg", title: "Jacket (Copy)", description: "d", linkedProduct: "p1",
      order: 5, enabled: false, isDeleted: false, deletedAt: null, enabledBeforeTrash: null,
    });
    expect(buildGalleryDuplicate({ title: "T", image: "i", linkedProduct: null }).linkedProduct).toBeNull();
  });

  it("validates reorder ids", () => {
    expect(parseReorderIds({ ids: ["a", "b"] })).toEqual({ ids: ["a", "b"] });
    expect(parseReorderIds({}).error).toBeTruthy();
    expect(parseReorderIds({ ids: ["a", "a"] }).error).toMatch(/Duplicate/);
    expect(parseReorderIds({ ids: ["a"] }, () => false).error).toMatch(/Invalid/);
  });

  it("moves items within bounds", () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 2, 5)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
  });
});
