// Pure helpers for duplicating a CMS page. No DB / Next imports so they can be unit-tested.

/**
 * Candidate slugs for a copy: "<slug>-copy", "<slug>-copy-2", "<slug>-copy-3", …
 * An existing "-copy[-N]" suffix is stripped first so copies of copies don't pile up suffixes.
 */
export function copySlugCandidate(baseSlug, attempt) {
  const root = String(baseSlug || "page").replace(/-copy(-\d+)?$/, "") || "page";
  return attempt <= 1 ? `${root}-copy` : `${root}-copy-${attempt}`;
}

/**
 * Builds the document for a duplicated page: same template, sections (with fresh section ids),
 * description and SEO; "(Copy)" title; Draft; never a system page; trash state and timestamps reset.
 * Canonical URL is dropped so the copy doesn't claim the original's canonical address.
 */
export function buildPageCopy(source, slug, newId) {
  const sections = (Array.isArray(source.sections) ? source.sections : []).map((s, i) => {
    const { _id, createdAt, updatedAt, ...rest } = s || {};
    return {
      ...JSON.parse(JSON.stringify(rest)),
      id: newId(),
      order: i
    };
  });
  const seo = source.seo ? JSON.parse(JSON.stringify(source.seo)) : {};
  delete seo.canonicalUrl;

  return {
    title: `${source.title || "Untitled"} (Copy)`,
    slug,
    description: source.description || "",
    status: "Draft",
    template: source.template || "default",
    isSystem: false,
    isDeleted: false,
    deletedAt: null,
    statusBeforeTrash: null,
    sections,
    seo
  };
}
