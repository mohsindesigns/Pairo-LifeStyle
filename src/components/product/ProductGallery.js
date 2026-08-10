"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { getOptimizedImage } from "@/lib/cloudinary";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function ProductGallery({ images = [], variantImage, productName = "", imageAlts = {} }) {
  const allImages = images.length > 0 ? images : ["/placeholder.jpg"];
  const [mainImage, setMainImage] = useState(allImages[0]);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Zoom state
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const mainRef = useRef(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayImage = mainImage;

  useEffect(() => {
    if (variantImage) {
      setMainImage(variantImage);
    } else {
      setMainImage(allImages[0]);
    }
  }, [variantImage, allImages]);

  useEffect(() => {
    if (allImages.length > 0) {
      setMainImage(allImages[0]);
    }
  }, [images]);

  const handleThumbClick = (img) => {
    setMainImage(img);
    setIsZoomed(false);
  };

  // --- Desktop zoom ---
  const handleMouseMove = useCallback((e) => {
    if (!mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  }, []);

  const handleMouseEnter = () => setIsZoomed(true);
  const handleMouseLeave = () => setIsZoomed(false);

  // --- Lightbox ---
  const openLightbox = () => {
    const idx = allImages.indexOf(displayImage);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const prevImage = () => setLightboxIndex(i => (i - 1 + allImages.length) % allImages.length);
  const nextImage = () => setLightboxIndex(i => (i + 1) % allImages.length);

  // Keyboard navigation and scroll lock for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "ArrowRight") nextImage();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxOpen]);

  // Touch swipe for lightbox
  const touchStartX = useRef(null);
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? nextImage() : prevImage();
    touchStartX.current = null;
  };

  return (
    <>
      <div className="flex flex-col md:flex-row gap-3 overflow-hidden w-full">
        {/* Thumbnails */}
        <div className="flex md:flex-col gap-2 md:w-[72px] order-2 md:order-1 overflow-x-auto md:overflow-y-auto scrollbar-hide shrink-0 max-w-full">
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
                <img
                  src={getOptimizedImage(img, "thumbnail")}
                  alt={imageAlts[img] || `${productName} thumbnail ${i + 1}`}
                  loading="lazy"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Main image — Desktop: hover zoom | Mobile: tap to open lightbox */}
        <div
          ref={mainRef}
          className="relative flex-1 aspect-square bg-[#F4F4F4] rounded-2xl overflow-hidden order-1 md:order-2 shadow-sm"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
          onClick={openLightbox}
          style={{ cursor: isZoomed ? "zoom-in" : "zoom-in" }}
        >
          <img
            key={displayImage}
            src={getOptimizedImage(displayImage, "gallery")}
            alt={imageAlts[displayImage] || productName}
            loading="eager"
            decoding="async"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
              transform: isZoomed ? "scale(2.2)" : "scale(1)",
              transition: 'transform 0.1s ease-out',
            }}
          />
          {/* Zoom hint (shown only on non-zoomed hover) */}
          {!isZoomed && (
            <div className="absolute bottom-3 right-3 bg-white/80 backdrop-blur-sm rounded-full px-2.5 py-1 text-[11px] font-medium text-black/60 shadow-sm pointer-events-none select-none opacity-0 group-hover:opacity-100 md:flex hidden items-center gap-1">
              🔍 Hover to zoom
            </div>
          )}
          {/* Mobile tap hint */}
          <div className="md:hidden absolute bottom-3 right-3 bg-white/80 backdrop-blur-sm rounded-full px-2.5 py-1 text-[11px] font-medium text-black/60 shadow-sm pointer-events-none select-none">
            Tap to view
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {mounted && lightboxOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center animate-fade-in"
          onClick={closeLightbox}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Close */}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full p-2.5 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Counter */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/60 text-[13px] font-medium tracking-widest">
            {lightboxIndex + 1} / {allImages.length}
          </div>

          {/* Prev */}
          {allImages.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              className="absolute left-3 md:left-6 z-10 bg-white/10 hover:bg-white/25 text-white rounded-full p-3 transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Image */}
          <div
            className="relative w-full max-w-2xl mx-14 aspect-[3/4] md:aspect-auto md:h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              key={allImages[lightboxIndex]}
              src={getOptimizedImage(allImages[lightboxIndex], "gallery")}
              alt={imageAlts[allImages[lightboxIndex]] || productName}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          </div>

          {/* Next */}
          {allImages.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              className="absolute right-3 md:right-6 z-10 bg-white/10 hover:bg-white/25 text-white rounded-full p-3 transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Dot indicators */}
          {allImages.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5">
              {allImages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className={`w-2 h-2 rounded-full transition-all ${i === lightboxIndex ? "bg-white scale-125" : "bg-white/40 hover:bg-white/60"}`}
                  aria-label={`Go to image ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
