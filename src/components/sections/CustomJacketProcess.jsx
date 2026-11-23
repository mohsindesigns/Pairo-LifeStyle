"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

function ProcessStep({ item, index }) {
  const isEven = index % 2 === 0; // Even = image left, content right
  const headingText = item.heading || item.title || "Process Step";

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay: 0.1 }}
      className={`flex flex-col ${isEven ? "md:flex-row" : "md:flex-row-reverse"} gap-8 md:gap-16 items-center`}
    >
      {/* Image Side */}
      <div className="w-full md:w-1/2">
        <div className="relative aspect-[4/3] rounded-[24px] overflow-hidden shadow-xl bg-muted group">
          {item.image ? (
            <Image
              src={item.image}
              alt={headingText}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-muted to-border flex items-center justify-center">
              <span className="text-6xl font-black text-border opacity-40">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
          )}
          {/* Step Number Overlay */}
          <div className="absolute top-5 left-5 w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-black text-lg shadow-lg">
            {String(item.stepNumber || index + 1).padStart(2, "0")}
          </div>
        </div>
      </div>

      {/* Content Side */}
      <div className="w-full md:w-1/2 space-y-5">
        <div className="inline-block bg-primary/8 px-3 py-1 rounded-full">
          <span className="text-primary text-[11px] font-bold uppercase tracking-[3px]">
            Step {String(item.stepNumber || index + 1).padStart(2, "0")}
          </span>
        </div>
        <h3 className="font-heading text-3xl md:text-4xl font-black text-foreground leading-tight tracking-tight">
          {headingText}
        </h3>
        <p className="text-foreground/80 text-base md:text-lg leading-relaxed">
          {item.description || ""}
        </p>

        {/* Decorative line */}
        <div className="flex items-center gap-3 pt-2">
          <div className="w-8 h-0.5 bg-primary" />
          <div className="w-3 h-0.5 bg-primary/40" />
        </div>
      </div>
    </motion.div>
  );
}

// Stable reference: a fresh [] default on every render would re-trigger the effect below forever.
const NO_STEPS = [];

export default function CustomJacketProcess({
  sectionTitle = "HOW IT WORKS",
  sectionLabel = "THE PROCESS",
  sectionDescription = "We've streamlined the bespoke jacket experience into four elegant steps — from your first idea to your finished masterpiece.",
  headingLevel = "h2",
  customSteps = NO_STEPS
}) {
  // Start from the steps configured in the dashboard so the first paint is already the real content.
  const hasCustom = Array.isArray(customSteps) && customSteps.length > 0;
  const [items, setItems] = useState(hasCustom ? customSteps : []);
  const [loading, setLoading] = useState(!hasCustom);
  const Heading = headingLevel;

  useEffect(() => {
    if (customSteps && customSteps.length > 0) {
      setItems(customSteps);
      setLoading(false);
    } else {
      setLoading(true);
      fetch("/api/custom-jacket/process")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setItems(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [customSteps]);

  const defaultSteps = [
    {
      stepNumber: 1,
      image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=1000&auto=format&fit=crop",
      heading: "Share Your Vision",
      description: "Fill out our detailed inquiry form. Tell us about your dream jacket — the style, leather, color, and any special details that matter to you. The more you share, the closer we get to perfection."
    },
    {
      stepNumber: 2,
      image: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=1000&auto=format&fit=crop",
      heading: "Expert Consultation",
      description: "Our master craftsmen review your specifications and reach out to discuss your vision in detail. We'll recommend the finest leathers, hardware, and construction techniques to match your requirements."
    },
    {
      stepNumber: 3,
      image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1000&auto=format&fit=crop",
      heading: "Masterful Creation",
      description: "Every stitch is placed by hand. We source only the finest premium leathers and construct your jacket using traditional techniques refined over decades. Quality is never compromised."
    },
    {
      stepNumber: 4,
      image: "https://images.unsplash.com/photo-1520975954732-35dd2229969e?q=80&w=1000&auto=format&fit=crop",
      heading: "Delivered to You",
      description: "Your bespoke jacket arrives in our signature packaging, ready to wear for a lifetime. We include a care guide and offer ongoing support to ensure your jacket stays as perfect as the day it arrived."
    }
  ];

  const displayItems = items.length > 0 ? items : defaultSteps;

  return (
    <section className="container mx-auto px-4 md:px-8 py-10 md:py-16">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16 md:mb-20"
      >
        <span className="inline-block text-[11px] font-bold uppercase tracking-[4px] text-primary/80 mb-4">
          {sectionLabel}
        </span>
        <Heading className="font-heading text-4xl md:text-5xl font-black text-foreground tracking-tight mb-5">
          {sectionTitle}
        </Heading>
        <p className="text-foreground/80 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          {sectionDescription}
        </p>
      </motion.div>

      {/* Process Steps */}
      {loading ? (
        <div className="space-y-20">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col md:flex-row gap-8 animate-pulse">
              <div className="w-full md:w-1/2 aspect-[4/3] rounded-[24px] bg-muted" />
              <div className="w-full md:w-1/2 space-y-4 py-8">
                <div className="h-4 w-20 bg-muted rounded-full" />
                <div className="h-8 w-64 bg-muted rounded" />
                <div className="h-20 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-20 md:space-y-28">
          {displayItems.map((item, index) => (
            <ProcessStep key={item._id || index} item={item} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}
