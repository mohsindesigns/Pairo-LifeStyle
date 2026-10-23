import { describe, it, expect } from "vitest";
import { copySlugCandidate, buildPageCopy } from "@/app/api/admin/pages/page-copy";
import { slugifyThemeName, themeCopySlugCandidate, themeSlugCandidate, buildThemeCopy } from "@/app/api/admin/themes/theme-copy";

describe("page copy slugs", () => {
  it("appends -copy, then -copy-N", () => {
    expect(copySlugCandidate("terms", 1)).toBe("terms-copy");
    expect(copySlugCandidate("terms", 2)).toBe("terms-copy-2");
  });
  it("does not stack suffixes on copies of copies", () => {
    expect(copySlugCandidate("terms-copy", 1)).toBe("terms-copy");
    expect(copySlugCandidate("terms-copy-3", 2)).toBe("terms-copy-2");
  });
  it("falls back for empty slugs", () => {
    expect(copySlugCandidate("", 1)).toBe("page-copy");
  });
});

describe("buildPageCopy", () => {
  const source = {
    _id: "x", title: "Terms", slug: "terms", status: "Published", template: "default", isSystem: true,
    isDeleted: false, createdAt: "2020", updatedAt: "2020",
    sections: [{ _id: "s1", id: "a", type: "rich_text", enabled: false, order: 5, config: { html: "<p>x</p>" } }],
    seo: { title: "T", canonicalUrl: "https://x/terms" }
  };
  let n = 0;
  const copy = buildPageCopy(source, "terms-copy", () => `new-${++n}`);

  it("is a non-system draft titled (Copy)", () => {
    expect(copy.title).toBe("Terms (Copy)");
    expect(copy.slug).toBe("terms-copy");
    expect(copy.status).toBe("Draft");
    expect(copy.isSystem).toBe(false);
    expect(copy.isDeleted).toBe(false);
    expect(copy._id).toBeUndefined();
    expect(copy.createdAt).toBeUndefined();
  });
  it("copies sections with fresh ids and keeps their config", () => {
    expect(copy.sections).toHaveLength(1);
    expect(copy.sections[0].id).toBe("new-1");
    expect(copy.sections[0]._id).toBeUndefined();
    expect(copy.sections[0].order).toBe(0);
    expect(copy.sections[0].enabled).toBe(false);
    expect(copy.sections[0].config).toEqual({ html: "<p>x</p>" });
    copy.sections[0].config.html = "changed";
    expect(source.sections[0].config.html).toBe("<p>x</p>");
  });
  it("keeps SEO but drops the canonical URL", () => {
    expect(copy.seo.title).toBe("T");
    expect(copy.seo.canonicalUrl).toBeUndefined();
    expect(source.seo.canonicalUrl).toBe("https://x/terms");
  });
});

describe("theme copy helpers", () => {
  it("slugifies names", () => {
    expect(slugifyThemeName("Luxury Gold (Copy)")).toBe("luxury-gold-copy");
    expect(slugifyThemeName("  !! ")).toBe("theme");
  });
  it("builds copy slugs and strips old timestamp suffixes", () => {
    expect(themeCopySlugCandidate("editorial-serif", 1)).toBe("editorial-serif-copy");
    expect(themeCopySlugCandidate("editorial-serif-copy-1782757877915", 1)).toBe("editorial-serif-copy");
    expect(themeCopySlugCandidate("editorial-serif", 3)).toBe("editorial-serif-copy-3");
    expect(themeSlugCandidate("my-theme", 1)).toBe("my-theme");
    expect(themeSlugCandidate("my-theme", 2)).toBe("my-theme-2");
  });
  it("copies config only, inactive and non-system", () => {
    const src = { _id: "1", name: "Gold", slug: "gold", isActive: true, isSystem: true, config: { colors: { primary: "#000" } } };
    const c = buildThemeCopy(src, { slug: "gold-copy" });
    expect(c).toMatchObject({ name: "Gold (Copy)", slug: "gold-copy", isActive: false, isSystem: false });
    expect(c._id).toBeUndefined();
    c.config.colors.primary = "#fff";
    expect(src.config.colors.primary).toBe("#000");
    expect(buildThemeCopy(src, { name: "Mine", slug: "s" }).name).toBe("Mine");
  });
});
