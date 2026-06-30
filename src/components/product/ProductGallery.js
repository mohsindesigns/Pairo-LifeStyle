"use client";

import { useState } from "react";
import Image from "next/image";
import { getOptimizedImage, getCloudinarySrcSet } from "@/lib/cloudinary";
import { ZoomIn } from "lucide-react";

export default function ProductGallery({ images = [], variantImage, productName = "", imageAlts = {} }) {
  const allImages = images.length > 0 ? images : ["/placeholder.jpg"];
  const [mainImage, setMainImage] = useState(allImages[0]);

  // Sync gallery whenever variantImage prop changes (including reset to "")
  // Using a separate ref approach to avoid stale closure issues
  const displayImage = (() => {
    // variantImage="" means "reset to product default" - handled by parent
    if (variantImage) return variantImage;
    return mainImage;
  })();

  const handleThumbClick = (img) => {
    setMainImage(img);
  };

  return (
    <div className="flex flex-col md:flex-row gap-3">
      {/* Thumbnails */}
      <div className="flex md:flex-col gap-2 md:w-[72px] order-2 md:order-1 overflow-x-auto md:overflow-y-auto scrollbar-hide shrink-0">
        {allImages.map((img, i) => {
          const isActive = displayImage === img;
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleThumbClick(img)}
              className={`relative aspect-square w-[72px] md:w-full bg-[#F4F4F4] rounded-lg overflow-hidden cursor-pointer shrink-0 transition-all duration-200 outline-none border-2 ${
                isActive
                  ? "border-black shadow-md"
                  : "border-transparent opacity-50 hover:opacity-90 hover:border-black/20"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <Image
                src={getOptimizedImage(img, "thumbnail")}
                alt={imageAlts[img] || `${productName} thumbnail ${i + 1}`}
                fill
                className="object-cover"
                sizes="72px"
                unoptimized={!img.startsWith("http") && !img.includes("cloudinary.com")}
              />
            </button>
          );
        })}
      </div>

      {/* Main image */}
      <div className="relative flex-1 aspect-[3/4] bg-[#F4F4F4] rounded-2xl overflow-hidden order-1 md:order-2 shadow-sm group">
        <Image
          key={displayImage}
          src={getOptimizedImage(displayImage, "gallery")}
          srcSet={getCloudinarySrcSet(displayImage)}
          alt={imageAlts[displayImage] || productName}
          fill
          className="object-cover transition-opacity duration-300 animate-fadeIn"
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          decoding="async"
          unoptimized={!displayImage.startsWith("http") && !displayImage.includes("cloudinary.com")}
        />
        <div className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-sm">
          <ZoomIn className="w-4 h-4 text-black/50" />
        </div>
      </div>
    </div>
  );
}
