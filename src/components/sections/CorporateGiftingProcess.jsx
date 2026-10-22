"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { withSectionDefaults } from "@/lib/section-defaults";

function Step({ step, index }) {
  const isEven = index % 2 === 0;
  const num = String(index + 1).padStart(2, "0");
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7 }}
      className={`flex flex-col ${isEven ? "md:flex-row" : "md:flex-row-reverse"} gap-8 md:gap-16 items-center`}
    >
      <div className="w-full md:w-1/2">
        <div className="relative aspect-[4/3] rounded-[24px] overflow-hidden shadow-xl bg-secondary group">
          {step.image ? (
            <Image
              src={step.image}
              alt={step.title || `Step ${num}`}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-7xl font-black text-primary/15">{num}</span>
            </div>
          )}
          <div className="absolute top-5 left-5 w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-black text-lg shadow-lg">
            {num}
          </div>
        </div>
      </div>

      <div className="w-full md:w-1/2 space-y-5">
        <div className="inline-block bg-primary/10 px-3 py-1 rounded-full">
          <span className="text-primary text-[11px] font-bold uppercase tracking-[3px]">Step {num}</span>
        </div>
        <h3 className="font-heading text-3xl md:text-4xl font-black text-foreground leading-tight tracking-tight">
          {step.title}
        </h3>
        <p className="text-foreground/80 text-base md:text-lg leading-relaxed">{step.description}</p>
        <div className="flex items-center gap-3 pt-2">
          <div className="w-8 h-0.5 bg-primary" />
          <div className="w-3 h-0.5 bg-primary/40" />
        </div>
      </div>
    </motion.div>
  );
}

export default function CorporateGiftingProcess(props) {
  const { sectionLabel, sectionTitle, sectionDescription, steps, headingLevel = "h2" } =
    withSectionDefaults("corporate_gifting_process", props);
  const Heading = headingLevel;
  const list = Array.isArray(steps) ? steps : [];

  return (
    <section id="gifting-process" className="container mx-auto px-4 md:px-8 py-10 md:py-16 scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16 md:mb-20"
      >
        {sectionLabel && (
          <span className="inline-block text-[11px] font-bold uppercase tracking-[4px] text-primary/80 mb-4">
            {sectionLabel}
          </span>
        )}
        <Heading className="font-heading text-4xl md:text-5xl font-black text-foreground tracking-tight mb-5">
          {sectionTitle}
        </Heading>
        {sectionDescription && (
          <p className="text-foreground/80 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">{sectionDescription}</p>
        )}
      </motion.div>

      <div className="space-y-20 md:space-y-28">
        {list.map((step, i) => (
          <Step key={i} step={step} index={i} />
        ))}
      </div>
    </section>
  );
}
