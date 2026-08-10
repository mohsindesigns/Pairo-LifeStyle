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
 * Normalizes competitor brand references and URLs to Pairo.
 */
export function cleanCompetitorDetails(jsonLd) {
  if (!jsonLd) return jsonLd;
  let str = typeof jsonLd === "string" ? jsonLd : JSON.stringify(jsonLd);

  // Replace competitor names with Pairo Lifestyle
  str = str
    .replace(/Excellent Leather Shop/gi, "Pairo Lifestyle")
    .replace(/Prime Jackets/gi, "Pairo Lifestyle")
    .replace(/Jackets Junction/gi, "Pairo Lifestyle")
    .replace(/The Jacket Maker/gi, "Pairo Lifestyle")
    .replace(/The Jacket M/gi, "Pairo Lifestyle");

  // Replace competitor URLs with Pairo Lifestyle URL
  str = str
    .replace(/https?:\/\/excellentleathershop\.com/gi, SITE_URL)
    .replace(/https?:\/\/primejackets\.com/gi, SITE_URL)
    .replace(/https?:\/\/jacketsjunction\.com/gi, SITE_URL)
    .replace(/https?:\/\/thejacketmaker\.com/gi, SITE_URL)
    .replace(/\/wp-content\/uploads\/[0-9]+\/[0-9]+\//gi, "/assets/");

  try {
    return JSON.parse(str);
  } catch (e) {
    return jsonLd;
  }
}

/**
 * Normalizes a URL to ensure uniqueness.
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
 * Centrally resolves SEO metadata for storefront routes (Asynchronous).
 */
export async function resolveSEOMetadata(options = {}) {
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

  let siteConfig = null;
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      let SiteConfigModel;
      try {
        SiteConfigModel = mongoose.model("SiteConfig");
      } catch {
        SiteConfigModel = require("../models/SiteConfig").default || require("../models/SiteConfig");
      }
      siteConfig = await SiteConfigModel.findOne({ key: "main" }).lean();
    }
  } catch (err) {
    console.error("[SEO Resolver] Failed to load SiteConfig", err.message);
  }

  const brandName = siteConfig?.brand?.name || "Pairo Lifestyle";
  const brandDescription = siteConfig?.brand?.description || "Pairo Lifestyle is a premium clothing and leather apparel store dealing in custom tailored shearling coats, blazers, and jackets.";
  const logoUrl = siteConfig?.headerConfig?.logoUrl || siteConfig?.footerConfig?.logoUrl || siteConfig?.brand?.logo || siteConfig?.brand?.faviconUrl || "/assets/pairo.webp";
  const logoUrlAbsolute = logoUrl.startsWith("http") ? logoUrl : `${SITE_URL}${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`;
  const telephone = siteConfig?.brand?.whatsappNumber || siteConfig?.brand?.phone || "+1 847-999-3787";

  const heroSliderSection = entity?.sections?.find?.(s => s.type === "hero_slider");
  const sectionFirstSlideImage = heroSliderSection?.fields?.slides?.[0]?.image;
  const firstSlideImage = sectionFirstSlideImage || siteConfig?.hero?.slides?.[0]?.image || "/hero-image.png";
  const heroImageUrl = firstSlideImage.startsWith("http") ? firstSlideImage : `${SITE_URL}${firstSlideImage.startsWith("/") ? "" : "/"}${firstSlideImage}`;

  const socials = [
    "https://www.facebook.com/pairolifestyle/",
    "https://www.instagram.com/pairo.lifestyle",
    "https://www.youtube.com/@PairoLifestyle",
    "https://www.tiktok.com/@pairo.lifestyle",
    "https://x.com/Pairolifestyle"
  ];

  const orgSchema = {
    "@id": `${SITE_URL}/#organization`,
    "@type": "Organization",
    "name": brandName,
    "url": SITE_URL,
    "logo": {
      "@id": `${SITE_URL}/#logo`,
      "@type": "ImageObject",
      "caption": brandName,
      "contentUrl": logoUrlAbsolute,
      "height": 219,
      "inLanguage": "en-US",
      "url": logoUrlAbsolute,
      "width": 512
    },
    "sameAs": socials
  };

  const websiteSchema = {
    "@id": `${SITE_URL}/#website`,
    "@type": "WebSite",
    "alternateName": brandName,
    "inLanguage": "en-US",
    "name": brandName,
    "url": SITE_URL,
    "publisher": { "@id": `${SITE_URL}/#organization` }
  };

  // 1. Core Titles and Descriptions (Sanitized)
  const metaTitle = sanitizeSEOString(seo.title || entity.name || entity.title || fallbackTitle);
  const metaDescription = sanitizeSEOString(seo.description || entity.shortDescription || entity.excerpt || fallbackDesc);

  // 2. Canonical URL uniqueness & automatic fallback generation
  let canonical = seo.canonicalUrl ? seo.canonicalUrl.trim() : "";
  if (!canonical) {
    if (path) {
      canonical = path;
    } else if (type === "product" && entity.slug) {
      canonical = `/product/${entity.slug}`;
    } else if (type === "blog" && entity.slug) {
      canonical = `/blog/${entity.slug}`;
    } else if (type === "category" && entity.slug) {
      canonical = `/collections/${entity.slug}`;
    } else if (type === "page" && entity.slug) {
      canonical = `/${entity.slug}`;
    } else {
      canonical = "/";
    }
  }
  canonical = normalizeCanonicalUrl(canonical);

  // 3. Robots controls — read from CMS entity seo fields (noIndex / noFollow)
  let noIndex  = seo.noIndex  === true;
  let noFollow = seo.noFollow === true;

  if (entity.status === "Draft") {
    noIndex = true;
    noFollow = true;
  }

  // 4. OpenGraph and Twitter image fallback hierarchy
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
    structuredDataJson = cleanCompetitorDetails(parsedJsonLd);
  } else {
    // Generate fallback schemas
    if (type === "product" && entity.name) {
      const { getProductPrimaryCategorySlug } = require("./routes");
      const categorySlugRaw = getProductPrimaryCategorySlug(entity);
      const categorySlug = categorySlugRaw === 'uncategorized' ? 'shop' : categorySlugRaw;
      const prodUrl = canonical;
      const datePublished = entity.createdAt ? new Date(entity.createdAt).toISOString() : "2024-02-03T15:05:44+05:00";
      const dateModified = entity.updatedAt ? new Date(entity.updatedAt).toISOString() : new Date().toISOString();

      let categoryName = "Products";
      if (entity.primaryCategory && typeof entity.primaryCategory === 'object') {
         categoryName = entity.primaryCategory.name || "Products";
      } else if (entity.categories && entity.categories.length > 0) {
         const firstCat = entity.categories[0];
         if (firstCat && typeof firstCat === 'object') {
            categoryName = firstCat.name || "Products";
         }
      }



      const imageSchema = {
        "@id": `${prodUrl}/#primaryimage`,
        "@type": "ImageObject",
        "caption": entity.name,
        "height": 1400,
        "inLanguage": "en-US",
        "url": ogImgUrl,
        "width": 1400
      };

      const itemPageSchema = {
        "@id": `${prodUrl}/#webpage`,
        "@type": "ItemPage",
        "dateModified": dateModified,
        "datePublished": datePublished,
        "inLanguage": "en-US",
        "name": `${entity.name} | ${brandName}`,
        "url": prodUrl,
        "isPartOf": { "@id": `${SITE_URL}/#website` },
        "primaryImageOfPage": { "@id": `${prodUrl}/#primaryimage` }
      };

      const productSchema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "@id": `${canonical}#product`,
        "name": entity.name,
        "description": entity.shortDescription || metaDescription,
        "image": ogImgUrl,
        "url": prodUrl,
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
            "item": prodUrl
          }
        ]
      };

      const finalFaqList = [];
      if (entity.faqs && Array.isArray(entity.faqs) && entity.faqs.length > 0) {
        entity.faqs.forEach(faq => {
          if (faq.question && faq.answer) {
            finalFaqList.push({
              "@type": "Question",
              "name": faq.question,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer
              }
            });
          }
        });
      }

      // Query ProductQuestions asynchronously for FAQ Schema
      try {
        const mongoose = require("mongoose");
        if (mongoose.connection && mongoose.connection.readyState === 1) {
          let ProductQuestion;
          try {
            ProductQuestion = mongoose.model("ProductQuestion");
          } catch {
            ProductQuestion = require("../models/ProductQuestion").default || require("../models/ProductQuestion");
          }

          const questions = await ProductQuestion.find({
            productId: entity._id || entity.id,
            status: "Approved",
            isDeleted: false
          }).lean();

          questions
            .filter(q => q.replies && q.replies.length > 0)
            .forEach(q => {
              const firstStaffReply = q.replies.find(r => r.isStaff || r.isAdmin);
              if (firstStaffReply) {
                finalFaqList.push({
                  "@type": "Question",
                  "name": q.questionText || q.question,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": firstStaffReply.replyText || firstStaffReply.text
                  }
                });
              }
            });
        }
      } catch (e) {
        console.error("[SEO Resolver] Failed to load Product FAQs:", e.message);
      }

      let faqSchema = null;
      if (finalFaqList.length > 0) {
        faqSchema = {
          "@type": "FAQPage",
          "name": `Is the ${entity.name} available in multiple sizes?`,
          "mainEntity": finalFaqList
        };
      }

      structuredDataJson = {
        "@context": "https://schema.org",
        "@graph": [orgSchema, websiteSchema, imageSchema, itemPageSchema, productSchema, breadcrumbSchema, faqSchema].filter(Boolean)
      };
    } else if (type === "category" && entity.name) {
      const catUrl = canonical;
      const datePublished = entity.createdAt ? new Date(entity.createdAt).toISOString() : "2024-10-30T11:33:17+05:00";
      const dateModified = entity.updatedAt ? new Date(entity.updatedAt).toISOString() : new Date().toISOString();

      let collectionProducts = [];
      try {
        const mongoose = require("mongoose");
        if (mongoose.connection && mongoose.connection.readyState === 1) {
          let ProductModel;
          try {
            ProductModel = mongoose.model("Product");
          } catch {
            ProductModel = require("../models/Product").default || require("../models/Product");
          }
          collectionProducts = await ProductModel.find({
            $or: [
              { primaryCategory: entity._id || entity.id },
              { categories: entity._id || entity.id }
            ]
          }).limit(10).lean();
        }
      } catch (err) {
        console.error("[SEO Resolver] Failed to query category products", err.message);
      }



      const webpageSchema = {
        "@id": `${catUrl}/#webpage`,
        "@type": "CollectionPage",
        "datePublished": datePublished,
        "dateModified": dateModified,
        "inLanguage": "en-US",
        "name": entity.name,
        "url": catUrl,
        "about": { "@id": `${SITE_URL}/#organization` },
        "isPartOf": { "@id": `${SITE_URL}/#website` },
        "mainEntity": { "@id": `${catUrl}/#itemlist` }
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
            "item": catUrl
          }
        ]
      };

      let faqSchema = null;
      if (entity.faqSchemaCustom && entity.faqSchemaCustom.trim() !== "") {
        try {
          faqSchema = JSON.parse(entity.faqSchemaCustom);
        } catch (err) {
          console.error("[SEO Resolver] Failed to parse custom category FAQ schema:", err.message);
        }
      }
      if (!faqSchema && entity.faqs && Array.isArray(entity.faqs) && entity.faqs.length > 0) {
        faqSchema = {
          "@type": "FAQPage",
          "mainEntity": entity.faqs.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": faq.answer
            }
          }))
        };
      }

      const itemListSchema = {
        "@type": "ItemList",
        "@id": `${catUrl}/#itemlist`,
        "numberOfItems": collectionProducts.length,
        "itemListElement": collectionProducts.map((prod, idx) => ({
          "@type": "ListItem",
          "position": idx + 1,
          "item": {
            "@type": "Product",
            "name": prod.name,
            "url": `${SITE_URL}/product/${prod.slug}`,
            "image": prod.images?.[0] || prod.image,
            "offers": {
              "@type": "Offer",
              "price": prod.price || 0,
              "priceCurrency": "USD",
              "availability": prod.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
            }
          }
        }))
      };

      structuredDataJson = {
        "@context": "https://schema.org",
        "@graph": [orgSchema, websiteSchema, webpageSchema, breadcrumbSchema, faqSchema, itemListSchema].filter(Boolean)
      };
    } else if (type === "blog" && entity.title) {
      const postUrl = canonical;
      const articleId = `${postUrl}/#article`;
      const primaryImageId = `${postUrl}/#primaryimage`;
      const datePublished = (entity.publishedAt || entity.createdAt) ? new Date(entity.publishedAt || entity.createdAt).toISOString() : new Date().toISOString();
      const dateModified = entity.updatedAt ? new Date(entity.updatedAt).toISOString() : datePublished;
      const authorName = entity.author || "Pairo Studio";
      const authorId = `${SITE_URL}/#/schema/person/${Buffer.from(authorName).toString('hex').slice(0, 16)}`;

      const articleSchema = {
        "@id": articleId,
        "@type": "Article",
        "articleSection": entity.category || "Style & Care",
        "commentCount": 0,
        "dateModified": dateModified,
        "datePublished": datePublished,
        "headline": entity.title,
        "inLanguage": "en-US",
        "thumbnailUrl": ogImgUrl,
        "wordCount": entity.wordCount || 1200,
        "author": {
          "@id": authorId,
          "name": authorName,
          "image": { "@id": primaryImageId }
        },
        "isPartOf": { "@id": postUrl },
        "mainEntityOfPage": { "@id": postUrl },
        "potentialAction": {
          "@type": "CommentAction",
          "name": "Comment",
          "target": `${postUrl}#respond`
        },
        "publisher": { "@id": `${SITE_URL}/#organization` }
      };

      const webpageSchema = {
        "@id": postUrl,
        "@type": "WebPage",
        "dateModified": dateModified,
        "datePublished": datePublished,
        "description": entity.excerpt || metaDescription,
        "inLanguage": "en-US",
        "name": `${entity.title} - ${brandName} Journal`,
        "thumbnailUrl": ogImgUrl,
        "url": postUrl,
        "breadcrumb": { "@id": `${postUrl}/#breadcrumb` },
        "image": { "@id": primaryImageId },
        "isPartOf": { "@id": `${SITE_URL}/#website` },
        "potentialAction": {
          "@type": "ReadAction",
          "target": postUrl
        },
        "primaryImageOfPage": { "@id": primaryImageId }
      };

      const imageSchema = {
        "@id": primaryImageId,
        "@type": "ImageObject",
        "caption": entity.title,
        "contentUrl": ogImgUrl,
        "height": 628,
        "inLanguage": "en-US",
        "url": ogImgUrl,
        "width": 1200
      };

      const breadcrumbSchema = {
        "@id": `${postUrl}/#breadcrumb`,
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": `${SITE_URL}/`
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": entity.title,
            "item": postUrl
          }
        ]
      };



      const personSchema = {
        "@id": authorId,
        "@type": "Person",
        "description": `Editorial and fashion contributor at ${brandName}.`,
        "name": authorName,
        "image": {
          "@id": `${SITE_URL}/#/schema/person/image/`,
          "@type": "ImageObject",
          "caption": authorName,
          "contentUrl": logoUrlAbsolute,
          "inLanguage": "en-US",
          "url": logoUrlAbsolute
        }
      };

      let faqSchema = null;
      if (entity.faqs && Array.isArray(entity.faqs) && entity.faqs.length > 0) {
        faqSchema = {
          "@type": "FAQPage",
          "mainEntity": entity.faqs.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": faq.answer
            }
          }))
        };
      }

      structuredDataJson = {
        "@context": "https://schema.org",
        "@graph": [articleSchema, webpageSchema, imageSchema, breadcrumbSchema, websiteSchema, orgSchema, personSchema, faqSchema].filter(Boolean)
      };
    } else if (type === "home" || path === "/" || path === "/home") {
      const pageId = `${SITE_URL}/`;
      const datePublished = entity.createdAt ? new Date(entity.createdAt).toISOString() : "2025-08-18T09:21:09+00:00";
      const dateModified = entity.updatedAt ? new Date(entity.updatedAt).toISOString() : "2026-07-03T17:14:58+00:00";
      const pageDesc = metaDescription || brandDescription;

      const webpageSchema = {
        "@id": pageId,
        "@type": "WebPage",
        "dateModified": dateModified,
        "datePublished": datePublished,
        "description": pageDesc,
        "inLanguage": "en-US",
        "name": metaTitle || `${brandName} | Premium Handcrafted Outerwear`,
        "thumbnailUrl": heroImageUrl,
        "url": pageId,
        "about": { "@id": `${SITE_URL}/#organization` },
        "breadcrumb": { "@id": `${SITE_URL}/#breadcrumb` },
        "image": { "@id": `${SITE_URL}/#primaryimage` },
        "isPartOf": { "@id": `${SITE_URL}/#website` },
        "potentialAction": {
          "@type": "ReadAction",
          "target": pageId
        },
        "primaryImageOfPage": { "@id": `${SITE_URL}/#primaryimage` }
      };

      const primaryImageSchema = {
        "@id": `${SITE_URL}/#primaryimage`,
        "@type": "ImageObject",
        "contentUrl": heroImageUrl,
        "height": 916,
        "inLanguage": "en-US",
        "url": heroImageUrl,
        "width": 1717
      };

      const breadcrumbSchema = {
        "@id": `${SITE_URL}/#breadcrumb`,
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": pageId
          }
        ]
      };



      structuredDataJson = {
        "@context": "https://schema.org",
        "@graph": [webpageSchema, primaryImageSchema, breadcrumbSchema, websiteSchema, orgSchema]
      };
    } else if (type === "shop" || path === "/shop") {


      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "@id": `${SITE_URL}/shop/#breadcrumb`,
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
            "name": "Shop",
            "item": `${SITE_URL}/shop`
          }
        ]
      };

      const shopSchema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": `${SITE_URL}/shop/#webpage`,
        "name": `Shop - ${brandName}`,
        "url": `${SITE_URL}/shop`,
        "breadcrumb": {
          "@id": `${SITE_URL}/shop/#breadcrumb`
        },
        "isPartOf": {
          "@id": `${SITE_URL}/#website`
        }
      };

      structuredDataJson = {
        "@context": "https://schema.org",
        "@graph": [orgSchema, websiteSchema, breadcrumbSchema, shopSchema]
      };
    } else if (type === "blog_list" || path === "/blog") {
      const pageUrl = `${SITE_URL}/blog`;
      const datePublished = "2025-04-28T06:51:14+00:00";
      const dateModified = new Date().toISOString();



      const webpageSchema = {
        "@id": `${pageUrl}/`,
        "@type": "WebPage",
        "dateModified": dateModified,
        "datePublished": datePublished,
        "inLanguage": "en-US",
        "name": `Blogs | ${brandName}`,
        "url": pageUrl,
        "breadcrumb": { "@id": `${pageUrl}/#breadcrumb` },
        "isPartOf": { "@id": `${SITE_URL}/#website` },
        "potentialAction": {
          "@type": "ReadAction",
          "target": pageUrl
        }
      };

      const breadcrumbSchema = {
        "@id": `${pageUrl}/#breadcrumb`,
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": `${SITE_URL}/`
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Blogs",
            "item": pageUrl
          }
        ]
      };

      structuredDataJson = {
        "@context": "https://schema.org",
        "@graph": [websiteSchema, orgSchema, webpageSchema, breadcrumbSchema]
      };
    } else if (type === "contact" || path === "/contact") {
      const contactSchema = {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        "@id": `${SITE_URL}/contact#webpage`,
        "name": "Contact Pairo - Direct Concierge Line",
        "description": "Get in touch with Pairo Lifestyle atelier for bespoke fittings, sizing advice, and order inquiries.",
        "url": `${SITE_URL}/contact`
      };

      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
          { "@type": "ListItem", "position": 2, "name": "Contact", "item": `${SITE_URL}/contact` }
        ]
      };

      structuredDataJson = {
        "@context": "https://schema.org",
        "@graph": [contactSchema, breadcrumbSchema, websiteSchema, orgSchema]
      };
    } else if (type === "about" || path === "/about") {
      const aboutSchema = {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        "@id": `${SITE_URL}/about#webpage`,
        "name": "About Pairo Lifestyle - Artisanal Shearling Heritage",
        "description": "Discover Pairo's journey in crafting the future of modern elegance, bridging heritage craftsmanship and contemporary design.",
        "url": `${SITE_URL}/about`
      };

      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
          { "@type": "ListItem", "position": 2, "name": "About", "item": `${SITE_URL}/about` }
        ]
      };

      structuredDataJson = {
        "@context": "https://schema.org",
        "@graph": [aboutSchema, breadcrumbSchema, websiteSchema, orgSchema]
      };
    } else if (type === "faq" || path === "/faq") {
      const faqPageSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is Pairo Lifestyle's estimated delivery time?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Our handcrafted pieces are made-to-order. The estimated delivery time is between 15–20 working days."
            }
          },
          {
            "@type": "Question",
            "name": "Do you support custom/bespoke configurations?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes, we support extensive bespoke modifications including custom leather types, colors, hardware finishes, fur accents, and branding uploads."
            }
          }
        ]
      };

      structuredDataJson = {
        "@context": "https://schema.org",
        "@graph": [faqPageSchema, websiteSchema, orgSchema]
      };
    } else if (type === "search") {
      const searchSchema = {
        "@context": "https://schema.org",
        "@type": "SearchResultsPage",
        "name": "Search Results",
        "url": `${SITE_URL}/search`
      };

      structuredDataJson = {
        "@context": "https://schema.org",
        "@graph": [searchSchema, websiteSchema, orgSchema]
      };
    }

    if (!structuredDataJson) {
      const pageUrl = canonical;
      const pageId = `${pageUrl}/#webpage`;

      const webpageSchema = {
        "@id": pageId,
        "@type": "WebPage",
        "inLanguage": "en-US",
        "name": metaTitle,
        "description": metaDescription,
        "url": pageUrl,
        "about": { "@id": `${SITE_URL}/#organization` },
        "isPartOf": { "@id": `${SITE_URL}/#website` }
      };

      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
          { "@type": "ListItem", "position": 2, "name": metaTitle, "item": pageUrl }
        ]
      };

      structuredDataJson = {
        "@context": "https://schema.org",
        "@graph": [orgSchema, websiteSchema, webpageSchema, breadcrumbSchema]
      };
    }
  }

  // Next.js App Router metadata format
  // Use a plain string for robots — object format causes duplicate tags in Next.js.
  // String is passed directly as meta content: zero risk of duplication or key conflicts.

  const isGlobalNoIndex = siteConfig?.disableSearchEngineIndexing === true;
  const isNoIndex = noIndex || noFollow || isGlobalNoIndex;
  const robots = isNoIndex
    ? "noindex, nofollow"
    : "index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1";

  const metadata = {
    title: metaTitle,
    description: metaDescription,
    alternates: {
      canonical: canonical,
    },
    robots,
    openGraph,
    twitter,
  };

  return {
    metadata,
    structuredData: structuredDataJson
  };
}
