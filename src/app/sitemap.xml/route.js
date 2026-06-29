import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import Blog from "@/models/Blog";
import Category from "@/models/Category";
import Page from "@/models/Page";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Cache on Next.js side for 1 hour

export async function GET() {
  await dbConnect();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pairolifestyle.com";

  try {
    // 1. Fetch products (Published, not deleted, not noIndexed)
    const products = await Product.find(
      { isDeleted: { $ne: true }, status: "Published", "seo.noIndex": { $ne: true } },
      "slug updatedAt primaryCategory categories"
    ).populate('categories').populate('primaryCategory').lean();

    // 2. Fetch blogs
    const blogs = await Blog.find(
      { isDeleted: { $ne: true }, status: "Published", "seo.noIndex": { $ne: true } },
      "slug updatedAt"
    ).lean();

    // 3. Fetch categories
    const categories = await Category.find(
      { isDeleted: { $ne: true }, status: "Published", "seo.noIndex": { $ne: true }, type: "product" },
      "slug updatedAt"
    ).lean();

    // 4. Fetch dynamic CMS pages
    const pages = await Page.find(
      { tenantId: "DEFAULT_STORE", status: "Published", "seo.noIndex": { $ne: true } },
      "slug updatedAt"
    ).lean();

    // Static pages
    const staticPages = [
      { path: "", changefreq: "daily", priority: 1.0 },
      { path: "/shop", changefreq: "daily", priority: 0.9 },
      { path: "/blog", changefreq: "weekly", priority: 0.7 }
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
    xml += `\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Add static pages
    for (const page of staticPages) {
      xml += `
  <url>
    <loc>${siteUrl}${page.path}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    }

    // Add products
    for (const prod of products) {
      if (prod.slug) {
        const { getProductPrimaryCategorySlug } = require("@/lib/routes");
        const categorySlugRaw = getProductPrimaryCategorySlug(prod);
        const categorySlug = categorySlugRaw === 'uncategorized' ? 'shop' : categorySlugRaw;
        xml += `
  <url>
    <loc>${siteUrl}/${categorySlug}/${prod.slug}</loc>
    <lastmod>${prod.updatedAt ? new Date(prod.updatedAt).toISOString() : new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
      }
    }

    // Add categories
    for (const cat of categories) {
      if (cat.slug) {
        xml += `
  <url>
    <loc>${siteUrl}/${cat.slug}</loc>
    <lastmod>${cat.updatedAt ? new Date(cat.updatedAt).toISOString() : new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
      }
    }

    // Add blogs
    for (const post of blogs) {
      if (post.slug) {
        xml += `
  <url>
    <loc>${siteUrl}/blog/${post.slug}</loc>
    <lastmod>${post.updatedAt ? new Date(post.updatedAt).toISOString() : new Date().toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
      }
    }

    // Add CMS pages
    for (const page of pages) {
      if (page.slug && page.slug !== "home") {
        xml += `
  <url>
    <loc>${siteUrl}/${page.slug}</loc>
    <lastmod>${page.updatedAt ? new Date(page.updatedAt).toISOString() : new Date().toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;
      }
    }

    xml += `\n</urlset>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=60"
      }
    });
  } catch (error) {
    console.error("[Sitemap Generator] Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
