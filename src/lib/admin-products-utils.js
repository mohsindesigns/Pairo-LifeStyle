// Pure helpers shared by the admin Products list, the Add/Edit Product form and the
// admin products API. No DB / React imports so they can be unit-tested directly.

export const PRODUCTS_PER_PAGE = 20;

const isBlank = (v) => v === "" || v === null || v === undefined;

/**
 * Validates the product price pair used by the editor.
 * `regular` is the "Regular price" field (compareAtPrice), `sale` the "Sale price" field (price).
 * Empty values are allowed; returns an error message or null. A sale price at or above the
 * regular price is not an error (existing products have it) — see priceWarning.
 */
export function validatePrices(regular, sale) {
  const r = isBlank(regular) ? null : Number(regular);
  const s = isBlank(sale) ? null : Number(sale);
  if (r !== null && !Number.isFinite(r)) return "Regular price must be a valid number.";
  if (s !== null && !Number.isFinite(s)) return "Sale price must be a valid number.";
  if (r !== null && r < 0) return "Regular price cannot be negative.";
  if (s !== null && s < 0) return "Sale price cannot be negative.";
  return null;
}

/** Non-blocking notice for a sale price that isn't below the regular price. */
export function priceWarning(regular, sale) {
  if (isBlank(regular) || isBlank(sale)) return null;
  const r = Number(regular);
  const s = Number(sale);
  if (!Number.isFinite(r) || !Number.isFinite(s)) return null;
  return s < r ? null : "Sale price is not lower than the regular price, so no discount will show.";
}

/**
 * Parses a required price entered in Quick Edit. Returns { value } or { error }.
 */
export function parseRequiredPrice(raw) {
  if (isBlank(raw) || String(raw).trim() === "") return { error: "Price is required." };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: "Price must be a valid number." };
  if (n < 0) return { error: "Price cannot be negative." };
  return { value: n };
}

/** Builds a variant SKU from the base SKU and option labels, skipping empty parts. */
export function buildVariantSku(baseSku, labels = []) {
  return [baseSku, ...labels]
    .map((p) => (p === null || p === undefined ? "" : String(p).trim()))
    .filter(Boolean)
    .join("-")
    .toUpperCase();
}

/** Returns the slice of `list` for a 1-based page, plus the clamped page and page count. */
export function paginate(list, page, perPage = PRODUCTS_PER_PAGE) {
  const totalPages = Math.max(1, Math.ceil(list.length / perPage));
  const current = Math.min(Math.max(1, page || 1), totalPages);
  const start = (current - 1) * perPage;
  return { items: list.slice(start, start + perPage), page: current, totalPages };
}

/**
 * Candidate slugs for a duplicated product: "<slug>-copy", "<slug>-copy-2", "<slug>-copy-3", …
 * An existing "-copy[-N]" suffix is stripped first so copies of copies don't pile up suffixes.
 */
export function copySlugCandidate(baseSlug, attempt) {
  const root = String(baseSlug || "product").replace(/-copy(-\d+)?$/, "") || "product";
  return attempt <= 1 ? `${root}-copy` : `${root}-copy-${attempt}`;
}

/** Status to restore a trashed product to: the status it had before trashing, else Draft. */
export function restoreStatus(statusBeforeTrash) {
  return statusBeforeTrash === "Published" || statusBeforeTrash === "Draft" ? statusBeforeTrash : "Draft";
}
