import { describe, it, expect } from "vitest";
import { buildCategoryDuplicate, stripServerManagedFields, slugCandidates } from "@/app/api/admin/categories/helpers";

const source = {
  _id: "abc",
  __v: 3,
  name: "Leather Jackets",
  slug: "leather-jackets",
  type: "product",
  description: "short",
  content: "<p>long</p>",
  image: "img.jpg",
  banner: "banner.jpg",
  showBannerOverlay: true,
  status: "Published",
  isFeatured: true,
  isDeleted: false,
  deletedAt: null,
  productCount: 12,
  createdAt: "2024-01-01",
  updatedAt: "2024-01-02",
  sizeChart: "chart1",
  seo: { _id: "seoid", title: "T", description: "D" },
  faqs: [{ _id: "f1", question: "Q", answer: "A" }],
  faqSchemaCustom: "{}",
};

describe("buildCategoryDuplicate", () => {
  const copy = buildCategoryDuplicate(source, ["p1", "p2"]);

  it("copies only editable fields", () => {
    for (const k of ["_id", "__v", "createdAt", "updatedAt", "isDeleted", "deletedAt", "productCount", "sizeChart"]) {
      expect(copy).not.toHaveProperty(k);
    }
    expect(copy).toMatchObject({
      name: "Leather Jackets (Copy)",
      slug: "leather-jackets-copy",
      status: "Draft",
      type: "product",
      description: "short",
      content: "<p>long</p>",
      image: "img.jpg",
      banner: "banner.jpg",
      faqSchemaCustom: "{}",
      uniqueSlug: true,
      linkedItems: ["p1", "p2"],
    });
  });

  it("strips nested ids from seo and faqs", () => {
    expect(copy.seo).toEqual({ title: "T", description: "D" });
    expect(copy.faqs).toEqual([{ question: "Q", answer: "A" }]);
  });

  it("omits linkedItems when there are none", () => {
    expect(buildCategoryDuplicate(source)).not.toHaveProperty("linkedItems");
  });
});

describe("stripServerManagedFields", () => {
  it("removes server-managed keys only", () => {
    const out = stripServerManagedFields({ ...source, uniqueSlug: true });
    expect(out).not.toHaveProperty("_id");
    expect(out).not.toHaveProperty("isDeleted");
    expect(out).not.toHaveProperty("productCount");
    expect(out).not.toHaveProperty("uniqueSlug");
    expect(out.name).toBe("Leather Jackets");
  });
});

describe("slugCandidates", () => {
  it("yields base then numbered variants", () => {
    expect(slugCandidates("Foo Bar-copy", 3)).toEqual(["foo-bar-copy", "foo-bar-copy-2", "foo-bar-copy-3"]);
  });
  it("falls back for empty input", () => {
    expect(slugCandidates("", 1)).toEqual(["category"]);
  });
});
