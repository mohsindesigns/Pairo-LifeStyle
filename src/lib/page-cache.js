import { cache } from "react";
import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import { TEMPLATE_REGISTRY } from "@/lib/templates";

/**
 * Deduplicated retrieval of a Page document by slug.
 * React cache prevents double-fetching during Next.js SSR page execution
 * (e.g. once in generateMetadata and once in the page component).
 */
export const getCachedPageBySlug = cache(async (slug) => {
  await dbConnect();
  return Page.findOne({ slug: slug.toLowerCase() }).lean();
});

/**
 * Deduplicated retrieval of a Page document by MongoDB ID.
 */
export const getCachedPageById = cache(async (id) => {
  await dbConnect();
  return Page.findById(id).lean();
});

/**
 * Resolves a page and its template configuration.
 * Instantiates fallback default layout config dynamically if a page document is missing,
 * avoiding shared cache pollution or bleed.
 * 
 * @param {string} slug Slug of the page
 * @param {string} defaultTemplate Fallback template if missing
 * @returns {Promise<Object>} { page: Object, templateInfo: Object }
 */
export async function resolvePageAndTemplate(slug, defaultTemplate = "default") {
  const normalizedSlug = slug.toLowerCase();
  
  // Try loading from cache/database
  let page = await getCachedPageBySlug(normalizedSlug);

  if (!page) {
    // If not found in DB, construct a dynamic template-specific default instance
    const templateConfig = TEMPLATE_REGISTRY[defaultTemplate] || TEMPLATE_REGISTRY.default;
    
    // Deep clone to prevent mutating global shared configurations
    const clonedSections = JSON.parse(JSON.stringify(templateConfig.defaultSections || []));
    
    page = {
      title: slug.charAt(0).toUpperCase() + slug.slice(1),
      slug: normalizedSlug,
      template: defaultTemplate,
      status: "Published",
      sections: clonedSections.map((s, i) => ({
        ...s,
        id: `default-${defaultTemplate}-${i}-${normalizedSlug}`, // Deterministic ID to avoid React hydration mismatches
        enabled: true,
        order: i
      })),
      seo: {
        title: `${slug.charAt(0).toUpperCase() + slug.slice(1)} | Pairo`,
        description: `Archival page for ${slug}.`
      }
    };
  }

  // Backward compatibility: resolve template run-time fallback if field not set in database
  if (!page.template) {
    if (normalizedSlug === "home") {
      page.template = "home";
    } else if (normalizedSlug === "about") {
      page.template = "about";
    } else if (normalizedSlug === "contact") {
      page.template = "contact";
    } else {
      page.template = "default";
    }
  }

  const templateInfo = TEMPLATE_REGISTRY[page.template] || TEMPLATE_REGISTRY.default;

  return { page, templateInfo };
}
