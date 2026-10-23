"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Ruler } from "lucide-react";

// Stable reference: a fresh [] default on every render would re-run the loading effect forever.
const NO_CHARTS = [];

export default function SizeChartDisplay({
  sectionTitle = "SIZE CHARTS",
  sectionLabel = "MEASUREMENTS",
  sectionDescription = "Use these detailed size charts to find your perfect fit.",
  headingLevel = "h2",
  customCharts = NO_CHARTS
}) {
  // Start from the charts configured in the dashboard so the first paint is already the real content.
  const hasCustom = Array.isArray(customCharts) && customCharts.length > 0;
  const [items, setItems] = useState(hasCustom ? customCharts : []);
  const [loading, setLoading] = useState(!hasCustom);
  const Heading = headingLevel;

  useEffect(() => {
    if (customCharts && customCharts.length > 0) {
      setItems(customCharts);
      setLoading(false);
    } else {
      setLoading(true);
      fetch("/api/size-chart/items")
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setItems(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [customCharts]);

  return (
    <section className="container mx-auto px-4 md:px-8 py-10 md:py-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-14"
      >
        <span className="inline-block text-[11px] font-bold uppercase tracking-[4px] text-primary/60 mb-4">
          {sectionLabel}
        </span>
        <Heading className="font-heading text-4xl md:text-5xl font-black text-foreground tracking-tight mb-4">
          {sectionTitle}
        </Heading>
        <p className="text-foreground/60 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          {sectionDescription}
        </p>
      </motion.div>

      {/* Charts */}
      {loading ? (
        <div className="space-y-10">
          {[0, 1].map(i => (
            <div key={i} className="rounded-[24px] border border-border overflow-hidden animate-pulse">
              <div className="h-12 bg-muted" />
              <div className="aspect-[16/9] bg-muted/60" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
            <Ruler className="w-9 h-9 text-border" />
          </div>
          <p className="text-foreground/40 text-base">Size charts coming soon.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {items.map((item, index) => (
            <motion.div
              key={item._id || index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="rounded-[24px] border border-border overflow-hidden shadow-md bg-white"
            >
              {/* Chart image */}
              <div className="relative overflow-hidden">
                <img
                  src={item.image}
                  alt="Size Chart"
                  className="w-full h-auto"
                  loading="lazy"
                />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
