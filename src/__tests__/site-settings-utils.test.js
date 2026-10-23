import { describe, it, expect } from "vitest";
import { migrateLegalLinks, normalizePublishedProducts } from "@/components/admin/settings/siteSettingsUtils";

describe("migrateLegalLinks", () => {
  it("moves legacy brand URLs into footerConfig when footer has none", () => {
    const out = migrateLegalLinks({ brand: { name: "X", privacyUrl: "/p", termsUrl: "/t" }, footerConfig: {} });
    expect(out.footerConfig.privacyUrl).toBe("/p");
    expect(out.footerConfig.termsUrl).toBe("/t");
    expect(out.brand.privacyUrl).toBe("");
    expect(out.brand.name).toBe("X");
  });
  it("keeps footer values (which the storefront uses) over brand", () => {
    const out = migrateLegalLinks({ brand: { privacyUrl: "/old" }, footerConfig: { privacyUrl: "/new" } });
    expect(out.footerConfig.privacyUrl).toBe("/new");
    expect(out.brand.privacyUrl).toBe("");
  });
  it("does not override a selected CMS page", () => {
    const out = migrateLegalLinks({ brand: { termsUrl: "/old" }, footerConfig: { termsPageSlug: "terms" } });
    expect(out.footerConfig.termsUrl).toBeUndefined();
    expect(out.footerConfig.termsPageSlug).toBe("terms");
  });
  it("ignores '#' placeholders and returns same object when nothing to do", () => {
    const cfg = { brand: {}, footerConfig: { privacyUrl: "" } };
    expect(migrateLegalLinks(cfg)).toBe(cfg);
    const out = migrateLegalLinks({ brand: { privacyUrl: "#" }, footerConfig: {} });
    expect(out.footerConfig.privacyUrl).toBeUndefined();
  });
});

describe("normalizePublishedProducts", () => {
  const items = [
    { _id: 1, status: "Published" },
    { _id: 2, status: "Draft" },
    { _id: 3, status: "Published", isDeleted: true },
  ];
  it("handles array and object shapes", () => {
    expect(normalizePublishedProducts(items).map(p => p._id)).toEqual([1]);
    expect(normalizePublishedProducts({ products: items }).map(p => p._id)).toEqual([1]);
    expect(normalizePublishedProducts({ items }).map(p => p._id)).toEqual([1]);
    expect(normalizePublishedProducts(null)).toEqual([]);
  });
});
