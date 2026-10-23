// Pure helpers shared by the categories API and the admin CategoryManager
// (no DB / server-only imports; unit-tested in src/__tests__/admin-category-helpers.test.js).

// Fields the server manages itself; never accepted from a create payload.
export const SERVER_MANAGED_CATEGORY_FIELDS = [
  "_id", "id", "__v", "createdAt", "updatedAt", "isDeleted", "deletedAt", "productCount", "uniqueSlug",
];

export function stripServerManagedFields(data = {}) {
  const out = { ...data };
  for (const key of SERVER_MANAGED_CATEGORY_FIELDS) delete out[key];
  return out;
}

// Editable fields copied by "Duplicate". linkedItems is added by the caller
// (it is not stored on the category document).
const DUPLICATE_FIELDS = [
  "type", "description", "content", "image", "banner", "showBannerOverlay", "isFeatured",
  "showInFilters", "faqSchemaCustom",
];

export function buildCategoryDuplicate(cat = {}, linkedItems = []) {
  const copy = {};
  for (const key of DUPLICATE_FIELDS) {
    if (cat[key] !== undefined && cat[key] !== null) copy[key] = cat[key];
  }
  copy.name = `${cat.name || "Category"} (Copy)`;
  copy.slug = `${cat.slug || "category"}-copy`;
  copy.status = "Draft";
  if (cat.seo && typeof cat.seo === "object") {
    const { _id, ...seo } = cat.seo;
    copy.seo = seo;
  }
  if (Array.isArray(cat.faqs)) {
    copy.faqs = cat.faqs.map(({ question, answer }) => ({ question, answer }));
  }
  if (Array.isArray(linkedItems) && linkedItems.length) copy.linkedItems = linkedItems.map(String);
  // Ask the server to pick a free slug (base, base-2, base-3, ...).
  copy.uniqueSlug = true;
  return copy;
}

// Candidate slugs tried in order when the server must find a free one.
export function slugCandidates(base, max = 50) {
  const clean = String(base || "category").toLowerCase().trim()
    .replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "") || "category";
  const list = [clean];
  for (let i = 2; i <= max; i += 1) list.push(`${clean}-${i}`);
  return list;
}
