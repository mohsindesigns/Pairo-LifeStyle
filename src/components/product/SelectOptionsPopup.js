"use client";

import { useEffect } from "react";
import { X, Ruler, Palette, Tag, ArrowRight } from "lucide-react";

function getAttrIcon(name = "") {
  const n = name.toLowerCase();
  if (n.includes("size")) return Ruler;
  if (n.includes("color") || n.includes("colour")) return Palette;
  return Tag;
}

export default function SelectOptionsPopup({ product, missing, isOpen, onClose, onSelectOptions }) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const getAbsoluteUrl = (url) => {
    if (!url) return "/placeholder.jpg";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
    return url.startsWith("/") ? url : `/${url}`;
  };

  const image = getAbsoluteUrl(product.images?.[0] || product.image);
  const missingList = missing || [];

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:max-w-sm bg-white flex flex-col overflow-hidden shadow-2xl border border-black rounded-t-[20px] sm:rounded-[var(--radius,0px)] animate-sop-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-black shrink-0">
          <div className="w-12 h-12 rounded-[var(--radius,0px)] overflow-hidden bg-[var(--secondary)] border border-black/10 shrink-0">
            <img src={image} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              style={{ fontFamily: "var(--brand-font)" }}
              className="text-[11px] font-bold uppercase tracking-wider text-black truncate"
            >
              {product.name}
            </p>
            <p className="text-[12px] font-bold text-black/60 mt-0.5">${product.price}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border border-black rounded-[var(--radius,0px)] hover:bg-black hover:text-white transition-all duration-300 active:scale-[0.98] text-black shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          <p className="text-[10px] font-semibold text-black/45 uppercase tracking-[0.2em]">
            Just a couple more details before this goes in your bag
          </p>

          <div className="space-y-2">
            {missingList.map((attr) => {
              const Icon = getAttrIcon(attr.name);
              return (
                <div
                  key={attr.name}
                  className="flex items-center gap-3 px-3.5 py-2.5 border border-black/15 rounded-[var(--radius,0px)] bg-black/[0.02]"
                >
                  <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[12px] font-bold uppercase tracking-wider text-black">
                    Choose a {attr.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-black shrink-0">
          <button
            onClick={onSelectOptions}
            className="w-full h-12 rounded-[var(--radius,0px)] bg-black text-white font-bold uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-2 hover:bg-black/90 transition-all duration-300 active:scale-[0.98] border border-black"
          >
            Select Options <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes sopIn {
          from { opacity: 0; transform: scale(0.97) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-sop-in { animation: sopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
    </div>
  );
}
