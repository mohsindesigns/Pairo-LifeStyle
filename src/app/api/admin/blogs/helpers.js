// Pure helpers for the admin Blog posts API and list screen. No DB / React imports so they
// can be unit-tested directly (src/__tests__/admin-blog-helpers.test.js).

export { copySlugCandidate } from "@/lib/admin-products-utils";

export const BLOG_STATUSES = ["Draft", "Published"];

/** Mongo filter for a list view: "all" | "published" | "draft" | "trash". */
export function blogListQuery(view) {
  if (view === "trash") return { isDeleted: true };
  const query = { isDeleted: { $ne: true } };
  if (view === "published") query.status = "Published";
  else if (view === "draft") query.status = "Draft";
  return query;
}

/** Status a trashed post goes back to on restore: what it had before trashing, else Draft. */
export function restoreBlogStatus(statusBeforeTrash) {
  return BLOG_STATUSES.includes(statusBeforeTrash) ? statusBeforeTrash : "Draft";
}

/**
 * Builds the document for a duplicated post: full copy of the stored post with "(Copy)" in
 * the title, the given unique slug, Draft status, not featured, a fresh publish date and no
 * trash / identity fields. `now` is injectable for tests.
 */
export function buildBlogDuplicate(source, slug, now = new Date()) {
  const {
    _id, __v, id: legacyId, createdAt, updatedAt,
    isDeleted, deletedAt, statusBeforeTrash,
    ...rest
  } = source || {};
  // Sub-document ids (FAQ items) would collide in meaning only, but drop them for a clean copy.
  const faqs = Array.isArray(rest.faqs)
    ? rest.faqs.map(({ _id: faqId, ...f }) => ({ question: f.question || "", answer: f.answer || "" }))
    : [];
  return {
    ...rest,
    faqs,
    title: `${source?.title || "Untitled post"} (Copy)`,
    slug,
    status: "Draft",
    isFeatured: false,
    isDeleted: false,
    deletedAt: null,
    publishedAt: now,
  };
}
