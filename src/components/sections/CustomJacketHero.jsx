"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";

export default function CustomJacketHero({
  title = "CRAFT YOUR PERFECT JACKET",
  subtitle = "Every jacket is a story. Tell us yours — and we'll bring it to life with premium leather, expert craftsmanship, and timeless style.",
  label = "BESPOKE SERVICE",
  image = "https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?q=80&w=2000&auto=format&fit=crop",
  mobileImage = "",
  buttonText = "Start Your Journey",
  buttonLink = "#inquiry-form",
  breadcrumb = "Custom Jacket",
  headingLevel = "h1",
}) {
  const Heading = headingLevel;

  return (
    <section className="container mx-auto px-2 sm:px-4 md:px-8 my-6">
      <div className="relative h-[420px] md:h-[480px] lg:h-[540px] rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden bg-primary">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src={mobileImage && typeof window !== "undefined" && window.innerWidth < 768 ? mobileImage : image}
            alt={title}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="relative h-full flex flex-col justify-between p-8 md:p-12 lg:p-16">
          {/* Top Row — Label + Breadcrumb */}
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-white text-[11px] font-bold uppercase tracking-[3px]">{label}</span>
            </motion.div>

            {/* Breadcrumb */}
            <motion.nav
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="hidden md:flex items-center gap-1.5 text-white/80 text-[12px]"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white font-medium">{breadcrumb}</span>
            </motion.nav>
          </div>

          {/* Center Content */}
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
            >
              <Heading className="font-heading text-white text-4xl md:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight mb-5">
                {title}
              </Heading>
              <p className="text-white/90 text-base md:text-lg leading-relaxed mb-8 max-w-lg">
                {subtitle}
              </p>
              {buttonText && (
                <motion.a
                  href={buttonLink}
                  className="inline-flex items-center gap-3 bg-white text-primary px-7 py-3.5 font-bold text-[13px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all duration-300 rounded-sm group"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {buttonText}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </motion.a>
              )}
            </motion.div>
          </div>

          {/* Bottom Decorative Bar */}
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-white/20" />
            <span className="text-white/60 text-[10px] uppercase tracking-[4px] font-medium">Pairo Bespoke</span>
            <div className="h-px flex-1 bg-white/20" />
          </div>
        </div>
      </div>
    </section>
  );
}
