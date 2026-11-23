// Shared "Change URL?" guard for admin editors: saving an existing record whose slug
// differs from the one it was loaded/last saved with asks first, so a mistaken edit
// to the permalink never goes live silently.

/** Default slug comparison: whitespace/case-only differences are not a change. */
export function normalizeSlug(slug) {
   return String(slug ?? "").trim().toLowerCase();
}

/** Page slugs as the pages API stores them (lowercase, trimmed, other chars → "-"). */
export function normalizePageSlug(slug) {
   return normalizeSlug(slug).replace(/[^a-z0-9-_]+/g, "-");
}

/**
 * True when `nextSlug` would change an existing record's URL.
 * No saved slug (new record / not loaded yet) never counts as a change.
 */
export function isSlugChange(savedSlug, nextSlug, normalize = normalizeSlug) {
   const saved = normalize(savedSlug);
   if (!saved) return false;
   return saved !== normalize(nextSlug);
}

export const SLUG_CHANGE_TITLE = "Change URL?";
export const SLUG_CHANGE_OPTIONS = { confirmText: "Change URL", cancelText: "Keep old URL" };

export function slugChangeMessage(oldPath, newPath) {
   return `Change this URL from ${oldPath} to ${newPath}?\n\nOld links will redirect to the new URL automatically.`;
}

/**
 * Resolve to true when the save may go ahead: the slug is unchanged, or the admin
 * confirmed the change. `toPath(slug)` renders the permalink the way the editor shows it.
 */
export async function confirmSlugChange(showConfirm, { savedSlug, nextSlug, toPath = (s) => `/${s}`, normalize = normalizeSlug }) {
   if (!isSlugChange(savedSlug, nextSlug, normalize)) return true;
   const nextPathSlug = normalize(nextSlug) || nextSlug;
   return !!(await showConfirm(
      slugChangeMessage(toPath(String(savedSlug).trim()), toPath(String(nextPathSlug).trim())),
      SLUG_CHANGE_TITLE,
      SLUG_CHANGE_OPTIONS
   ));
}
