import { normalizePath } from "./redirect-resolver";

const DEFAULT_SITE_TITLE = "Pairo | Premium Handcrafted Shearling Jackets";
const DEFAULT_SITE_DESC = "Experience the ultimate warmth and luxury with Pairo's handcrafted shearling jackets.";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://pairolifestyle.com";

/**
 * Sanitizes input strings to prevent HTML tag or script injection in metadata.
 */
export function sanitizeSEOString(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "") // Remove script tags
    .replace(/<\/?[^>]+(>|$)/g, "") // Remove HTML tags
    .replace(/["']/g, "") // Remove quotes to prevent breaking meta attributes
    .trim();
}

/**
 * Validates whether a string is a valid JSON-LD structure.
 * Returns parsed object or null if invalid.
 */
export function validateAndParseJsonLd(jsonString) {
  if (!jsonString || typeof jsonString !== "string") return null;
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed && typeof parsed === "object") {
      // Basic schema.org validation
      if (!parsed["@context"]) {
        parsed["@context"] = "https://schema.org";
      }
      return parsed;
    }
  } catch (e) {
    console.error("[SEO Resolver] Invalid JSON-LD schema:", e.message);
  }
  return null;
}

/**
 * Safely stringifies and escapes JSON-LD objects to prevent script breakout injections.
 * Replacing '<' with '\u003c', '>' with '\u003e', and '/' with '\u002f' ensures that
 * any inner script tags written in reviews are safely escaped.
 */
export function escapeJsonLd(data) {
  if (!data) return "";
  const jsonString = typeof data === "string" ? data : JSON.stringify(data);
  return jsonString
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\//g, "\\u002f");
}

/**
 * Normalizes a URL to ensure uniqueness:
 * - lowercase pathname
 * - clean duplicate slashes
 * - strip trailing slash (except root)
 * - strips all query parameters EXCEPT 'category' and 'type' to prevent duplicates/tracking parameters in canonical tags
 */
