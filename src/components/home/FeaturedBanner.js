"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { ArrowRight } from "lucide-react";
import siteData from "@/lib/data.json";

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
    <section className="mx-4 md:mx-8 my-12 md:my-16">
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
        <div className="w-full relative z-10 px-6 md:px-16 py-10 md:py-0">
          <div className="max-w-full md:max-w-lg lg:max-w-xl space-y-6 md:space-y-8">
            {/* Minimalist Badges */}
            <div className="flex flex-wrap gap-2">
               <span className="bg-white/10 backdrop-blur-md text-white text-[7px] md:text-[9px] font-bold px-3 py-1.5 rounded-full tracking-[0.1em] md:tracking-[0.2em] uppercase border border-white/10">
                 {bannerData.badge1}
               </span>
               <span className="bg-[#D4B100] text-black text-[7px] md:text-[9px] font-bold px-3 py-1.5 rounded-full tracking-[0.1em] md:tracking-[0.2em] uppercase">
                 {bannerData.badge2}
               </span>
            </div>

            {/* Scaled Typography */}
            <div className="space-y-2 md:space-y-4">
               <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold heading-font text-white uppercase leading-none tracking-tighter">
                 {bannerData.title}
               </h2>
               <p className="text-white/40 text-[10px] md:text-sm lg:text-base font-light leading-relaxed max-w-sm md:max-w-md">
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
                <div className="flex items-center gap-6 pt-4 border-t border-white/5">
                  {features.map((feat, index) => {
                    const IconComponent = LucideIcons[feat.icon] || LucideIcons.ShieldCheck;
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <IconComponent className="w-3.5 h-3.5 text-white/30" />
                        <span className="text-[8px] md:text-[10px] font-bold text-white/60 uppercase tracking-widest">
                          {feat.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Action Area */}
            <div className="pt-2">
               <Link 
                 href={
                   linkType === "product" && productId ? `/product/${productId}` : 
                   linkType === "collection" && collectionId ? `/shop?category=${collectionId}` : 
                   "#"
                 }
                 className="inline-block"
               >
                  <div className="group relative overflow-hidden bg-white text-black px-8 md:px-12 py-3 md:py-4 rounded-full font-bold text-[9px] md:text-xs uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 cursor-pointer">
                     <span className="relative z-10 flex items-center gap-2 md:gap-3 group-hover:text-white transition-colors duration-500">
                       {bannerData.ctaText}
                       <ArrowRight className="w-4 h-4 md:w-5 md:h-5 transition-transform duration-500 group-hover:translate-x-1" />
                     </span>
                     <div className="absolute inset-0 bg-black translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[0.22, 1, 0.36, 1]" />
                  </div>
               </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
