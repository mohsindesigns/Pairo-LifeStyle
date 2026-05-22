import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Plus, ArrowRight } from "lucide-react";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";
import SiteConfig from "@/models/SiteConfig";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Journal | Pairo Editorial",
  description: "Explore the stories, craftsmanship, and heritage behind Pairo's archival shearling collection.",
};

const BlogCard = ({ post }) => (
  <Link href={`/blog/${post.slug}`} className="group cursor-pointer w-full block">
    <div className="relative aspect-square bg-[#F7F7F7] rounded-[16px] md:rounded-[24px] overflow-hidden border border-black/5">
       <div className="absolute inset-0">
          <img 
            src={post.image} 
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
       </div>
       <div className="absolute top-2 md:top-4 left-2 md:left-4 z-10">
          <span className="bg-black/80 backdrop-blur-md text-white text-[6px] md:text-[8px] font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-md md:rounded-lg tracking-[0.1em] md:tracking-[0.2em] uppercase shadow-lg">
            {post.category || "JOURNAL"}
          </span>
       </div>
       <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
       <div className="absolute bottom-3 right-3 md:bottom-4 md:right-4 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black text-white flex items-center justify-center translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 shadow-xl">
          <ArrowUpRight className="w-4 h-4 md:w-5 md:h-5" />
       </div>
    </div>

    <div className="mt-3 md:mt-4 space-y-1 md:space-y-2 px-1">
       <h3 className="text-xs md:text-lg font-medium heading-font text-black/80 group-hover:text-black transition-colors uppercase">
          {post.title}
       </h3>
       
       <div className="flex items-center justify-between border-t border-black/[0.03] pt-2 md:pt-3">
          <span className="text-[10px] md:text-sm font-bold text-black uppercase tracking-tight">
             {post.date}
          </span>
          <span className="text-[7px] md:text-[9px] font-bold text-black/40 uppercase tracking-[0.1em]">
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

  const config = await SiteConfig.findOne({ key: 'main' }).lean();
  const rawFeaturedProduct = config?.blogs?.featuredProduct || {
    id: "default",
    name: "Archival Piece",
    image: "/placeholder.jpg",
    label: "FEATURED"
  };
  const featuredProduct = JSON.parse(JSON.stringify(rawFeaturedProduct));

  return (
    <main className="bg-white min-h-screen">
      <section className="pt-32 pb-16 md:pt-48 md:pb-24 border-b border-black/5">
         <div className="container mx-auto px-4 md:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
               <div className="space-y-4 max-w-3xl">
                  <div className="inline-flex items-center bg-black text-white px-3 py-1 rounded-md">
                     <span className="text-[7px] md:text-[9px] font-bold tracking-[0.3em] uppercase">
                        PAIRO ARCHIVE INDEX
                     </span>
                  </div>
                  <h1 className="text-4xl md:text-7xl lg:text-8xl font-bold heading-font tracking-tighter text-black uppercase leading-[0.85]">
                     Editorial <br /> Stories
                  </h1>
               </div>
               <div className="hidden md:block">
                  <span className="text-[10px] font-bold tracking-[0.4em] text-black/20 uppercase">VOLUME 2026 // EDITION 0.1</span>
               </div>
            </div>
         </div>
      </section>

      <section className="py-20 md:py-32">
         <div className="container mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-12">
               {posts.map((post) => (
                  <BlogCard key={post.id} post={post} />
               ))}
               
               <div className="bg-black text-white p-8 rounded-[24px] flex flex-col justify-between relative overflow-hidden group min-h-[300px]">
                  <div className="relative z-10 space-y-4">
                     <span className="text-white/40 text-[9px] font-bold uppercase tracking-[0.4em]">ARCHIVE SHOP</span>
                     <h3 className="text-2xl font-bold heading-font uppercase leading-tight">
                        {featuredProduct.name}
                     </h3>
                     <p className="text-white/50 text-[10px] md:text-sm line-clamp-3">
                        Featured in this season&apos;s archival entries.
                     </p>
                  </div>
                  <Link 
                    href={`/product/${featuredProduct.id}`}
                    className="relative z-10 flex items-center justify-center gap-3 w-full bg-white text-black py-4 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-[#FFC633] transition-all"
                  >
                    Shop archive
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <div className="absolute -bottom-10 -right-10 w-48 h-48 opacity-20 group-hover:scale-110 transition-transform duration-1000">
                     <img src={featuredProduct.image} className="w-full h-full object-cover" />
                  </div>
               </div>
            </div>
         </div>
      </section>

      <section className="py-20 md:py-32 bg-[#FBFBFB] border-t border-black/5">
         <div className="container mx-auto px-4 md:px-8 text-center max-w-4xl">
            <span className="text-black/30 text-[9px] font-bold uppercase tracking-[0.5em] mb-8 block">THE ELITE LIST</span>
            <h2 className="text-3xl md:text-5xl font-bold heading-font tracking-tighter text-black uppercase mb-12">
               Subscribe to receive <br /> exclusive archive previews.
            </h2>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
               <input 
                  type="email" 
                  placeholder="ENTER YOUR EMAIL" 
                  className="bg-white border border-black/10 px-8 py-4 rounded-full w-full md:w-96 text-xs font-bold tracking-widest focus:outline-none focus:border-black transition-colors"
               />
               <button className="bg-black text-white px-10 py-4 rounded-full font-bold text-xs uppercase tracking-[0.2em] hover:opacity-80 transition-all">
                  Join Archive
               </button>
            </div>
         </div>
      </section>
    </main>
  );
}
