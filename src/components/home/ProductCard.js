"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { ShoppingBag, Eye, Star } from "lucide-react";
import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { getProductUrl } from "@/lib/routes";
import SizeSelectionModal from "@/components/product/SizeSelectionModal";

export default function ProductCard({ product }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { addToCart } = useCart();

  useEffect(() => {
    setMounted(true);
  }, []);

  const productAttributes =
    product.attributes || product.variants?.map((v) => ({ name: v.name, values: v.values })) || [];
  const needsOptions = product.productType === "variable" && productAttributes.length > 0;

  const handleAddToBag = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (needsOptions) {
      setIsOptionsModalOpen(true);
    } else {
      addToCart(product);
    }
  };

  const getAbsoluteUrl = (url) => {
    if (!url) return "/placeholder.jpg";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
      return url;
    }
    return url.startsWith("/") ? url : `/${url}`;
  };

  const mainImage = getAbsoluteUrl(product.images?.[0] || product.image);
  const hoverImage = product.images?.[1] || product.image2 ? getAbsoluteUrl(product.images?.[1] || product.image2) : null;

  return (
    <div
      className="group cursor-pointer w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Product Image Container — padding-bottom hack ensures consistent square ratio in all browsers */}
      <div className="relative w-full bg-[var(--secondary)] rounded-[16px] md:rounded-[24px] overflow-hidden border border-[var(--border)]" style={{ paddingBottom: '100%' }}>
        <Link href={getProductUrl(product)} className="absolute inset-0 block">

          {/* Main Image */}
          <img
            src={mainImage}
            alt={product.imageAlts?.[mainImage] || product.name || "Product"}
            loading="eager"
            decoding="async"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: isHovered && hoverImage ? 0 : 1,
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              transition: 'opacity 0.6s ease, transform 0.6s ease',
            }}
          />

          {/* Hover Image */}
          {hoverImage && (
            <img
              src={hoverImage}
              alt={product.imageAlts?.[hoverImage] || product.name || "Product"}
              loading="lazy"
              decoding="async"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: isHovered ? 1 : 0,
                transform: isHovered ? 'scale(1)' : 'scale(1.05)',
                transition: 'opacity 0.6s ease, transform 0.6s ease',
              }}
            />
          )}
        </Link>

        {/* Hover Actions */}
        <div className="absolute bottom-2 md:bottom-3 left-2 md:left-3 right-2 md:right-3 flex gap-2 z-20 pointer-events-none group-hover:pointer-events-auto">
          <button
            onClick={handleAddToBag}
            className="group/btn relative flex-[2] bg-black text-white h-9 md:h-10 rounded-lg md:rounded-xl font-bold text-[9px] md:text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 md:gap-2 shadow-xl translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out active:scale-95 hover:bg-neutral-800"
          >
            <ShoppingBag className="w-3 h-3 md:w-3.5 md:h-3.5" />
            {needsOptions ? "Select Options" : "Add to Bag"}
          </button>

          <Link href={getProductUrl(product)} className="flex-1">
            <button className="group/view w-full bg-white/90 backdrop-blur-md text-black h-9 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center shadow-xl translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-75 ease-out border border-black/5 active:scale-95 hover:bg-neutral-100">
              <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          </Link>
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-3 md:mt-4 space-y-1 md:space-y-2 px-1">
        <h3
          style={{ fontFamily: "var(--brand-font)" }}
          className="text-[11px] md:text-[13px] font-bold uppercase tracking-wider text-foreground/85 group-hover:text-foreground transition-colors truncate"
        >
          {product.name}
        </h3>

        <div className="flex items-center justify-between border-t border-border pt-2 md:pt-3">
          <div className="flex items-center gap-2 md:gap-3">
            <span className="text-sm md:text-xl font-bold text-foreground">${product.price}</span>
            {(product.compareAtPrice || product.oldPrice) && (
              <span className="text-[10px] md:text-sm font-medium text-foreground/45 line-through">
                ${product.compareAtPrice || product.oldPrice}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Star className="w-2.5 h-2.5 fill-primary text-primary" />
            <span className="text-[9px] font-normal text-foreground/60">
              {(product.rating || 0).toFixed(1)} ({product.reviewCount || 0})
            </span>
          </div>
        </div>
      </div>

      {mounted && typeof document !== "undefined" && needsOptions && createPortal(
        <SizeSelectionModal
          product={product}
          isOpen={isOptionsModalOpen}
          onClose={() => setIsOptionsModalOpen(false)}
          onConfirm={(cartItem) => addToCart(cartItem)}
        />,
        document.body
      )}
    </div>
  );
}
