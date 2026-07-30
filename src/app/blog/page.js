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

function estimateReadTime(content = "") {
  const words = content?.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length || 0;
  return Math.max(1, Math.round(words / 200));
}

// ── Featured (first) card ─────────────────────────────────────────────────
const FeaturedCard = ({ post }) => (
  <Link href={`/blog/${post.slug}`} className="group block">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-black/[0.07] bg-white overflow-hidden rounded-[3px] hover:shadow-lg transition-shadow duration-300">
      {/* Image */}
      <div className="relative overflow-hidden aspect-[4/3] md:aspect-auto min-h-[260px] md:min-h-[380px] bg-neutral-100">
        {post.image ? (
          <img
            src={post.image}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-100 to-neutral-200" />
        )}
        {/* Category pill */}
        {post.category && post.category.toLowerCase() !== "uncategorized" && (
          <span className="absolute top-4 left-4 bg-black text-white text-[9px] font-bold tracking-[0.18em] uppercase px-3 py-1.5">
            {post.category}
          </span>
        )}
      </div>
      {/* Content */}
      <div className="flex flex-col justify-between p-7 md:p-10 bg-white">
        <div className="space-y-4">
          <p className="text-[9px] font-bold tracking-[0.25em] text-neutral-400 uppercase">
            Featured Story
          </p>
          <h2
            style={{ fontFamily: "var(--brand-font)" }}
            className="text-[22px] md:text-[28px] font-bold uppercase tracking-tight text-black leading-tight group-hover:underline decoration-1 underline-offset-4"
          >
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="text-[13px] text-neutral-500 leading-relaxed line-clamp-3">
              {post.excerpt}
            </p>
          )}
        </div>
        <div className="mt-8 flex items-center justify-between border-t border-black/[0.06] pt-5">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-neutral-400 tracking-wide">{post.date}</span>
            <span className="w-1 h-1 rounded-full bg-black/20" />
            <span className="text-[11px] font-semibold text-neutral-400 tracking-wide">{post.readTime} min read</span>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-black uppercase tracking-wider group-hover:gap-2.5 transition-all">
            Read <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  </Link>
);

// ── Regular grid card ────────────────────────────────────────────────────
const BlogCard = ({ post, index }) => (
  <Link href={`/blog/${post.slug}`} className="group block h-full">
    <article className="h-full flex flex-col border border-black/[0.07] bg-white overflow-hidden rounded-[3px] hover:shadow-md transition-shadow duration-300">
      {/* Image */}
      <div className="relative overflow-hidden aspect-[16/10] bg-neutral-100 shrink-0">
        {post.image ? (
          <img
            src={post.image}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-100 to-neutral-200" />
        )}
        {/* Index number */}
        <span className="absolute bottom-3 right-3 text-[10px] font-black text-white/60 tracking-widest leading-none">
          {String(index).padStart(2, "0")}
        </span>
      </div>
      {/* Content */}
      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-center gap-2 mb-3">
          {post.category && post.category.toLowerCase() !== "uncategorized" && (
            <>
              <span className="text-[9px] font-bold tracking-[0.2em] text-neutral-400 uppercase">
                {post.category}
              </span>
              <span className="w-1 h-1 rounded-full bg-black/10" />
            </>
          )}
          <span className="text-[9px] font-semibold text-neutral-400 tracking-wide">{post.date}</span>
        </div>
        <h3
          style={{ fontFamily: "var(--brand-font)" }}
          className="text-[14px] font-bold uppercase tracking-tight text-black leading-snug mb-auto group-hover:underline decoration-1 underline-offset-4"
        >
          {post.title}
        </h3>
        <div className="mt-4 flex items-center justify-between border-t border-black/[0.05] pt-3.5">
          <span className="text-[10px] font-semibold text-neutral-400">{post.readTime} min read</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-black/30 group-hover:text-black transition-colors" />
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
    }).sort({ createdAt: -1 }).lean(),
    Page.findOne({ slug: "blog", status: "Published" }).lean()
  ]);

  const posts = dbBlogs.map(b => ({
    id: b._id.toString(),
    title: b.title,
    slug: b.slug,
    image: b.image,
    category: b.category,
    excerpt: b.shortDescription || b.excerpt || "",
    readTime: estimateReadTime(b.content || b.description || ""),
    date: new Date(b.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  }));

  // Read hero config from the page's blog_hero section
  const heroSection = page?.sections?.find(s => s.type === "blog_hero");
  const badge = heroSection?.config?.badge || "Pairo Archive & Journal";
  const heading = heroSection?.config?.heading || "Editorial Stories";
  const subheading = heroSection?.config?.subheading || "";
  const editionLabel = heroSection?.config?.editionLabel || "VOLUME 2026 // EDITION 0.1";

  const { structuredData } = await resolveSEOMetadata({
    entity: page || {},
    type: "page",
    fallbackTitle: "Journal | Pairo Editorial",
    fallbackDesc: "Explore the stories, craftsmanship, and heritage behind Pairo's archival shearling collection.",
    path: "/blog"
  });

  const [featured, ...rest] = posts;

  return (
    <div className="bg-[#FAFAF9] min-h-screen text-black">
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(structuredData) }}
        />
      )}

      {/* ── Hero Header ── */}
      <section className="pt-14 pb-8 border-b border-black/[0.06] bg-white">
        <div className="container mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400">
                {badge}
              </p>
              <h1
                style={{ fontFamily: "var(--brand-font)" }}
                className="text-[28px] md:text-[42px] font-bold tracking-tight text-black leading-none"
              >
                {heading}
              </h1>
              {subheading && (
                <p className="text-[13px] text-neutral-500 leading-relaxed max-w-lg pt-1">
                  {subheading}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <span className="text-[9px] font-bold tracking-[0.2em] text-neutral-300 uppercase block">
                {editionLabel}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Posts ── */}
      <section className="py-10 md:py-14">
        <div className="container mx-auto px-4 sm:px-6 md:px-8">
          {posts.length === 0 ? (
            <div className="text-center py-20 border border-black/[0.05] rounded-[3px] bg-white">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
                No Editorial Stories Published Yet
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {/* Featured post */}
              {featured && <FeaturedCard post={featured} />}

              {/* Grid */}
              {rest.length > 0 && (
                <>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-[9px] font-bold tracking-[0.25em] text-neutral-400 uppercase">More Stories</span>
                    <div className="flex-1 h-px bg-black/[0.06]" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    <h2 className="sr-only">More Articles</h2>
                    {rest.map((post, i) => (
                      <BlogCard key={post.id} post={post} index={i + 2} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Newsletter ── */}
      <section className="py-14 md:py-20 bg-black border-t border-black/20">
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
