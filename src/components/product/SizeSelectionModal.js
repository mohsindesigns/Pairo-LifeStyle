"use client";

import { useState, useEffect } from "react";
import { X, Check, ShoppingBag } from "lucide-react";

export default function SizeSelectionModal({ product, isOpen, onClose, onConfirm }) {
  const [selectedOptions, setSelectedOptions] = useState({});
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedOptions({});
      setAdded(false);
    }
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const attributes =
    product.attributes ||
    product.variants?.map((v) => ({
      name: v.name,
      type: v.name.toLowerCase().includes("color") ? "color" : "custom",
      values: (v.values || []).map((val) => ({
        label: val.name || val,
        value: val.name || val,
        hex: val.hex || "",
        image: val.image || "",
      })),
    })) ||
    [];

  const missingAttrs = attributes.filter((attr) => !selectedOptions[attr.name]);
  const canAdd = missingAttrs.length === 0;

  const handleOptionSelect = (attrName, option) => {
    setSelectedOptions((prev) => ({ ...prev, [attrName]: option.label }));
  };

  const getAbsoluteUrl = (url) => {
    if (!url) return "/placeholder.jpg";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
    return url.startsWith("/") ? url : `/${url}`;
  };

  const image = getAbsoluteUrl(product.images?.[0] || product.image);

  const handleAdd = () => {
    if (!canAdd) return;

    let price = product.price;
    let compareAtPrice = product.compareAtPrice;
    let itemImage = product.images?.[0] || product.image;
    let sku = product.sku;

    if (product.variantCombinations?.length) {
      const attrOrder = product.attributes?.map((a) => selectedOptions[a.name]).filter(Boolean) || [];
      const selectedStr = attrOrder.join(" / ");
      const match = product.variantCombinations.find(
        (v) => v.title === selectedStr || Object.values(selectedOptions).join(" / ") === v.title
      );
      if (match) {
        if (match.price !== undefined && match.price !== null) price = match.price;
        if (match.compareAtPrice !== undefined && match.compareAtPrice !== null) compareAtPrice = match.compareAtPrice;
        if (match.image) itemImage = match.image;
        if (match.sku) sku = match.sku;
      }
    }

    onConfirm({ ...product, price, compareAtPrice, image: itemImage, sku, selectedOptions });
    setAdded(true);
    setTimeout(() => {
      onClose();
    }, 550);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:max-w-md max-h-[92vh] bg-[var(--background)] flex flex-col overflow-hidden shadow-2xl border border-black rounded-t-[20px] sm:rounded-[var(--radius,0px)] animate-ssm-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-black shrink-0">
          <div className="w-14 h-14 rounded-[var(--radius,0px)] overflow-hidden bg-[var(--secondary)] border border-black/10 shrink-0">
            <img src={image} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              style={{ fontFamily: "var(--brand-font)" }}
              className="text-[12px] font-bold uppercase tracking-wider text-black truncate"
            >
              {product.name}
            </p>
            <p className="text-[13px] font-bold text-black mt-0.5">${product.price}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border border-black rounded-[var(--radius,0px)] hover:bg-black hover:text-white transition-all duration-300 active:scale-[0.98] text-black shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 min-h-0">
          <p className="text-[10px] font-semibold text-black/45 uppercase tracking-[0.2em]">
            Select your options to add this item to your bag
          </p>

          {attributes.map((attr) => {
            const isColor = attr.type === "color" || attr.name.toLowerCase().includes("color");
            const isSize = attr.name.toLowerCase() === "size";

            return (
              <div key={attr.name} className="space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-bold text-black uppercase tracking-[0.25em]">{attr.name}</p>
                  {selectedOptions[attr.name] && (
                    <span className="text-[12px] font-bold text-black uppercase tracking-wider">
                      — {selectedOptions[attr.name]}
                    </span>
                  )}
                </div>

                {isSize ? (
                  <div className="grid grid-cols-4 gap-2">
                    {(attr.values || []).map((option) => {
                      const isSelected = selectedOptions[attr.name] === option.label;
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => handleOptionSelect(attr.name, option)}
                          className={`w-full h-10 rounded-[var(--radius,0px)] text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-200 border ${
                            isSelected
                              ? "bg-black text-white border-black"
                              : "bg-transparent text-black border-black/30 hover:border-black"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(attr.values || []).map((option) => {
                      const isSelected = selectedOptions[attr.name] === option.label;

                      if (isColor) {
                        return (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => handleOptionSelect(attr.name, option)}
                            title={option.label}
                            className={`relative w-9 h-9 rounded-full transition-all duration-200 flex items-center justify-center ${
                              isSelected
                                ? "ring-1 ring-offset-2 ring-black scale-105"
                                : "ring-1 ring-black/10 hover:ring-black/30 hover:scale-105"
                            }`}
                            style={{
                              backgroundColor: option.hex || "#ddd",
                              backgroundImage: option.image ? `url(${option.image})` : "none",
                              backgroundSize: "cover",
                            }}
                          >
                            {isSelected && (
                              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/10">
                                <Check
                                  className={`w-3 h-3 ${
                                    option.hex === "#FFFFFF" || option.hex === "#ffffff" ? "text-black" : "text-white"
                                  }`}
                                  strokeWidth={3}
                                />
                              </div>
                            )}
                          </button>
                        );
                      }

                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => handleOptionSelect(attr.name, option)}
                          className={`h-9 min-w-[2.75rem] px-3 rounded-[var(--radius,0px)] text-[10px] font-medium uppercase tracking-[0.15em] transition-all duration-200 border ${
                            isSelected
                              ? "bg-black text-white border-black"
                              : "bg-transparent text-black border-black/30 hover:border-black"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-black shrink-0">
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className={`w-full h-12 rounded-[var(--radius,0px)] font-bold uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] border ${
              canAdd
                ? "bg-black text-white border-black hover:bg-black/90"
                : "bg-black/5 text-black/30 border-black/10 cursor-not-allowed"
            }`}
          >
            {added ? (
              <>
                <Check className="w-3.5 h-3.5" /> Added to Bag
              </>
            ) : canAdd ? (
              <>
                <ShoppingBag className="w-3.5 h-3.5" /> Add to Bag
              </>
            ) : (
              `Select ${missingAttrs.map((a) => a.name).join(" & ")}`
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ssmIn {
          from { opacity: 0; transform: scale(0.97) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-ssm-in { animation: ssmIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
    </div>
  );
}
