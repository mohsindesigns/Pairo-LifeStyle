"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import ProductCard from "./ProductCard";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useSiteData } from "@/context/SiteContext";

export default function ProductSection({
  title,
  products = [],
  seriesLabel,
  ctaLabel,
  headingLevel = "h2",
  layoutType = "carousel",
  gridColsDesktop = 4,
  gridRowsDesktop = 2,
  gridColsTablet = 3,
  gridRowsTablet = 2,
  gridColsMobile = 2,
  gridRowsMobile = 3
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
      const scrollTo = direction === "left" ? scrollLeft - clientWidth * 0.75 : scrollLeft + clientWidth * 0.75;
      carouselRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  const updateScrollButtons = () => {
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    const current = carouselRef.current;
    if (current) {
      current.addEventListener("scroll", updateScrollButtons);
      // Run once initially to check constraints
      updateScrollButtons();
      // Add resize listener
      window.addEventListener("resize", updateScrollButtons);
    }
    return () => {
      if (current) {
        current.removeEventListener("scroll", updateScrollButtons);
      }
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [products]);

  // Clean empty/deleted items from products list
  const activeProducts = (products || []).filter(
    (p) => p && !p.isDeleted && p.status === "Published"
  );

  if (!siteData) return null;

  if (activeProducts.length === 0) {
    return (
      <section className="py-4 bg-background">
        <div className="container mx-auto px-2 sm:px-4 md:px-8 py-8 text-center">
          <div className="py-12 bg-neutral-50 rounded-2xl border border-border/40">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              No products are currently available in this collection.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const MotionHeading = motion[headingLevel] || motion.h2;
  const isGrid = layoutType === "grid";

  const gridStyles = isGrid ? {
    '--cols-desktop': gridColsDesktop || 4,
    '--cols-tablet': gridColsTablet || 3,
    '--cols-mobile': gridColsMobile || 2,
    '--max-desktop-display': ((gridColsDesktop || 4) * (gridRowsDesktop || 2)) + 1,
    '--max-tablet-display': ((gridColsTablet || 3) * (gridRowsTablet || 2)) + 1,
    '--max-mobile-display': ((gridColsMobile || 2) * (gridRowsMobile || 3)) + 1,
  } : {};

  return (
    <section className="py-4 md:py-6 bg-background">
      <div className="container mx-auto px-2 sm:px-4 md:px-8 py-12 md:py-20 overflow-hidden">

        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 md:mb-14 gap-6">
          <div className="space-y-3 md:space-y-4 flex-1 min-w-0">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center bg-black text-white px-3 py-1 rounded-full"
            >
              <p className="text-[8px] md:text-[10px] font-bold tracking-[0.2em] uppercase">
                {productLabels.seriesLabel}
              </p>
            </motion.div>
            <MotionHeading
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-[22px] md:text-[30px] font-bold heading-font tracking-tighter text-[#000000] uppercase leading-none truncate"
            >
              {title}
            </MotionHeading>
          </div>

          <div className="flex items-center justify-between lg:justify-end gap-4 md:gap-8 shrink-0 w-full lg:w-auto">
            {/* CTA Button */}
            <Link
              href="/shop"
              className="group relative flex items-center gap-2 sm:gap-4 border border-primary/40 px-4 py-2.5 sm:px-5 sm:py-3 rounded-full font-bold text-[11px] sm:text-xs md:text-[13.5px] uppercase tracking-[0.2em] overflow-hidden transition-all duration-500 hover:text-background hover:border-primary active:scale-95 shadow-lg shadow-primary/5 text-foreground"
            >
              <span className="relative z-10">{productLabels.ctaLabel}</span>
              <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4 relative z-10 transition-transform duration-500 group-hover:translate-x-1" />
              <div className="absolute inset-0 bg-primary translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[0.22,1,0.36,1]" />
            </Link>

            {/* Carousel Buttons */}
            {!isGrid && (
              <div className="flex gap-2 md:gap-3 lg:border-l border-border/80 lg:pl-8 shrink-0">
                <button
                  onClick={() => scroll("left")}
                  aria-label="Scroll Left"
                  className={`w-9 h-9 md:w-11 md:h-11 rounded-full border border-border/80 flex items-center justify-center transition-all ${canScrollLeft
                    ? "text-foreground bg-background hover:bg-primary hover:text-background hover:border-primary shadow-md scale-100 active:scale-90"
                    : "text-foreground/20 cursor-default scale-95 opacity-55"
                    }`}
                >
                  <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button
                  onClick={() => scroll("right")}
                  aria-label="Scroll Right"
                  className={`w-9 h-9 md:w-11 md:h-11 rounded-full border border-border/80 flex items-center justify-center transition-all ${canScrollRight
                    ? "text-foreground bg-background hover:bg-primary hover:text-background hover:border-primary shadow-md scale-100 active:scale-90"
                    : "text-foreground/20 cursor-default scale-95 opacity-55"
                    }`}
                >
                  <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Carousel Grid Area - Bleed Edge responsive layout */}
        <div className="relative -mx-2 sm:-mx-4 md:-mx-8 px-2 sm:px-4 md:px-8">
          {isGrid ? (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
              }}
              style={gridStyles}
              className="dynamic-responsive-grid gap-y-12 gap-x-6 md:gap-x-10"
            >
              {products.map((product) => (
                <motion.div
                  key={product._id || product.id}
                  variants={{
                    hidden: { opacity: 0, y: 35, scale: 0.96 },
                    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
                  }}
                  className="w-full"
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
              }}
              ref={carouselRef}
              className="flex gap-4 sm:gap-6 md:gap-10 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-6"
            >
              {products.map((product) => (
                <motion.div
                  key={product._id || product.id}
                  variants={{
                    hidden: { opacity: 0, y: 35, scale: 0.96 },
                    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
                  }}
                  className="w-[72vw] sm:w-[45vw] md:w-[35vw] lg:w-[23vw] shrink-0 snap-start"
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

      </div>
    </section>
  );
}
