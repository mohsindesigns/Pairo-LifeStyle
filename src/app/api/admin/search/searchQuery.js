// Query helpers for the admin topbar search (GET /api/admin/search).
// Kept free of DB/Next imports so the filter logic can be unit-tested.

export const SEARCH_LIMIT = 5;
const MAX_WORDS = 6;
const MAX_WORD_LENGTH = 60;

export function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lowercased, de-duplicated search words (capped so a huge query can't build a huge filter). */
export function parseSearchWords(q) {
  if (typeof q !== "string") return [];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean).map(w => w.slice(0, MAX_WORD_LENGTH));
  return [...new Set(words)].slice(0, MAX_WORDS);
}

/**
 * Every word must match (case-insensitive substring) at least one of the fields —
 * same semantics as the old client-side Topbar filter.
 */
export function buildWordFilter(words, fields, base = {}) {
  if (!words.length) return null;
  return {
    $and: [
      base,
      ...words.map(w => {
        const rx = { $regex: escapeRegex(w), $options: "i" };
        return { $or: fields.map(f => ({ [f]: rx })) };
      }),
    ],
  };
}
