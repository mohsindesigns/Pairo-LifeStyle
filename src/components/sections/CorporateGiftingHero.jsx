"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";

export default function CorporateGiftingHero({
  label = "CORPORATE COLLECTION • MADE TO ORDER",
  title = "CUSTOMIZE CORPORATE GIFTING",
  subtitle = "Handcrafted leather gift packs for your team and clients, finished with your logo and wrapped to impress.",
  image = "",
  primaryButtonText = "Build your pack",
  primaryButtonLink = "#gifting-inquiry",
  secondaryButtonText = "See how it works",
  secondaryButtonLink = "#gifting-process",
  breadcrumb = "Corporate Gifting",
  headingLevel = "h1",
}) {
  const Heading = headingLevel;

  return (
    <section className="container mx-auto px-2 sm:px-4 md:px-8 my-6">
      <div className="relative min-h-[420px] md:min-h-[480px] lg:min-h-[520px] rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden bg-primary">
        {image && (
          <div className="absolute inset-0">
            <Image src={image} alt={title} fill priority className="object-cover" sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/25" />
          </div>
        )}

        <div className="relative min-h-[420px] md:min-h-[480px] lg:min-h-[520px] flex flex-col justify-between p-8 md:p-12 lg:p-16">
          <div className="flex items-center justify-between">
            {label && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-white text-[11px] font-bold uppercase tracking-[3px]">{label}</span>
              </motion.div>
            )}
            {breadcrumb && (
              <nav className="hidden md:flex items-center gap-1.5 text-white/60 text-[12px]" aria-label="Breadcrumb">
                <Link href="/" className="hover:text-white transition-colors">Home</Link>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-white font-medium">{breadcrumb}</span>
              </nav>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="max-w-2xl py-10"
          >
            <Heading className="font-heading text-white text-4xl md:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight mb-5">
              {title}
            </Heading>
            <p className="text-white/80 text-base md:text-lg leading-relaxed mb-8 max-w-lg">{subtitle}</p>
            <div className="flex flex-wrap gap-3">
              {primaryButtonText && (
                <a
                  href={primaryButtonLink || "#gifting-inquiry"}
                  className="inline-flex items-center gap-3 bg-white text-primary px-7 py-3.5 font-bold text-[13px] uppercase tracking-widest hover:bg-black hover:text-white transition-all duration-300 rounded-sm group"
                >
                  {primaryButtonText}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
              )}
              {secondaryButtonText && (
                <a
                  href={secondaryButtonLink || "#gifting-process"}
                  className="inline-flex items-center gap-3 border border-white/40 text-white px-7 py-3.5 font-bold text-[13px] uppercase tracking-widest hover:bg-white hover:text-primary transition-all duration-300 rounded-sm"
                >
                  {secondaryButtonText}
                </a>
              )}
            </div>
          </motion.div>

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-white/20" />
            <span className="text-white/40 text-[10px] uppercase tracking-[4px] font-medium">Pairo Corporate</span>
            <div className="h-px flex-1 bg-white/20" />
          </div>
        </div>
      </div>
    </section>
  );
}
