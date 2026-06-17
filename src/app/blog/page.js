import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Plus, ArrowRight } from "lucide-react";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";

export const dynamic = "force-dynamic";

import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";
import Page from "@/models/Page";
import BlogNewsletterForm from "./BlogNewsletterForm";

export async function generateMetadata() {
  await dbConnect();
  const page = await Page.findOne({ slug: "blog" }).lean();
  
  const { metadata } = resolveSEOMetadata({
    entity: page || {},
    type: "page",
    fallbackTitle: "Journal | Pairo Editorial",
    fallbackDesc: "Explore the stories, craftsmanship, and heritage behind Pairo's archival shearling collection.",
    path: "/blog"
  });
  
  return metadata;
}

const BlogCard = ({ post }) => (
  <Link href={`/blog/${post.slug}`} className="group cursor-pointer w-full block">
    <div className="relative aspect-square bg-secondary rounded-[16px] md:rounded-[24px] overflow-hidden border border-border">
       <div className="absolute inset-0">
          <img 
            src={post.image} 
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
       </div>
       <div className="absolute top-2 md:top-4 left-2 md:left-4 z-10">
          <span className="bg-foreground/80 backdrop-blur-md text-background text-[6px] md:text-[8px] font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-md md:rounded-lg tracking-[0.1em] md:tracking-[0.2em] uppercase shadow-lg">
            {post.category || "JOURNAL"}
          </span>
       </div>
       <div className="absolute inset-0 bg-foreground/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
       <div className="absolute bottom-3 right-3 md:bottom-4 md:right-4 w-8 h-8 md:w-10 md:h-10 rounded-full bg-foreground text-background flex items-center justify-center translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 shadow-xl">
          <ArrowUpRight className="w-4 h-4 md:w-5 md:h-5" />
       </div>
    </div>

    <div className="mt-3 md:mt-4 space-y-1 md:space-y-2 px-1">
       <p 
          style={{ fontFamily: "var(--brand-font)" }}
          className="text-lg md:text-xl font-bold uppercase tracking-wider text-foreground/85 group-hover:text-foreground transition-colors truncate"
       >
          {post.title}
       </p>
       
       <div className="flex items-center justify-between border-t border-border pt-2 md:pt-3">
          <span className="text-[10px] md:text-sm font-bold text-foreground uppercase tracking-tight">
             {post.date}
          </span>
          <span className="text-[7px] md:text-[9px] font-bold text-foreground/60 uppercase tracking-[0.1em]">
             Read Story
          </span>
       </div>
    </div>
  </Link>
);

export default async function BlogArchive() {
  await dbConnect();
  
  const dbBlogs = await Blog.find({ 
    status: 'Published', 
    isDeleted: { $ne: true },
    tenantId: 'DEFAULT_STORE' 
  }).sort({ createdAt: -1 }).lean();

  const posts = dbBlogs.map(b => ({
    id: b._id.toString(),
    title: b.title,
    slug: b.slug,
    image: b.image,
    category: b.category,
    date: new Date(b.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }));



  const page = await Page.findOne({ slug: "blog", status: "Published" }).lean();
  const { structuredData } = resolveSEOMetadata({
    entity: page || {},
    type: "page",
    fallbackTitle: "Journal | Pairo Editorial",
    fallbackDesc: "Explore the stories, craftsmanship, and heritage behind Pairo's archival shearling collection.",
    path: "/blog"
  });

  return (
    <main className="bg-white min-h-screen">
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(structuredData) }}
        />
      )}
      <section className="pt-16 pb-10 md:pt-24 md:pb-12 border-b border-border">
         <div className="container mx-auto px-4 md:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
               <div className="space-y-4 max-w-3xl">
                  <div className="inline-flex items-center bg-foreground text-background px-3 py-1 rounded-md">
                     <span className="text-[7px] md:text-[9px] font-bold tracking-[0.3em] uppercase">
                        PAIRO ARCHIVE INDEX
                     </span>
                  </div>
                  <h1 className="text-4xl md:text-7xl lg:text-8xl font-bold heading-font tracking-tighter text-foreground uppercase leading-[0.85]">
                     Editorial <br /> Stories
                  </h1>
               </div>
               <div className="hidden md:block">
                  <span className="text-[10px] font-bold tracking-[0.4em] text-foreground/45 uppercase">VOLUME 2026 // EDITION 0.1</span>
               </div>
            </div>
         </div>
      </section>

      <section className="py-10 md:py-16">
         <div className="container mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-12">
               {posts.map((post) => (
                  <BlogCard key={post.id} post={post} />
               ))}
            </div>
         </div>
      </section>

      <section className="py-12 md:py-20 bg-secondary border-t border-border">
         <div className="container mx-auto px-4 md:px-8 text-center max-w-4xl">
            <span className="text-foreground/50 text-[9px] font-bold uppercase tracking-[0.5em] mb-8 block">THE ELITE LIST</span>
            <h2 className="text-3xl md:text-5xl font-bold heading-font tracking-tighter text-foreground uppercase mb-12">
               Subscribe to receive <br /> exclusive archive previews.
            </h2>
            <BlogNewsletterForm />
         </div>
      </section>
    </main>
  );
}
