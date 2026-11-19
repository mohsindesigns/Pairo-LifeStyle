"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, X } from "lucide-react";

function GalleryCard({ item, index, onClick }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.08 }}
      className="group block w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 rounded-[14px] md:rounded-[20px]"
      onClick={onClick}
      aria-label={`View ${item.title || "gallery item"}`}
    >
      <div className="relative aspect-[4/5] bg-[var(--secondary)] rounded-[14px] md:rounded-[20px] overflow-hidden border border-[var(--border)] shadow-sm group-hover:shadow-lg transition-shadow duration-500">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.title || "Gallery Item"}
            fill
            loading="lazy"
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 280px"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            quality={75}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <ShoppingBag className="w-10 h-10 text-border" />
          </div>
        )}

        {/* Hover overlay with title + caption */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 md:p-4">
          {item.title && (
            <p
              style={{ fontFamily: "var(--brand-font)" }}
              className="font-heading font-black text-white text-sm md:text-base leading-tight line-clamp-2"
            >
              {item.title}
            </p>
          )}
          {item.description && (
            <p className="hidden md:block mt-1 text-white/75 text-xs leading-snug line-clamp-2">
              {item.description}
            </p>
          )}
        </div>
      </div>

      {/* Always-visible title (touch devices have no hover) */}
      {item.title && (
        <p className="mt-2.5 px-1 text-[11px] md:text-xs font-bold uppercase tracking-[1.5px] text-foreground/80 line-clamp-1 md:group-hover:text-foreground">
          {item.title}
        </p>
      )}
    </motion.button>
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
        className="relative max-w-4xl w-full bg-white rounded-[20px] md:rounded-[28px] overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-[1.2fr_1fr] h-auto md:h-[min(85vh,560px)] max-h-[92vh] overflow-y-auto md:overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 text-black shadow-md flex items-center justify-center hover:bg-white hover:scale-105 transition-all z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Side: Image */}
        <div className="relative h-[45vh] md:h-full bg-neutral-100 min-h-[240px]">
          {item.image ? (
            <Image
              src={item.image}
              alt={item.title || "Gallery Product"}
              fill
              sizes="(max-width: 768px) 100vw, 55vw"
              className="object-contain"
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
    <section className="container mx-auto max-w-6xl px-4 md:px-8 py-10 md:py-16">
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="rounded-[14px] md:rounded-[20px] overflow-hidden border border-border animate-pulse">
              <div className="aspect-[4/5] bg-muted" />
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
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
