// Pure helpers for the Site settings screen (no React, no DB).

const hasLink = (v) => typeof v === "string" && v.trim() !== "" && v.trim() !== "#";

/**
 * The storefront footer (src/components/layout/Footer.js) reads the Privacy/Terms
 * links from footerConfig (privacyUrl → privacyPageSlug), and only falls back to the
 * legacy brand.privacyUrl/termsUrl. footerConfig is the single source edited in the
 * admin (Footer tab). On read, move a legacy brand value into footerConfig when
 * footerConfig has neither a URL nor a CMS page for that link, so the admin shows
 * exactly what the storefront uses; the legacy brand value is then blanked so it is
 * no longer a hidden second source once saved.
 */
export function migrateLegalLinks(config) {
  if (!config || typeof config !== "object") return config;
  const brand = { ...(config.brand || {}) };
  const fc = { ...(config.footerConfig || {}) };
  let changed = false;

  for (const [urlKey, slugKey] of [["privacyUrl", "privacyPageSlug"], ["termsUrl", "termsPageSlug"]]) {
    const legacy = brand[urlKey];
    if (!hasLink(fc[urlKey]) && !fc[slugKey] && hasLink(legacy)) {
      fc[urlKey] = legacy;
      changed = true;
    }
    if (legacy !== undefined && legacy !== "") {
      // Legacy value is either now in footerConfig or was shadowed by it already.
      brand[urlKey] = "";
      changed = true;
    }
  }

  return changed ? { ...config, brand, footerConfig: fc } : config;
}

/**
 * /api/admin/products returns an array today; tolerate the paged object shape
 * ({ products } / { items }) too. Keeps only Published, non-trashed products.
 */
export function normalizePublishedProducts(data) {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.products)
      ? data.products
      : Array.isArray(data?.items)
        ? data.items
        : [];
  return list.filter((p) => p && p.status === "Published" && p.isDeleted !== true);
}
