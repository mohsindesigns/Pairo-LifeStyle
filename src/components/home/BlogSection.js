"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowRight } from "lucide-react";
import { useSiteData } from "@/context/SiteContext";

const BlogCard = ({ post, readMoreLabel }) => (
  <Link href={`/blog/${post.slug}`} className="group cursor-pointer w-full block">
    <div className="relative aspect-square bg-[#F7F7F7] rounded-[16px] md:rounded-[24px] overflow-hidden border border-black/5">
       <div className="absolute inset-0">
          <Image src={post.image || "/placeholder.jpg"} alt={post.title} fill className="object-cover transition-transform duration-1000 group-hover:scale-105" />
       </div>
       <div className="absolute top-2 md:top-4 left-2 md:left-4 z-10">
          <span className="bg-black/80 backdrop-blur-md text-white text-[6px] md:text-[8px] font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-md md:rounded-lg tracking-[0.1em] md:tracking-[0.2em] uppercase shadow-lg">{post.category || "JOURNAL"}</span>
       </div>
       <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
       <div className="absolute bottom-3 right-3 md:bottom-4 md:right-4 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black text-white flex items-center justify-center translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 shadow-xl">
          <ArrowUpRight className="w-4 h-4 md:w-5 md:h-5" />
       </div>
    </div>
    <div className="mt-3 md:mt-4 space-y-1 md:space-y-2 px-1">
       <h3 className="text-xs md:text-base font-medium heading-font text-black/80 group-hover:text-black transition-colors uppercase">{post.title}</h3>
       <div className="flex items-center justify-between border-t border-black/[0.03] pt-2 md:pt-3">
          <span className="text-[10px] md:text-sm font-bold text-black uppercase tracking-tight">{post.date}</span>
          <span className="text-[7px] md:text-[9px] font-bold text-black/40 uppercase tracking-[0.1em]">{readMoreLabel}</span>
       </div>
    </div>
  </Link>
);

export default function BlogSection({ 
  title, 
  label, 
  limit, 
  readMore 
}) {
  const siteData = useSiteData();
  const carouselRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [dbBlogs, setDbBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const blogsConfig = {
    title: title || siteData?.blogs?.title || "OUR JOURNAL",
    label: label || siteData?.blogs?.label || "BLOG",
    readMore: readMore || siteData?.blogs?.readMore || "READ MORE",
    limit: limit || 6,
    featuredProduct: siteData?.blogs?.featuredProduct || {
        label: "FEATURED",
        name: "Collection",
        description: "Discover our latest additions.",
        buttonText: "SHOP NOW",
        image: "/placeholder.jpg"
    }
  };

  useEffect(() => {
    fetch(`/api/blogs?limit=${blogsConfig.limit}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDbBlogs(data);
        setLoading(false);
      });
  }, [blogsConfig.limit]);

  const scroll = (direction) => {
    if (carouselRef.current) {
      const { scrollLeft, clientWidth } = carouselRef.current;
      const scrollTo = direction === "left" ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      carouselRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  const checkScroll = () => {
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setCanScrollLeft(scrollLeft > 20);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  useEffect(() => {
    const current = carouselRef.current;
    if (current) {
      current.addEventListener("scroll", checkScroll);
      checkScroll();
    }
    return () => current?.removeEventListener("scroll", checkScroll);
  }, [dbBlogs]);

  const posts = dbBlogs.length > 0 ? dbBlogs.map(b => ({
    id: b._id,
    title: b.title,
    slug: b.slug,
    image: b.image,
    category: b.category,
    date: new Date(b.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  })) : (siteData?.blogs?.posts || []);

  return (
    <section className="py-2 md:py-4 overflow-hidden">
      <div className="mx-4 md:mx-8 bg-white border border-black/5 rounded-[32px] md:rounded-[40px] shadow-sm overflow-hidden py-16 md:py-20 px-6 md:px-16">
        <div className="flex items-end justify-between mb-10 md:mb-14 gap-4">
          <div className="space-y-3 md:space-y-4 flex-1 min-w-0">
             <div className="inline-flex items-center bg-black text-white px-3 py-1 rounded-md">
                <span className="text-[7px] md:text-[9px] font-bold tracking-[0.2em] uppercase">{blogsConfig.label}</span>
             </div>
             <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold heading-font tracking-tighter text-black uppercase leading-none truncate">{blogsConfig.title}</h2>
          </div>
          <div className="flex items-center gap-3 md:gap-6 shrink-0">
             <div className="flex gap-1.5 md:gap-2">
                <button onClick={() => scroll("left")} className={`w-10 h-10 md:w-12 md:h-12 rounded-full border border-black/10 flex items-center justify-center transition-all ${canScrollLeft ? "text-black hover:bg-black hover:text-white" : "text-black/30 cursor-default"}`}><ChevronLeft className="w-4 h-4 md:w-5 md:h-5" /></button>
                <button onClick={() => scroll("right")} className={`w-10 h-10 md:w-12 md:h-12 rounded-full border border-black/10 flex items-center justify-center transition-all ${canScrollRight ? "text-black hover:bg-black hover:text-white" : "text-black/30 cursor-default"}`}><ChevronRight className="w-4 h-4 md:w-5 md:h-5" /></button>
             </div>
          </div>
        </div>

        <div className="relative -mx-4 md:-mx-8 px-4 md:px-8">
          <div ref={carouselRef} className="flex gap-5 md:gap-8 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
            {posts.map((post) => (
              <div key={post.id} className="w-[75vw] sm:w-[45vw] md:w-[35vw] lg:w-[22.5vw] shrink-0 snap-start">
                <BlogCard post={post} readMoreLabel={blogsConfig.readMore} />
              </div>
            ))}
            <div className="w-[75vw] sm:w-[45vw] md:w-[35vw] lg:w-[22.5vw] shrink-0 snap-start">
               <div className="h-full bg-black text-white p-8 md:p-10 rounded-[16px] md:rounded-[24px] flex flex-col justify-between relative overflow-hidden group min-h-[300px] md:min-h-[400px]">
                  <div className="relative z-10 space-y-4">
                     <span className="text-white/40 text-[9px] font-bold uppercase tracking-[0.4em]">{blogsConfig.featuredProduct.label}</span>
                     <h3 className="text-xl md:text-2xl font-bold heading-font uppercase leading-tight">{blogsConfig.featuredProduct.name}</h3>
                     <p className="text-white/50 text-[10px] md:text-sm line-clamp-3">{blogsConfig.featuredProduct.description}</p>
                  </div>
                  <Link href={`/product/${blogsConfig.featuredProduct.id}`} className="relative z-10 flex items-center justify-center gap-3 w-full bg-white text-black py-3.5 md:py-4 rounded-lg md:rounded-xl font-bold text-[8px] md:text-[10px] uppercase tracking-[0.2em] hover:bg-gray-100 transition-all shadow-xl active:scale-95">
                    {blogsConfig.featuredProduct.buttonText}<ArrowRight className="w-4 h-4" />
                  </Link>
                  <div className="absolute -bottom-6 -right-6 w-32 h-32 md:w-48 md:h-48 opacity-20 group-hover:scale-110 transition-transform duration-1000"><Image src={blogsConfig.featuredProduct.image || "/placeholder.jpg"} alt="Featured" fill className="object-cover rounded-[16px]" /></div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
