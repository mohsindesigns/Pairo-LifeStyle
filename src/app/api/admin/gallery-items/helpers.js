// Pure helpers for the admin Gallery items API. No DB imports so they can be unit-tested
// directly (src/__tests__/admin-gallery-helpers.test.js).

/** Mongo filter for a list view: "all" | "visible" | "hidden" | "trash". */
export function galleryListQuery(view) {
  if (view === "trash") return { isDeleted: true };
  const query = { isDeleted: { $ne: true } };
  if (view === "visible") query.enabled = true;
  else if (view === "hidden") query.enabled = false;
  return query;
}

/**
 * Document for a duplicated gallery item: same image / description / linked product,
 * "(Copy)" title, hidden (so it doesn't appear publicly until reviewed), placed right
 * after the source in the order, and no trash / identity fields.
 */
export function buildGalleryDuplicate(source) {
  const linked = source?.linkedProduct;
  return {
    image: source?.image || "",
    title: `${source?.title || "Gallery item"} (Copy)`,
    description: source?.description || "",
    linkedProduct: linked && typeof linked === "object" && linked._id ? linked._id : (linked || null),
    order: (Number(source?.order) || 0) + 1,
    enabled: false,
    isDeleted: false,
    deletedAt: null,
    enabledBeforeTrash: null,
  };
}

/**
 * Validates a reorder request body: a non-empty array of unique id strings.
 * Returns { ids } or { error }.
 */
export function parseReorderIds(body, isValidId = () => true) {
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) return { error: "No items to reorder." };
  const clean = ids.map((id) => String(id));
  if (new Set(clean).size !== clean.length) return { error: "Duplicate item in the new order." };
  if (!clean.every(isValidId)) return { error: "Invalid item ID." };
  return { ids: clean };
}

/** Moves the element at `from` to `to` (both clamped), returning a new array. */
export function moveItem(list, from, to) {
  const arr = [...list];
  if (from < 0 || from >= arr.length) return arr;
  const target = Math.min(Math.max(0, to), arr.length - 1);
  const [item] = arr.splice(from, 1);
  arr.splice(target, 0, item);
  return arr;
}
