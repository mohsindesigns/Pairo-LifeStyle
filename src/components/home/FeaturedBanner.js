"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { ArrowRight } from "lucide-react";
import siteData from "@/lib/data.json";
import { getProductUrl, getCategoryUrl } from "@/lib/routes";

export default function FeaturedBanner({
  title,
  description,
  badge1,
  badge2,
  product: propProduct,
  ctaText,
  linkType,
  productId,
  collectionId,
  image: propImage,
  features: propFeatures
}) {
  const product = propProduct || { name: "Product Name", price: "000", image: "/placeholder.jpg" };

  const bannerData = {
    title: title || product.name,
    description: description || "Premium shearling handcrafted for the modern pioneer. A season essential redefining winter luxury.",
    badge1: badge1 || "Limited Edition",
    badge2: badge2 || "Winter '24",
    ctaText: ctaText || "Buy Now",
    image: propImage || product.image
  };

  return (
    <section className="container mx-auto px-2 sm:px-4 md:px-8 my-8 md:my-12">
      <div className="bg-black rounded-[24px] md:rounded-[40px] overflow-hidden relative min-h-[380px] md:min-h-[450px] flex items-center">
        {/* Product Image - Optimized for all screens */}
        <div className="absolute inset-0 w-full h-full md:w-1/2 md:left-auto md:right-0">
          <Image
            src={bannerData.image}
            alt={bannerData.title}
            fill
            className="object-cover object-center md:object-left opacity-40 md:opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent md:hidden" />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-black hidden md:block" />
        </div>

        {/* Content Area - Responsive Fitting */}
        <div className="w-full relative z-10 px-6 md:px-16 py-10 md:py-12 lg:py-16">
          <div className="max-w-full md:max-w-lg lg:max-w-xl space-y-6 md:space-y-8">
            {/* Tagline style matching Hero */}
            <div className="flex items-center gap-3">
              <div className="h-[1.5px] w-8 bg-white/30" />
              <span className="text-white/90 text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase">
                {[bannerData.badge1, bannerData.badge2].filter(Boolean).join(" • ")}
              </span>
            </div>

            {/* Typography matching Hero */}
            <div className="space-y-4 md:space-y-6">
              <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white heading-font leading-[1.05] tracking-tight max-w-[15ch] md:max-w-none uppercase">
                {bannerData.title}
              </h2>
              <p className="text-white/90 text-xs md:text-base lg:text-lg max-w-md leading-relaxed font-sans">
                {bannerData.description}
              </p>
            </div>

            {/* Condensed Features */}
            {(() => {
              const defaultFeatures = [
                { text: "Lifetime Guarantee", icon: "ShieldCheck" },
                { text: "Global Shipping", icon: "Globe" }
              ];
              const features = propFeatures && propFeatures.length > 0 ? propFeatures : defaultFeatures;
              return (
                <div className="flex items-center gap-6 pt-4 border-t border-white/25">
                  {features.map((feat, index) => {
                    const IconComponent = LucideIcons[feat.icon] || LucideIcons.ShieldCheck;
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <IconComponent className="w-3.5 h-3.5 text-white/30" />
                        <span className="text-[9px] md:text-[11px] font-bold text-white/80 uppercase tracking-widest">
                          {feat.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="pt-2">
              <Link
                href={
                  linkType === "product" ? getProductUrl(propProduct || { slug: productId }) :
                    linkType === "collection" && collectionId ? getCategoryUrl(collectionId) :
                      "#"
                }
                className="group flex items-center justify-center gap-2 bg-white text-black px-6 sm:px-8 md:px-10 py-3 sm:py-3.5 md:py-4 rounded-full font-bold text-[10px] sm:text-xs md:text-sm tracking-widest uppercase transition-all duration-300 hover:bg-neutral-100 hover:scale-[1.03] active:scale-95 inline-flex shadow-xl cursor-pointer"
              >
                <span>{bannerData.ctaText}</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}