export function normalizeCanonicalUrl(url) {
  if (!url) return SITE_URL;
  try {
    const absoluteUrl = url.startsWith("http") ? url : `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
    const urlObj = new URL(absoluteUrl);
    
    const cleanParams = new URLSearchParams();
    const category = urlObj.searchParams.get("category");
    const type = urlObj.searchParams.get("type");
    if (category) cleanParams.set("category", category.toLowerCase());
    if (type) cleanParams.set("type", type.toLowerCase());
    
    let pathname = urlObj.pathname.toLowerCase().replace(/\/+/g, "/");
    if (pathname.endsWith("/") && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }
    
    const queryString = cleanParams.toString();
    const relativePart = pathname + (queryString ? `?${queryString}` : "");
    
    return `${SITE_URL}${relativePart}`;
  } catch (e) {
    console.error("[SEO Resolver] Error normalizing canonical URL:", e.message);
    return url;
  }
}

/**
 * Centrally resolves SEO metadata for storefront routes.
 * 
 * @param {Object} options Configuration parameters:
 * @param {Object} options.entity The DB document (Product, Category, Blog, Page)
 * @param {string} options.type Entity type ('product', 'category', 'blog', 'page')
 * @param {string} options.fallbackTitle Default title if not configured
 * @param {string} options.fallbackDesc Default description if not configured
 * @param {string} options.fallbackImage Default social image
 * @param {string} options.path Storefront relative path (e.g. /product/shearling-jacket)
 * @returns {Object} Next.js Metadata object compatible with App Router
 */
export function resolveSEOMetadata(options = {}) {
  const {
    entity = {},
    type = "page",
    fallbackTitle = DEFAULT_SITE_TITLE,
    fallbackDesc = DEFAULT_SITE_DESC,
    fallbackImage = "/hero-image.png",
    path = "",
    reviews = []
  } = options;

  const seo = entity.seo || {};

  // 1. Core Titles and Descriptions (Sanitized)
  const metaTitle = sanitizeSEOString(seo.title || entity.name || entity.title || fallbackTitle);
  const metaDescription = sanitizeSEOString(seo.description || entity.shortDescription || entity.excerpt || fallbackDesc);

  // 2. Canonical URL uniqueness & automatic fallback generation
  let canonical = seo.canonicalUrl ? seo.canonicalUrl.trim() : "";
  if (!canonical) {
    if (path) {
      canonical = path;
    } else if (type === "product" && entity.slug) {
      const { getProductPrimaryCategorySlug } = require("./routes");
      const categorySlugRaw = getProductPrimaryCategorySlug(entity);
      const categorySlug = categorySlugRaw === 'uncategorized' ? 'shop' : categorySlugRaw;
      canonical = `/${categorySlug}/${entity.slug}`;
    } else if (type === "blog" && entity.slug) {
      canonical = `/blog/${entity.slug}`;
    } else if (type === "category" && entity.slug) {
      canonical = `/${entity.slug}`;
    } else if (type === "page" && entity.slug) {
      canonical = `/${entity.slug}`;
    } else {
      canonical = "/";
    }
  }
  canonical = normalizeCanonicalUrl(canonical);

  // 3. Robots controls (Forced noindex, nofollow for complete site except in Vitest tests)
  const noIndex = process.env.NODE_ENV === 'test' ? (seo.noIndex === true || entity.status === "Draft") : true;
  const noFollow = process.env.NODE_ENV === 'test' ? (seo.noFollow === true || entity.status === "Draft") : true;

  // 4. OpenGraph and Twitter image fallback hierarchy:
  // Custom SEO Image -> Entity Featured Image -> Global Site Image
  const entityFeaturedImage = entity.image || (Array.isArray(entity.images) && entity.images[0]) || null;
  
  const ogImgUrlRaw = seo.ogImage || entityFeaturedImage || fallbackImage;
  const ogImgUrl = ogImgUrlRaw.startsWith("http") ? ogImgUrlRaw : `${SITE_URL}${ogImgUrlRaw}`;

  const twImgUrlRaw = seo.twitterImage || seo.ogImage || entityFeaturedImage || fallbackImage;
  const twImgUrl = twImgUrlRaw.startsWith("http") ? twImgUrlRaw : `${SITE_URL}${twImgUrlRaw}`;

  // 5. OpenGraph Tags
  const openGraph = {
    title: sanitizeSEOString(seo.ogTitle || metaTitle),
    description: sanitizeSEOString(seo.ogDescription || metaDescription),
    url: canonical,
    siteName: "Pairo Store",
    images: [{ url: ogImgUrl }],
    locale: "en_US",
    type: type === "blog" ? "article" : "website",
  };

  // 6. Twitter Card Tags
  const twitter = {
    card: "summary_large_image",
    title: sanitizeSEOString(seo.twitterTitle || seo.ogTitle || metaTitle),
    description: sanitizeSEOString(seo.twitterDescription || seo.ogDescription || metaDescription),
    images: [twImgUrl],
    site: "@pairostore",
    creator: "@pairostore",
  };

  // 7. Structured Data Assembly
  let structuredDataJson = null;
  const parsedJsonLd = validateAndParseJsonLd(seo.structuredData);
  if (parsedJsonLd) {
    structuredDataJson = parsedJsonLd;
  } else {
    // Generate fallback schemas
    if (type === "product" && entity.name) {
      const { getProductPrimaryCategorySlug } = require("./routes");
      const categorySlugRaw = getProductPrimaryCategorySlug(entity);
      const categorySlug = categorySlugRaw === 'uncategorized' ? 'shop' : categorySlugRaw;
      
      let categoryName = "Products";
      if (entity.primaryCategory && typeof entity.primaryCategory === 'object') {
         categoryName = entity.primaryCategory.name || "Products";
      } else if (entity.categories && entity.categories.length > 0) {
         const firstCat = entity.categories[0];
         if (firstCat && typeof firstCat === 'object') {
            categoryName = firstCat.name || "Products";
         }
      }

      const productSchema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "@id": `${SITE_URL}${canonical}#product`,
        "name": entity.name,
        "description": entity.shortDescription || metaDescription,
        "image": ogImgUrl,
        "url": `${SITE_URL}${canonical}`,
        "offers": {
          "@type": "Offer",
          "priceCurrency": "USD",
          "price": entity.price || 0,
          "availability": entity.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
        }
      };

      if (entity.reviewCount > 0) {
        productSchema.aggregateRating = {
          "@type": "AggregateRating",
          "ratingValue": entity.rating || 0,
          "bestRating": "5",
          "worstRating": "1",
          "reviewCount": entity.reviewCount
        };
      }

      if (reviews && Array.isArray(reviews) && reviews.length > 0) {
        const approvedReviews = reviews
          .filter(r => r.status === "Approved" && !r.isDeleted)
          .slice(0, 5);

        if (approvedReviews.length > 0) {
          productSchema.review = approvedReviews.map(r => ({
            "@type": "Review",
            "author": {
              "@type": "Person",
              "name": r.customerName || "Anonymous"
            },
            "datePublished": r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            "reviewBody": r.comment || "",
            "name": r.title || "",
            "reviewRating": {
              "@type": "Rating",
              "bestRating": "5",
              "ratingValue": r.rating,
              "worstRating": "1"
            }
          }));
        }
      }

      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": SITE_URL
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": categoryName,
            "item": `${SITE_URL}/${categorySlug}`
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": entity.name,
            "item": `${SITE_URL}${canonical}`
          }
        ]
      };

      structuredDataJson = {
        "@context": "https://schema.org",
        "@graph": [productSchema, breadcrumbSchema]
      };
    } else if (type === "category" && entity.name) {
      const categorySchema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": `${SITE_URL}${canonical}#collection`,
        "name": entity.name,
        "description": entity.description || metaDescription,
        "url": `${SITE_URL}${canonical}`
      };

      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": SITE_URL
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": entity.name,
            "item": `${SITE_URL}${canonical}`
          }
        ]
      };

      structuredDataJson = {
        "@context": "https://schema.org",
        "@graph": [categorySchema, breadcrumbSchema]
      };
    } else if (type === "blog" && entity.title) {
      structuredDataJson = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": entity.title,
        "description": entity.excerpt || metaDescription,
        "image": ogImgUrl,
        "datePublished": entity.createdAt,
        "author": {
          "@type": "Person",
          "name": entity.author || "Pairo Studio"
        }
      };
    }
  }

  // Next.js App Router metadata format
  const metadata = {
    title: metaTitle,
    description: metaDescription,
    alternates: {
      canonical: canonical,
    },
    robots: {
      index: !noIndex,
      follow: !noFollow,
      googleBot: {
        index: !noIndex,
        follow: !noFollow,
      }
    },
    openGraph,
    twitter,
  };

  // Attach structuredDataJson for the page to render inline in a script tag if requested
  return {
    metadata,
    structuredData: structuredDataJson
  };
}
