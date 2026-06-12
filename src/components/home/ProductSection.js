"use client";

import { useRef, useState, useEffect } from "react";
import ProductCard from "./ProductCard";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useSiteData } from "@/context/SiteContext";

export default function ProductSection({ 
  title, 
  products = [], 
  seriesLabel, 
  ctaLabel 
}) {
  const siteData = useSiteData();
  const productLabels = {
    seriesLabel: seriesLabel || siteData?.products?.labels?.seriesLabel || "Collection",
    ctaLabel: ctaLabel || siteData?.products?.labels?.archiveIndex || "Explore Collection"
  };
  const carouselRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

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
  }, []);

  if (!siteData) return null;

  if (!products || products.length === 0) {
    return (
      <section className="py-2 md:py-4">
        <div className="mx-4 md:mx-8 bg-white border border-black/5 rounded-[32px] md:rounded-[40px] shadow-sm overflow-hidden py-16 md:py-20 px-6 md:px-16 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <h2 className="text-xl md:text-2xl font-bold heading-font text-black uppercase tracking-tight">{title}</h2>
            <div className="w-12 h-[1px] bg-black/10 mx-auto" />
            <p className="text-[10px] text-black/45 font-bold uppercase tracking-widest leading-relaxed">
              No products are currently available in this collection.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-2 md:py-4">
      <div className="mx-4 md:mx-8 bg-white border border-black/5 rounded-[32px] md:rounded-[40px] shadow-sm overflow-hidden py-16 md:py-20 px-6 md:px-16">
        <div className="flex items-end justify-between mb-10 md:mb-14 gap-4">
          <div className="space-y-3 md:space-y-4 flex-1 min-w-0">
             <motion.div 
               initial={{ opacity: 0, x: -20 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.6 }}
               className="inline-flex items-center bg-black text-white px-3 py-1 rounded-md"
             >
                <span className="text-[7px] md:text-[9px] font-bold tracking-[0.2em] uppercase">
                  {productLabels.seriesLabel}
                </span>
             </motion.div>
             <motion.h2 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.8, delay: 0.1 }}
               className="text-2xl md:text-4xl lg:text-5xl font-bold heading-font tracking-tighter text-black uppercase leading-none md:max-w-xl"
             >
                 {title}
             </motion.h2>
          </div>

          <div className="flex items-center gap-4 md:gap-8 shrink-0">
             <button className="group relative hidden sm:flex items-center gap-6 border border-black/20 px-10 py-4.5 rounded-full font-bold text-[10px] uppercase tracking-[0.2em] overflow-hidden transition-all duration-500 hover:text-white hover:border-black active:scale-95 shadow-lg shadow-black/5">
                <span className="relative z-10">{productLabels.ctaLabel}</span>
                <ArrowRight className="w-5 h-5 relative z-10 transition-transform duration-500 group-hover:translate-x-1" />
                <div className="absolute inset-0 bg-black translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[0.22, 1, 0.36, 1]" />
             </button>

             <div className="flex gap-2 md:gap-3 sm:border-l border-black/10 sm:pl-8">
                <button 
                  onClick={() => scroll("left")}
                  className={`w-12 h-12 md:w-16 md:h-16 rounded-full border border-black/10 flex items-center justify-center transition-all ${
                    canScrollLeft ? "text-black bg-white hover:bg-black hover:text-white shadow-xl scale-100" : "text-black/10 cursor-default scale-95"
                  }`}
                >
                  <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
                </button>
                <button 
                  onClick={() => scroll("right")}
                  className={`w-12 h-12 md:w-16 md:h-16 rounded-full border border-black/10 flex items-center justify-center transition-all ${
                    canScrollRight ? "text-black bg-white hover:bg-black hover:text-white shadow-xl scale-100" : "text-black/10 cursor-default scale-95"
                  }`}
                >
                  <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                </button>
             </div>
          </div>
        </div>

        <div className="relative -mx-4 md:-mx-12 px-4 md:px-12">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
            }}
            ref={carouselRef}
            className="flex gap-6 md:gap-10 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-8"
          >
            {products.map((product) => (
              <motion.div 
                key={product._id || product.id} 
                variants={{
                  hidden: { opacity: 0, y: 40, scale: 0.95 },
                  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
                }}
                className="w-[85vw] sm:w-[50vw] md:w-[40vw] lg:w-[26vw] shrink-0 snap-start"
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
