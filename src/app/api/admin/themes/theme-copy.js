// Pure helpers for theme slugs/copies. No DB / Next imports so they can be unit-tested.

/** Turns a theme name into a slug: "Luxury Gold (Copy)" -> "luxury-gold-copy". */
export function slugifyThemeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "theme";
}

/**
 * Candidate slugs for a copy: "<slug>-copy", "<slug>-copy-2", …
 * Strips an existing "-copy[-N]" or old timestamp suffix ("-copy-1779101072378") first.
 */
export function themeCopySlugCandidate(baseSlug, attempt) {
  const root = String(baseSlug || "theme").replace(/-copy(-\d+)?$/, "") || "theme";
  return attempt <= 1 ? `${root}-copy` : `${root}-copy-${attempt}`;
}

/** Candidate slugs for a new theme: "<slug>", "<slug>-2", "<slug>-3", … */
export function themeSlugCandidate(baseSlug, attempt) {
  return attempt <= 1 ? baseSlug : `${baseSlug}-${attempt}`;
}

/** Only the design-token config is copied; activation, system flag and timestamps are reset. */
export function buildThemeCopy(source, { name, slug }) {
  return {
    name: name || `${source.name || "Theme"} (Copy)`,
    slug,
    isActive: false,
    isSystem: false,
    config: source.config ? JSON.parse(JSON.stringify(source.config)) : undefined,
    previewImage: source.previewImage
  };
}
