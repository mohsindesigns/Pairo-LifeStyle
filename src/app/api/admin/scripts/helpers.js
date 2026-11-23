// Pure helpers for the admin scripts API (no DB / Next imports, unit-tested in
// src/__tests__/admin-settings-scripts.test.js).

export function slugifyScriptName(name) {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "script";
}

/** "<slug>", then "<slug>-2", "<slug>-3"… for attempt 1, 2, 3… */
export function slugCandidate(base, attempt) {
  return attempt <= 1 ? base : `${base}-${attempt}`;
}

/** "<slug>-copy", "<slug>-copy-2"… (an existing -copy[-N] suffix is stripped first). */
export function copySlugCandidate(baseSlug, attempt) {
  const root = String(baseSlug || "script").replace(/-copy(-\d+)?$/, "") || "script";
  return attempt <= 1 ? `${root}-copy` : `${root}-copy-${attempt}`;
}

/** First candidate for which `taken(slug)` resolves false. */
export async function firstFreeSlug(candidateFor, taken, maxAttempts = 200) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const slug = candidateFor(attempt);
    if (!(await taken(slug))) return slug;
  }
  return `${candidateFor(1)}-${Date.now()}`;
}

/**
 * Document for a duplicated script: same code/config/targeting, "(Copy)" name, PAUSED so the
 * copy never injects twice on the storefront, fresh version/audit trail, never trashed.
 */
export function buildScriptCopy(source, slug, staffId) {
  const plain = JSON.parse(JSON.stringify(source || {}));
  const { _id, __v, createdAt, updatedAt, auditLog, version, isDeleted, deletedAt, createdBy, updatedBy, ...rest } = plain;
  return {
    ...rest,
    name: `${source?.name || "Untitled script"} (Copy)`,
    slug,
    isActive: false,
    isDeleted: false,
    deletedAt: null,
    version: 1,
    createdBy: staffId || undefined,
    updatedBy: staffId || undefined,
    auditLog: [{ action: "DUPLICATE", by: staffId || undefined, at: new Date() }],
  };
}

/** Mongo filter for the list: live scripts by default, ?trash=1 only trashed, ?scope=all both. */
export function scriptListFilter(searchParams) {
  if (searchParams.get("scope") === "all") return {};
  if (searchParams.get("trash") === "1") return { isDeleted: true };
  return { isDeleted: { $ne: true } };
}

/** Fields a client may never set through PUT. */
export function stripServerFields(body = {}) {
  const { _id, __v, auditLog, version, isDeleted, deletedAt, createdAt, updatedAt, createdBy, slug, ...rest } = body;
  return rest;
}
