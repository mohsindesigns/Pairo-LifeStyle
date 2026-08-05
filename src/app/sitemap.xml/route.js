import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import Blog from "@/models/Blog";
import Category from "@/models/Category";
import Page from "@/models/Page";
import SiteConfig from "@/models/SiteConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable caching on Next.js side so it is always live

function normalizeSitemapUrl(domain, type, slug) {
  let cleanSlug = slug ? slug.trim().replace(/^\/+|\/+$/g, "") : "";

  if (type === "product" && cleanSlug.startsWith("product/")) {
    cleanSlug = cleanSlug.replace(/^product\//, "");
  }
  if (type === "blog" && cleanSlug.startsWith("blog/")) {
    cleanSlug = cleanSlug.replace(/^blog\//, "");
  }
  if (type === "collections" && (cleanSlug.startsWith("collections/") || cleanSlug.startsWith("category/"))) {
    cleanSlug = cleanSlug.replace(/^(collections|category)\//, "");
  }
  if (type === "shop" && cleanSlug.startsWith("shop/")) {
    cleanSlug = cleanSlug.replace(/^shop\//, "");
  }

  const parts = cleanSlug.split("/");
  if (parts.length === 2 && parts[0] === parts[1]) {
    cleanSlug = parts[0];
  }

  let path = "";
  if (type === "product") {
    path = `/product/${cleanSlug}`;
  } else if (type === "blog") {
    path = `/blog/${cleanSlug}`;
  } else if (type === "collections") {
    path = `/collections/${cleanSlug}`;
  } else if (type === "shop") {
    path = `/shop/${cleanSlug}`;
  } else if (type === "static") {
    path = cleanSlug ? `/${cleanSlug}` : "";
  } else {
    path = `/${cleanSlug}`;
  }

  const absoluteUrl = `${domain}${path}`;

  try {
    const urlObj = new URL(absoluteUrl);
    let pathname = urlObj.pathname.replace(/\/+/g, "/");
    if (pathname.endsWith("/") && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }
    return `${urlObj.protocol}//${urlObj.host}${pathname}`;
  } catch (e) {
    return absoluteUrl;
  }
}

export async function GET() {
  await dbConnect();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pairolifestyle.com";

  try {
    // Check global indexing toggle
    const siteConfig = await SiteConfig.findOne({ key: 'main' }).lean();
    const isGlobalNoIndex = siteConfig?.disableSearchEngineIndexing === true;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
    xml += `\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    if (!isGlobalNoIndex) {
      // 1. Fetch products (Published, not deleted, not noIndexed)
      const products = await Product.find(
        { isDeleted: { $ne: true }, status: "Published", "seo.noIndex": { $ne: true } },
        "slug updatedAt"
      ).lean();

      // 2. Fetch blogs (Published, not deleted, not noIndexed)
      const blogs = await Blog.find(
        { isDeleted: { $ne: true }, status: "Published", "seo.noIndex": { $ne: true } },
        "slug updatedAt"
      ).lean();

      // 3. Fetch categories (Published, not deleted, not noIndexed)
      const categories = await Category.find(
        { isDeleted: { $ne: true }, status: "Published", "seo.noIndex": { $ne: true }, type: "product" },
        "slug updatedAt"
      ).lean();

      // 4. Fetch dynamic CMS pages (Published, not deleted, not noIndexed)
      const pages = await Page.find(
        { tenantId: "DEFAULT_STORE", status: "Published", isDeleted: { $ne: true }, "seo.noIndex": { $ne: true } },
        "slug updatedAt"
      ).lean();

      const urlMap = new Map();

      // Helper to add unique URLs
      function addUrl(type, slug, lastmod = null, changefreq = "weekly", priority = 0.5) {
        if (slug === undefined || slug === null) return;
        const normalized = normalizeSitemapUrl(siteUrl, type, slug);
        if (!urlMap.has(normalized)) {
          urlMap.set(normalized, {
            loc: normalized,
            lastmod: lastmod ? new Date(lastmod).toISOString() : new Date().toISOString(),
            changefreq,
            priority
          });
        }
      }

      // Add URLs dynamically from SiteConfig headerConfig navItems (no hardcoded links!)
      if (siteConfig?.headerConfig?.navItems) {
        siteConfig.headerConfig.navItems.forEach(item => {
          if (item.enabled !== false) {
            const pathValue = item.href || item.value;
            if (pathValue && !pathValue.startsWith('http') && !pathValue.startsWith('#') && !pathValue.includes(':')) {
              const cleanSlug = pathValue.replace(/^\/+|\/+$/g, "");
              let priority = 0.5;
              let changefreq = "weekly";
              if (cleanSlug === "") {
                priority = 1.0;
                changefreq = "daily";
              } else if (cleanSlug === "shop") {
                priority = 0.9;
                changefreq = "daily";
              } else if (cleanSlug === "blog") {
                priority = 0.7;
                changefreq = "weekly";
              }
              // Skip dynamic sub-resources which are loaded below
              if (
                !cleanSlug.startsWith("product/") &&
                !cleanSlug.startsWith("collections/") &&
                !cleanSlug.startsWith("category/") &&
                !cleanSlug.startsWith("blog/")
              ) {
                addUrl("static", cleanSlug, siteConfig.updatedAt || null, changefreq, priority);
              }
            }
          }
        });
      }

      // Ensure root URL / home page is always included (derived dynamically)
      addUrl("static", "", siteConfig?.updatedAt || null, "daily", 1.0);

      // Add products
      for (const prod of products) {
        addUrl("product", prod.slug, prod.updatedAt, "weekly", 0.8);
      }

      // Add categories
      for (const cat of categories) {
        addUrl("collections", cat.slug, cat.updatedAt, "weekly", 0.7);
      }

      // Add blogs
      for (const post of blogs) {
        addUrl("blog", post.slug, post.updatedAt, "monthly", 0.6);
      }

      // Add CMS pages (excluding core paths and test pages)
      for (const page of pages) {
        const cleanSlug = page.slug ? page.slug.toLowerCase().trim() : "";
        if (
          cleanSlug &&
          !["home", "shop", "blog", "collections", "sitemap", "test", "temp"].includes(cleanSlug) &&
          !cleanSlug.includes("test") &&
          !cleanSlug.includes("temp")
        ) {
          addUrl("page", page.slug, page.updatedAt, "monthly", 0.5);
        }
      }

      // Append XML tags
      for (const item of urlMap.values()) {
        xml += `
  <url>
    <loc>${item.loc}</loc>
    <lastmod>${item.lastmod}</lastmod>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`;
      }
    }

    xml += `\n</urlset>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
      }
    });
  } catch (error) {
    console.error("[Sitemap Generator] Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

