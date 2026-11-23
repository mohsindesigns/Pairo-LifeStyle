// Pure helpers for the admin Media library API. No DB imports so they can be unit-tested
// directly (src/__tests__/admin-media-helpers.test.js).

/** Escapes user text for use inside a RegExp (so "a(b" or "*.png" don't throw / over-match). */
export function escapeRegex(text) {
  return String(text ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parses page / limit query params into safe positive integers (limit capped at 100). */
export function parsePaging(pageRaw, limitRaw, defaultLimit = 30) {
  const page = Math.max(1, parseInt(pageRaw, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitRaw, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/** Mongo filter for the library list: trash flag, free-text search and media type. */
export function mediaListQuery({ trash = false, search = "", type = "all" } = {}) {
  const query = trash ? { isDeleted: true } : { isDeleted: { $ne: true } };
  const term = String(search || "").trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), "i");
    query.$or = [
      { filename: rx },
      { originalName: rx },
      { title: rx },
      { altText: rx },
      { tags: rx },
    ];
  }
  if (type && type !== "all") query.mediaType = type;
  return query;
}
