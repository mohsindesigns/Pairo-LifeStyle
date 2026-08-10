import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";
import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";
import Page from "@/models/Page";
import BlogNewsletterForm from "./BlogNewsletterForm";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  await dbConnect();
  const page = await Page.findOne({ slug: "blog" }).lean();
  const { metadata } = await resolveSEOMetadata({
    entity: page || {},
    type: "page",
    fallbackTitle: "Journal | Pairo Editorial",
    fallbackDesc: "Explore the stories, craftsmanship, and heritage behind Pairo's archival shearling collection.",
    path: "/blog"
  });
  return metadata;
}

// ── Blog Card ──────────────────────────────────────────────────────────────
const BlogCard = ({ post }) => (
  <Link href={`/blog/${post.slug}`} className="group block h-full">
    <article className="h-full flex flex-col bg-white border border-neutral-100 overflow-hidden hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-shadow duration-300">
      {/* Thumbnail */}
      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100 shrink-0">
        {post.image ? (
          <img
            src={post.image}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-100 to-neutral-200" />
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          {post.category && post.category.trim() && post.category.toLowerCase() !== "uncategorized" && (
            <>
              <span className="text-[9px] font-black tracking-[0.22em] uppercase text-neutral-400">
                {post.category}
              </span>
              <span className="w-1 h-1 rounded-full bg-neutral-200 shrink-0" />
            </>
          )}
          <span className="text-[9px] font-semibold tracking-wider text-neutral-400">
            {post.date}
          </span>
        </div>

        {/* Title */}
        <h3
          style={{ fontFamily: "var(--brand-font)" }}
          className="text-[15px] font-bold uppercase tracking-tight text-black leading-snug group-hover:text-neutral-600 transition-colors"
        >
          {post.title}
        </h3>

        {/* Spacer + Read more */}
        <div className="mt-auto pt-4 border-t border-neutral-100 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-[0.15em] text-black uppercase">
            Read More
          </span>
          <ArrowUpRight className="w-4 h-4 text-black/30 group-hover:text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
        </div>
      </div>
    </article>
  </Link>
);

export default async function BlogArchive() {
  await dbConnect();

  const [dbBlogs, page] = await Promise.all([
    Blog.find({
      status: "Published",
      isDeleted: { $ne: true },
      tenantId: "DEFAULT_STORE"
    }).sort({ publishedAt: -1, createdAt: -1 }).lean(),
    Page.findOne({ slug: "blog", status: "Published" }).lean()
  ]);

  const posts = dbBlogs.map(b => ({
    id: b._id.toString(),
    title: b.title,
    slug: b.slug,
    image: b.image,
    category: b.category,
    date: new Date(b.publishedAt || b.createdAt).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric"
    })
  }));

  // Hero config from admin page builder
  const heroSection = page?.sections?.find(s => s.type === "blog_hero");
  const badge       = heroSection?.config?.badge        || "Pairo Archive & Journal";
  const heading     = heroSection?.config?.heading      || "Editorial Stories";
  const subheading  = heroSection?.config?.subheading   || "";
  const editionLabel = heroSection?.config?.editionLabel || "VOLUME 2026 // EDITION 0.1";

  const { structuredData } = await resolveSEOMetadata({
    entity: page || {},
    type: "page",
    fallbackTitle: "Journal | Pairo Editorial",
    fallbackDesc: "Explore the stories, craftsmanship, and heritage behind Pairo's archival shearling collection.",
    path: "/blog"
  });

  return (
    <div className="bg-[#FAFAF9] min-h-screen text-black">
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(structuredData) }}
        />
      )}

      {/* ── Hero Header ─────────────────────────────────── */}
      <section className="pt-14 pb-8 border-b border-black/[0.06] bg-white">
        <div className="container mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400">
                {badge}
              </p>
              <h1
                style={{ fontFamily: "var(--brand-font)" }}
                className="text-[28px] md:text-[40px] font-bold tracking-tight text-black leading-none"
              >
                {heading}
              </h1>
              {subheading && (
                <p className="text-[13px] text-neutral-500 leading-relaxed max-w-lg pt-1">
                  {subheading}
                </p>
              )}
            </div>
            <span className="text-[9px] font-bold tracking-[0.2em] text-neutral-300 uppercase shrink-0">
              {editionLabel}
            </span>
          </div>
        </div>
      </section>

      {/* ── Card Grid ───────────────────────────────────── */}
      <section className="py-10 md:py-14">
        <div className="container mx-auto px-4 sm:px-6 md:px-8">
          {posts.length === 0 ? (
            <div className="text-center py-20 border border-black/[0.05] bg-white">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
                No stories published yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map(post => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Newsletter ──────────────────────────────────── */}
      <section className="py-14 md:py-20 bg-black border-t border-white/5">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 text-center max-w-xl">
          <span className="text-neutral-500 text-[9px] font-bold uppercase tracking-[0.3em] mb-4 block">
            THE ELITE LIST
          </span>
          <h2
            style={{ fontFamily: "var(--brand-font)" }}
            className="text-xl md:text-[28px] font-bold tracking-tight text-white uppercase mb-8 leading-tight"
          >
            Subscribe to receive <br /> exclusive archive previews.
          </h2>
          <BlogNewsletterForm dark />
        </div>
      </section>
    </div>
  );
}
