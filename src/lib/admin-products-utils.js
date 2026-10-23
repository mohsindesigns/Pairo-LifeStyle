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

/** Lower-case URL slug from any text ("" when nothing usable is left). */
export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/**
 * First free slug for `base`: base, base-1, base-2, …  `isTaken(slug)` (sync or async) says whether
 * another document already holds it. Trashed products still hold their slug (the index is unique),
 * so callers must check against every product, not just live ones.
 */
export async function uniqueSlug(base, isTaken, maxAttempts = 1000) {
  const root = slugify(base) || "product";
  let candidate = root;
  for (let n = 1; n <= maxAttempts; n++) {
    if (!(await isTaken(candidate))) return candidate;
    candidate = `${root}-${n}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** Escapes user text for use inside a RegExp / Mongo $regex. */
export function escapeRegex(text) {
  return String(text ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- Product Process (singleton doc with an ordered list of steps) ----------

/** Re-numbers `order` to match array position. */
export function reindexSteps(steps = []) {
  return steps.map((s, i) => ({ ...s, order: i }));
}

/** Copy of a step placed right after it: new id, "(Copy)" heading. */
export function duplicateStepIn(steps = [], id, makeId) {
  const idx = steps.findIndex((s) => s.id === id);
  if (idx === -1) return steps;
  const source = { ...steps[idx] };
  delete source._id; // a fresh sub-document id is assigned on save
  const copy = { ...source, id: makeId(), heading: `${source.heading || "Step"} (Copy)` };
  const next = [...steps.slice(0, idx + 1), copy, ...steps.slice(idx + 1)];
  return reindexSteps(next);
}

/** Moves a step into the trash list (stamped with deletedAt) and re-indexes the live steps. */
export function trashStepIn(steps = [], trashed = [], id, now = new Date()) {
  const step = steps.find((s) => s.id === id);
  if (!step) return { steps, trashed };
  return {
    steps: reindexSteps(steps.filter((s) => s.id !== id)),
    trashed: [{ ...step, deletedAt: now.toISOString() }, ...trashed],
  };
}

/** Puts a trashed step back at the end of the live list. */
export function restoreStepIn(steps = [], trashed = [], id) {
  const step = trashed.find((s) => s.id === id);
  if (!step) return { steps, trashed };
  const rest = { ...step };
  delete rest.deletedAt;
  delete rest._id;
  return {
    steps: reindexSteps([...steps, rest]),
    trashed: trashed.filter((s) => s.id !== id),
  };
}

/**
 * Validates the live steps before saving. Returns an error message naming the first bad step,
 * or null. Each live step needs a heading and an image (both are shown on every product page).
 */
export function validateProcessSteps(steps = []) {
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i] || {};
    const heading = String(s.heading || "").trim();
    const label = `Step ${i + 1}${heading ? ` ("${heading}")` : ""}`;
    if (!heading) return `${label} needs a heading.`;
    if (!String(s.image || "").trim()) return `${label} needs an image.`;
  }
  return null;
}
