"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useSiteData } from "@/context/SiteContext";
import { getCategoryUrl } from "@/lib/routes";

export default function CategoryBanner({
  title,
  label,
  viewAll,
  categories: propCategories,
  headingLevel = "h2"
}) {
  const siteData = useSiteData();
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const categoriesConfig = {
    title: title || siteData?.categories?.title || "Our Collections",
    label: label || siteData?.categories?.label || "Pairo Studio",
    viewAll: viewAll || siteData?.categories?.viewAll || "Explore All",
    exploreSingle: siteData?.categories?.exploreSingle || "Explore",
    exploreFull: siteData?.categories?.exploreFull || "Explore Collection"
  };

  const displayCategories = (propCategories && propCategories.length > 0)
    ? propCategories.slice(0, 3)
    : [];

  // Bento Spans [1 : 2 : 1]
  const layoutSpans = [
    "lg:col-span-1",
    "lg:col-span-2",
    "lg:col-span-1"
  ];

  if (displayCategories.length === 0) return null;

  const HeadingTag = headingLevel;

  return (
    <section className="container mx-auto px-2 sm:px-4 md:px-8 py-2 md:py-4">
      <div className="bg-white border border-black/5 rounded-[40px] shadow-sm overflow-hidden py-16 md:py-24 px-6 md:px-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center bg-black text-white px-3 py-1 rounded-md">
              <p className="text-[9px] md:text-[11px] font-bold tracking-[0.2em] uppercase">
                {categoriesConfig.label || "The Collection"}
              </p>
            </div>
            <HeadingTag className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold heading-font tracking-tighter text-[#000000] uppercase leading-none truncate">
              {categoriesConfig.title || "Shop By Category"}
            </HeadingTag>
          </div>

          <Link href="/shop" className="group relative hidden sm:flex items-center gap-4 border border-black px-8 py-3 rounded-full font-bold text-[10px] uppercase tracking-[0.2em] overflow-hidden transition-all duration-500 hover:text-white active:scale-95">
            <span className="relative z-10">{categoriesConfig.viewAll || "Explore All"}</span>
            <ArrowRight className="w-4 h-4 relative z-10 transition-transform duration-500 group-hover:translate-x-1" />
            <div className="absolute inset-0 bg-black translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[0.22, 1, 0.36, 1]" />
          </Link>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {displayCategories.map((category, index) => {
            const isSmall = index === 0 || index === 2;
            const exploreText = index === 1 ? (categoriesConfig.exploreFull || "Explore Collection") : (categoriesConfig.exploreSingle || "Explore");

            return (
              <motion.div
                key={category.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`group relative h-[350px] md:h-[450px] rounded-[32px] overflow-hidden bg-gray-50 border border-black/5 ${layoutSpans[index]}`}
              >
                <Link href={getCategoryUrl(category)} className="absolute inset-0 z-20">
                  <span className="sr-only">View {category.name}</span>
                </Link>

                {/* Images */}
                <div className="absolute inset-0 transition-transform duration-1000 group-hover:scale-105">
                  {category.image ? (
                    <Image src={category.image} alt={category.imageAlts?.[category.image] || category.name || "Category"} fill className="object-cover" priority={index === 1} />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center text-white/20 font-bold uppercase tracking-widest text-[11px]">No Image</div>
                  )}
                </div>

                {/* Overlay for Text Visibility — only when enabled on category */}
                {Boolean(category.showBannerOverlay) && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-75 group-hover:opacity-90 transition-opacity duration-500" />
                )}

                {/* Content Area */}
                <div className={`absolute inset-0 p-5 sm:p-8 md:p-12 flex flex-col justify-end items-center text-center ${isSmall ? '' : 'sm:items-start sm:text-left'}`}>
                  <div className={`space-y-3 sm:space-y-5 w-full flex flex-col items-center ${isSmall ? '' : 'sm:items-start'}`}>
                    <div className="space-y-1 sm:space-y-2">

                      <h3 className="text-[16px] sm:text-xl md:text-2xl lg:text-3xl font-bold text-white uppercase tracking-tighter leading-[0.9] [text-shadow:_0_2px_10px_rgb(0_0_0_/_75%)]">
                        {category.name}
                      </h3>
                    </div>

                    <div className={`w-full flex justify-center ${isSmall ? '' : 'sm:justify-start'}`}>
                      <button className="group/btn relative overflow-hidden bg-white text-black px-6 py-2.5 sm:px-10 sm:py-3.5 rounded-full font-bold text-[8px] sm:text-[10px] uppercase tracking-[0.2em] transition-all duration-500 shadow-2xl active:scale-95">
                        <span className="relative z-10 flex items-center gap-2 sm:gap-3 group-hover/btn:text-white transition-colors duration-300">
                          {exploreText}
                          <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </span>
                        <div className="absolute inset-0 bg-black translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
