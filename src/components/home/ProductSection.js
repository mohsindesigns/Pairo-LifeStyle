"use client";

import ProductCard from "./ProductCard";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSiteData } from "@/context/SiteContext";

export default function ProductSection({
  title,
  products = [],
  seriesLabel,
  ctaLabel,
  headingLevel = "h2"
}) {
  const siteData = useSiteData();
  const productLabels = {
    seriesLabel: seriesLabel || siteData?.products?.labels?.seriesLabel || "Collection",
    ctaLabel: ctaLabel || siteData?.products?.labels?.archiveIndex || "Explore Collection"
  };

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

  // Cap at 16 products total
  const displayProducts = activeProducts.slice(0, 16);

  return (
    <section className="py-4 md:py-6 bg-background">
      <div className="container mx-auto px-2 sm:px-4 md:px-8 py-12 md:py-20 overflow-hidden">
        {/* Header Section */}
        <div className="flex items-end justify-between mb-8 md:mb-14 gap-4">
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

          <div className="flex items-center shrink-0">
            {/* CTA Button */}
            <Link
              href="/shop"
              className="group relative flex items-center gap-2 sm:gap-4 border border-primary/40 px-4 py-2.5 sm:px-5 sm:py-3 rounded-full font-bold text-[11px] sm:text-xs md:text-[13.5px] uppercase tracking-[0.2em] overflow-hidden transition-all duration-500 hover:text-background hover:border-primary active:scale-95 shadow-lg shadow-primary/5 text-foreground"
            >
              <span className="relative z-10">{productLabels.ctaLabel}</span>
              <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4 relative z-10 transition-transform duration-500 group-hover:translate-x-1" />
              <div className="absolute inset-0 bg-primary translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[0.22,1,0.36,1]" />
            </Link>
          </div>
        </div>

        {/* Responsive Grid Area */}
        <div className="relative -mx-2 sm:-mx-4 md:-mx-8 px-2 sm:px-4 md:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
            }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-y-12 gap-x-6 md:gap-x-10"
          >
            {displayProducts.map((product, index) => {
              // Enforce:
              // Laptop/Desktop (lg): max 2x4 = 8 products shown
              // Tablet (md): max 4x3 = 12 products shown
              // Mobile: max 8x2 = 16 products shown
              let responsiveClass = "w-full";
              if (index >= 12) {
                responsiveClass = "w-full md:hidden"; // Hides on md, lg
              } else if (index >= 8) {
                responsiveClass = "w-full lg:hidden"; // Hides on lg
              }

              return (
                <motion.div
                  key={product._id || product.id}
                  variants={{
                    hidden: { opacity: 0, y: 35, scale: 0.96 },
                    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
                  }}
                  className={responsiveClass}
                >
                  <ProductCard product={product} />
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
