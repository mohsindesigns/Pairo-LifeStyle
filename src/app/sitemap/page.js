import Link from "next/link";
import { ChevronRight } from "lucide-react";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import Blog from "@/models/Blog";
import Category from "@/models/Category";
import Page from "@/models/Page";
import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { metadata } = await resolveSEOMetadata({
    entity: {},
    type: "page",
    fallbackTitle: "Sitemap | Pairo Store",
    fallbackDesc: "Browse the complete directory of Pairo Store — premium shearling outerwear, categories, editorial stories, and information.",
    path: "/sitemap"
  });
  return metadata;
}

export default async function SitemapPage() {
  await dbConnect();

  // 1. Fetch categories (Published, not deleted, product type, not noIndexed)
  const categories = await Category.find({
    status: "Published",
    isDeleted: { $in: [false, null] },
    type: "product",
    "seo.noIndex": { $ne: true }
  })
    .sort({ name: 1 })
    .lean();

  // 2. Fetch products (Published, not deleted, not noIndexed)
  const products = await Product.find({
    status: "Published",
    isDeleted: { $ne: true },
    "seo.noIndex": { $ne: true }
  })
    .sort({ name: 1 })
    .lean();

  // 3. Fetch blogs (Published, not deleted, not noIndexed)
  const blogs = await Blog.find({
    status: "Published",
    isDeleted: { $ne: true },
    "seo.noIndex": { $ne: true }
  })
    .sort({ createdAt: -1 })
    .lean();

  // 4. Fetch dynamic CMS pages (Published, not deleted, not noIndexed)
  const cmsPages = await Page.find({
    status: "Published",
    tenantId: "DEFAULT_STORE",
    isDeleted: { $ne: true },
    "seo.noIndex": { $ne: true }
  })
    .sort({ title: 1 })
    .lean();

  // Filter CMS pages to avoid duplicates with static core routes and test pages
  const filteredCmsPages = cmsPages.filter(
    (p) => p.slug && 
           !["home", "shop", "blog", "collections", "sitemap", "test", "temp"].includes(p.slug.toLowerCase().trim()) &&
           !p.slug.toLowerCase().includes("test") &&
           !p.slug.toLowerCase().includes("temp")
  );


  // Generate dynamic Schema structured data
  const seoRes = await resolveSEOMetadata({
    entity: {},
    type: "page",
    fallbackTitle: "Sitemap | Pairo Store",
    fallbackDesc: "Browse the complete directory of Pairo Store — premium shearling outerwear, categories, editorial stories, and information.",
    path: "/sitemap"
  });

  const structuredData = seoRes?.structuredData || {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Sitemap | Pairo Store",
    "description": "Browse the complete directory of Pairo Store — premium shearling outerwear, categories, editorial stories, and information.",
    "url": `${process.env.NEXT_PUBLIC_SITE_URL || "https://pairolifestyle.com"}/sitemap`
  };

  return (
    <div 
      className="min-h-screen text-black bg-white"
      style={{ backgroundColor: "var(--background)", color: "black", fontFamily: "var(--body-font)" }}
    >
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(structuredData) }}
        />
      )}

      {/* Header/Hero Section */}
      <div className="border-b border-black/[0.08]" style={{ backgroundColor: "white" }}>
        <div className="container mx-auto px-4 sm:px-6 md:px-16 py-12 md:py-16">
          {/* Breadcrumb */}
          <nav 
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] mb-6"
            style={{ color: "black" }}
          >
            <Link href="/" className="hover:opacity-75 transition-opacity text-black">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-black/50" />
            <span className="text-black">Sitemap</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <p 
                className="text-[10px] font-black uppercase tracking-[0.35em] text-black"
                style={{ fontFamily: "var(--body-font)" }}
              >
                Directory
              </p>
              <h1 
                className="text-[22px] md:text-[30px] font-extrabold tracking-tight uppercase leading-none text-black"
                style={{ fontFamily: "var(--brand-font)" }}
              >
                OUR SITEMAP
              </h1>
            </div>
            <p 
              className="text-xs sm:text-sm max-w-md leading-relaxed text-black/60"
            >
              Browse all pages, collections, premium outerwear products, and editorial journal stories across our digital storefront.
            </p>
          </div>
        </div>
      </div>

      {/* Directory Grid */}
      <div className="container mx-auto px-4 sm:px-6 md:px-16 py-12 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-16">
          
          {/* Column 1: Core Navigation & Info */}
          <div className="space-y-6">
            <h2 
              className="text-[12px] font-extrabold uppercase tracking-[0.25em] text-black border-b border-black/[0.08] pb-3"
              style={{ fontFamily: "var(--brand-font)" }}
            >
              Information
            </h2>
            <ul className="space-y-3.5">
              <li>
                <Link 
                  href="/" 
                  className="group flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-black/70 hover:text-black transition-colors"
                >
                  <span className="group-hover:underline decoration-1 underline-offset-4">Home</span>
                  <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </Link>
              </li>
              <li>
                <Link 
                  href="/shop" 
                  className="group flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-black/70 hover:text-black transition-colors"
                >
                  <span className="group-hover:underline decoration-1 underline-offset-4">Shop All</span>
                  <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </Link>
              </li>
              <li>
                <Link 
                  href="/collections" 
                  className="group flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-black/70 hover:text-black transition-colors"
                >
                  <span className="group-hover:underline decoration-1 underline-offset-4">Collections</span>
                  <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </Link>
              </li>
              <li>
                <Link 
                  href="/blog" 
                  className="group flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-black/70 hover:text-black transition-colors"
                >
                  <span className="group-hover:underline decoration-1 underline-offset-4">Editorial Journal</span>
                  <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </Link>
              </li>
              {filteredCmsPages.map((page) => (
                <li key={page._id.toString()}>
                  <Link 
                    href={`/${page.slug}`} 
                    className="group flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-black/70 hover:text-black transition-colors"
                  >
                    <span className="group-hover:underline decoration-1 underline-offset-4">
                      {page.title}
                    </span>
                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: Collections / Categories */}
          <div className="space-y-6">
            <h2 
              className="text-[12px] font-extrabold uppercase tracking-[0.25em] text-black border-b border-black/[0.08] pb-3"
              style={{ fontFamily: "var(--brand-font)" }}
            >
              Collections
            </h2>
            {categories.length === 0 ? (
              <p className="text-[11px] text-neutral-400 italic">No collections found.</p>
            ) : (
              <ul className="space-y-3.5">
                {categories.map((cat) => (
                  <li key={cat._id.toString()}>
                    <Link 
                      href={`/collections/${cat.slug}`} 
                      className="group flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-black/70 hover:text-black transition-colors"
                    >
                      <span className="group-hover:underline decoration-1 underline-offset-4">
                        {cat.name}
                      </span>
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Column 3: Products */}
          <div className="space-y-6">
            <h2 
              className="text-[12px] font-extrabold uppercase tracking-[0.25em] text-black border-b border-black/[0.08] pb-3"
              style={{ fontFamily: "var(--brand-font)" }}
            >
              Outerwear Products
            </h2>
            {products.length === 0 ? (
              <p className="text-[11px] text-neutral-400 italic">No products found.</p>
            ) : (
              <ul className="space-y-3.5">
                {products.map((prod) => (
                  <li key={prod._id.toString()}>
                    <Link 
                      href={`/product/${prod.slug}`} 
                      className="group flex items-start justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-black/70 hover:text-black transition-colors"
                    >
                      <span className="group-hover:underline decoration-1 underline-offset-4 leading-relaxed max-w-[80%]">
                        {prod.name}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-medium whitespace-nowrap mt-0.5">
                        ${prod.price}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Column 4: Blog Posts */}
          <div className="space-y-6">
            <h2 
              className="text-[12px] font-extrabold uppercase tracking-[0.25em] text-black border-b border-black/[0.08] pb-3"
              style={{ fontFamily: "var(--brand-font)" }}
            >
              Journal Stories
            </h2>
            {blogs.length === 0 ? (
              <p className="text-[11px] text-neutral-400 italic">No stories found.</p>
            ) : (
              <ul className="space-y-3.5">
                {blogs.map((post) => (
                  <li key={post._id.toString()}>
                    <Link 
                      href={`/blog/${post.slug}`} 
                      className="group flex items-start justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-black/70 hover:text-black transition-colors"
                    >
                      <span className="group-hover:underline decoration-1 underline-offset-4 leading-relaxed">
                        {post.title}
                      </span>
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0 mt-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
