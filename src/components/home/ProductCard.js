"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Eye, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { getProductUrl } from "@/lib/routes";

export default function ProductCard({ product }) {
  const [isHovered, setIsHovered] = useState(false);
  const { addToCart } = useCart();

  // Safety fallbacks for images
  const mainImage = product.images?.[0] || product.image || "/placeholder.jpg";
  const hoverImage = product.images?.[1] || product.image2;
  const productId = product.slug || product._id || product.id;

  return (
    <div
      className="group cursor-pointer w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Product Image Container */}
      <div className="relative aspect-square bg-[var(--secondary)] rounded-[16px] md:rounded-[24px] overflow-hidden border border-[var(--border)]">
        <Link href={getProductUrl(product)} className="block h-full w-full">
          {/* Main Image */}
          <motion.div
            animate={{ opacity: isHovered && hoverImage ? 0 : 1, scale: isHovered ? 1.05 : 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
             {mainImage && (
              <Image
                src={mainImage}
                alt={product.imageAlts?.[mainImage] || product.name || "Product"}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
                quality={75}
                unoptimized={process.env.NODE_ENV === 'development' || (!mainImage.startsWith("http") && !mainImage.includes("cloudinary.com"))}
              />
            )}
          </motion.div>

          {/* Hover Image */}
          {hoverImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 1.1 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
            >
              <Image
                src={hoverImage}
                alt={product.imageAlts?.[hoverImage] || product.name || "Product"}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
                quality={75}
                unoptimized={process.env.NODE_ENV === 'development' || (!hoverImage.startsWith("http") && !hoverImage.includes("cloudinary.com"))}
              />
            </motion.div>
          )}
        </Link>

        {/* Unified Premium Hover Actions */}
        <div className="absolute bottom-2 md:bottom-3 left-2 md:left-3 right-2 md:right-3 flex gap-2 z-20 pointer-events-none group-hover:pointer-events-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              addToCart(product);
            }}
            className="group/btn relative flex-[2] bg-black text-white h-9 md:h-10 rounded-lg md:rounded-xl font-bold text-[9px] md:text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 md:gap-2 shadow-xl translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out active:scale-95 hover:bg-neutral-800"
          >
            <ShoppingBag className="w-3 h-3 md:w-3.5 md:h-3.5" />
            Add to Bag
          </button>

          <Link href={getProductUrl(product)} className="flex-1">
            <button className="group/view w-full bg-white/90 backdrop-blur-md text-black h-9 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center shadow-xl translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-75 ease-out border border-black/5 active:scale-95 hover:bg-neutral-100">
              <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          </Link>
        </div>

        {/* Category Badge */}
        <div className="absolute top-2 md:top-4 left-2 md:left-4 z-10">
          <span className="bg-black/80 backdrop-blur-md text-white text-[6px] md:text-[8px] font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-md md:rounded-lg tracking-[0.1em] md:tracking-[0.2em] uppercase shadow-lg">
            {product.category || "COLLECTION"}
          </span>
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-3 md:mt-4 space-y-1 md:space-y-2 px-1">
        <p 
          style={{ fontFamily: "var(--brand-font)" }}
          className="text-[11px] md:text-[13px] font-bold uppercase tracking-wider text-foreground/85 group-hover:text-foreground transition-colors truncate"
        >
          {product.name}
        </p>

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
    </div>
  );
}
