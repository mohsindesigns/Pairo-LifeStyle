"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, X } from "lucide-react";

function GalleryCard({ item, index, onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: (index % 3) * 0.1 }}
      className="group cursor-pointer w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Product Image Container */}
      <div className="relative aspect-[3/4] bg-[var(--secondary)] rounded-[16px] md:rounded-[24px] overflow-hidden border border-[var(--border)] shadow-md hover:shadow-xl transition-all duration-500">
        {/* Main Image */}
        <motion.div
          animate={{ scale: isHovered ? 1.05 : 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          {item.image ? (
            <Image
              src={item.image}
              alt={item.title || "Gallery Item"}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
              quality={75}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-border">
              <ShoppingBag className="w-12 h-12 text-border" />
            </div>
          )}
        </motion.div>

        {/* Hover Image Overlay with subtle darken to indicate clickability */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 flex items-center justify-center z-10" />
      </div>
    </motion.div>
  );
}

function GalleryDetailModal({ item, onClose }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const productUrl = item.linkedProductSlug
    ? `/product/${item.linkedProductSlug}`
    : item.linkedProductId
    ? `/product/${item.linkedProductId}`
    : item.linkedProduct
    ? `/product/${item.linkedProduct}`
    : "/shop";

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative max-w-4xl w-full bg-white rounded-[24px] md:rounded-[32px] overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-2 h-auto md:h-[520px] max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 text-black shadow-md flex items-center justify-center hover:bg-white hover:scale-105 transition-all z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Side: Image */}
        <div className="relative aspect-[4/3] md:aspect-auto md:h-full bg-muted min-h-[250px] md:min-h-[520px]">
          {item.image ? (
            <Image
              src={item.image}
              alt={item.title || "Gallery Product"}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="w-16 h-16 text-border" />
            </div>
          )}
        </div>

        {/* Right Side: Details */}
        <div className="p-6 md:p-10 flex flex-col justify-between bg-white overflow-hidden h-full">
          <div className="space-y-4">
            <span className="text-[9px] font-black uppercase tracking-[3px] text-foreground/45">
              Gallery Item
            </span>
            <h2
              style={{ fontFamily: "var(--brand-font)" }}
              className="font-heading font-black text-xl md:text-2xl text-foreground leading-tight tracking-tight"
            >
              {item.title}
            </h2>
          </div>

          {item.description && (
            <div className="border-t border-border pt-4 overflow-y-auto flex-1 max-h-[160px] md:max-h-[240px] pr-2 mt-4">
              <p className="text-foreground/60 text-xs md:text-sm leading-relaxed">
                {item.description}
              </p>
            </div>
          )}

          {/* Bottom: View Product button */}
          <div className="pt-4 mt-4 border-t border-border flex flex-col gap-4">
            <Link
              href={productUrl}
              onClick={onClose}
              className="w-full inline-flex items-center justify-center bg-black text-white py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-neutral-800 transition-all duration-300 shadow-md active:scale-98"
            >
              View Product
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Stable reference: a fresh [] default on every render would re-run the loading effect forever.
const NO_ITEMS = [];

export default function GalleryGrid({
  sectionTitle = "OUR WORK",
  sectionLabel = "FEATURED PIECES",
  sectionDescription = "A carefully curated selection of our finest pieces — each one a testament to premium leather craftsmanship.",
  emptyText = "Gallery coming soon. Check back for our latest work.",
  headingLevel = "h2",
  customItems = NO_ITEMS
}) {
  // Start from the items configured in the dashboard so the first paint is already the real content.
  const hasCustom = Array.isArray(customItems) && customItems.length > 0;
  const [items, setItems] = useState(hasCustom ? customItems : []);
  const [loading, setLoading] = useState(!hasCustom);
  const [activeItem, setActiveItem] = useState(null);
  const Heading = headingLevel;

  useEffect(() => {
    if (customItems && customItems.length > 0) {
      setItems(customItems);
      setLoading(false);
    } else {
      setLoading(true);
      fetch("/api/gallery/items")
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setItems(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [customItems]);

  return (
    <section className="container mx-auto px-4 md:px-8 py-10 md:py-16">
      {/* Section Header */}
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

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white rounded-[20px] overflow-hidden border border-border animate-pulse">
              <div className="aspect-[3/4] bg-muted" />
              <div className="p-5 space-y-3">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
            <ShoppingBag className="w-9 h-9 text-border" />
          </div>
          <p className="text-foreground/40 text-base">{emptyText}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, index) => (
            <GalleryCard
              key={item._id || index}
              item={item}
              index={index}
              onClick={() => setActiveItem(item)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {activeItem && (
          <GalleryDetailModal
            item={activeItem}
            onClose={() => setActiveItem(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
