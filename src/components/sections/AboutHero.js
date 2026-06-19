"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import MarqueeSection from "@/components/home/MarqueeSection";

export default function AboutHero({
  title = "CRAFTING THE FUTURE OF MODERN ELEGANCE",
  subtitle = "We bridge the gap between artisanal heritage and contemporary lifestyle, creating pieces that resonate with the spirit of the modern individual.",
  label = "EST. 2024",
  image = "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&q=80",
  buttonText = "Explore Collection",
  link = "/shop",
  marqueeEnabled = "true",
  marqueeItems
}) {
  const items = marqueeItems?.length > 0 ? marqueeItems : undefined;

  return (
    <section className="relative h-[550px] md:h-[650px] lg:h-[750px] overflow-hidden mx-4 md:mx-8 my-6 rounded-[32px] md:rounded-[40px] shadow-2xl bg-black">
      <div className="absolute inset-0">
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover brightness-75"
          priority
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
      <div className="container mx-auto px-6 md:px-16 h-full flex items-center relative z-10">
        <div className="max-w-2xl">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
            className="space-y-4 md:space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="h-[1.5px] w-8 bg-white/30" />
              <span className="text-white/90 text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase">
                {label}
              </span>
            </div>
            <p className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white heading-font leading-[1.05] tracking-tight">
              {title}
            </p>
            <p className="text-white/90 text-xs md:text-base lg:text-lg max-w-md leading-relaxed font-sans">
              {subtitle}
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4 pt-4 md:pt-6">
              <a
                href={link}
                className="group flex items-center justify-center gap-2 bg-white text-black px-6 sm:px-8 md:px-10 py-3 sm:py-3.5 md:py-4 rounded-full font-bold text-[10px] sm:text-xs md:text-sm tracking-widest uppercase transition-all duration-300 hover:bg-neutral-100 hover:scale-[1.03] active:scale-95 inline-flex shadow-xl"
              >
                <span>{buttonText}</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
            </div>
          </motion.div>
        </div>
      </div>
      {marqueeEnabled === "true" && <MarqueeSection items={items} />}
    </section>
  );
}
