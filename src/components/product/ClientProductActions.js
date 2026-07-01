"use client";

import { useState } from "react";
import { Plus, Minus, ShoppingBag, Check, Ruler, Palette, Shield, Settings } from "lucide-react";

import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import SwatchBubble from "@/components/common/SwatchBubble";
import MadeToMeasureModal from "@/components/product/MadeToMeasureModal";
import CustomizeProductModal from "@/components/product/CustomizeProductModal";

export default function ClientProductActions({ product, onVariantChange }) {
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [m2mOpen, setM2mOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const { addToCart } = useCart();
  const router = useRouter();

  const attributes =
    product.attributes ||
    product.variants?.map((v) => ({
      name: v.name,
      type: v.name.toLowerCase().includes("color") ? "color" : "custom",
      values: v.values.map((val) => ({
        label: val.name || val,
        value: val.name || val,
        hex: val.hex || "",
        colorMode: val.colorMode || "single",
        hex2: val.hex2 || "",
        hex3: val.hex3 || "",
        hex4: val.hex4 || "",
        texture: val.texture || "",
        image: val.image || "",
        swatchType: val.swatchType || "color",
        variantImage: val.variantImage || "",
      })),
    })) ||
    [];

  const handleOptionSelect = (attrName, option) => {
    const newOptions = { ...selectedOptions, [attrName]: option.label };
    setSelectedOptions(newOptions);

    // Find the attribute type
    const attr = attributes.find((a) => a.name === attrName);
    const isColor =
      attr?.type === "color" || attrName.toLowerCase().includes("color");

    if (isColor && onVariantChange) {
      // Always emit — even if no variantImage (empty string = reset to product default)
      onVariantChange({ image: option.variantImage || "", isPartial: true });
    } else if (option.variantImage && onVariantChange) {
      onVariantChange({ image: option.variantImage, isPartial: true });
    }

    // Full combination match (price/stock/sku)
    if (product.variantCombinations?.length) {
      const selectedStr = Object.values(newOptions).join(" / ");
      const match = product.variantCombinations.find(
        (v) => v.title === selectedStr
      );
      if (match && onVariantChange) onVariantChange(match);
    }
  };

  const handleAddToCart = (openDrawer = true) => {
    if (product.productType === "variable") {
      const missingAttrs = attributes.filter(attr => !selectedOptions[attr.name]);
      if (missingAttrs.length > 0) {
        alert(`Please select: ${missingAttrs.map(a => a.name).join(", ")}`);
        return;
      }
    }

    let price = product.price;
    let compareAtPrice = product.compareAtPrice;
    let image = product.images?.[0] || product.image;
    let sku = product.sku;

    if (product.variantCombinations?.length && Object.keys(selectedOptions).length > 0) {
      const attrOrder = product.attributes?.map(a => selectedOptions[a.name]).filter(Boolean) || [];
      const selectedStr = attrOrder.join(" / ");
      const match = product.variantCombinations.find(
        (v) => v.title === selectedStr || Object.values(selectedOptions).join(" / ") === v.title
      );
      if (match) {
        if (match.price !== undefined && match.price !== null) price = match.price;
        if (match.compareAtPrice !== undefined && match.compareAtPrice !== null) compareAtPrice = match.compareAtPrice;
        if (match.image) image = match.image;
        if (match.sku) sku = match.sku;
      }
    }

    for (let i = 0; i < quantity; i++) {
      addToCart({
        ...product,
        price,
        compareAtPrice,
        image,
        sku,
        selectedOptions
      }, openDrawer);
    }
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const handleSecureCheckout = () => {
    if (product.productType === "variable") {
      const missingAttrs = attributes.filter(attr => !selectedOptions[attr.name]);
      if (missingAttrs.length > 0) {
        alert(`Please select: ${missingAttrs.map(a => a.name).join(", ")}`);
        return;
      }
    }
    handleAddToCart(false);
    router.push("/checkout");
  };

  return (
    <>
      <div className="space-y-6 pt-6 border-t border-black/5">
        {product.productType === "variable" && attributes.map((attr) => {
          const isColor =
            attr.type === "color" || attr.name.toLowerCase().includes("color");

          return (
            <div key={attr.name} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] md:text-[12px] font-bold text-primary/80 uppercase tracking-[0.25em]">
                  {attr.name}
                </p>
                {selectedOptions[attr.name] && (
                  <span className="text-[12px] md:text-[13px] font-bold text-primary uppercase tracking-wider">
                    {selectedOptions[attr.name]}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {(attr.values || []).map((option) => {
                  const isSelected = selectedOptions[attr.name] === option.label;

                  if (isColor) {
                    return (
                      <SwatchBubble
                        key={option.label}
                        value={option}
                        selected={isSelected}
                        onClick={() => handleOptionSelect(attr.name, option)}
                        size="w-9 h-9 md:w-10 md:h-10"
                      />
                    );
                  }

                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => handleOptionSelect(attr.name, option)}
                      className={`h-10 px-5 rounded-[var(--radius,0px)] text-[12px] md:text-[13px] font-semibold uppercase tracking-[0.2em] transition-all duration-200 border ${isSelected
                        ? "bg-primary text-white border-primary"
                        : "bg-transparent text-primary/70 border-border hover:border-primary hover:text-primary"
                        }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Stock */}
        <div className="flex items-center gap-2">
          {(() => {
            if (!product.manageStock) {
              return (
                <span className="inline-flex items-center gap-1.5 text-[11px] md:text-[12px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50/80 px-3 py-1 rounded border border-emerald-250">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  In Stock
                </span>
              );
            }
            const stockNum = Number(product.stock) || 0;
            const lowThreshold = Number(product.lowStockThreshold) || 5;
            if (stockNum <= 0) {
              return (
                <span className="inline-flex items-center gap-1.5 text-[11px] md:text-[12px] font-bold uppercase tracking-wider text-red-800 bg-red-50/80 px-3 py-1 rounded border border-red-250">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                  Out of Stock
                </span>
              );
            } else if (stockNum <= lowThreshold) {
              return (
                <span className="inline-flex items-center gap-1.5 text-[11px] md:text-[12px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50/80 px-3 py-1 rounded border border-amber-250">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Low Stock — {stockNum} units remaining
                </span>
              );
            } else {
              return (
                <span className="inline-flex items-center gap-1.5 text-[11px] md:text-[12px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50/80 px-3 py-1 rounded border border-emerald-250">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  In Stock — {stockNum} units
                </span>
              );
            }
          })()}
        </div>

        {/* Quantity + ATC */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            {/* Quantity Selector */}
            <div className="flex items-center justify-between sm:justify-center bg-white border-2 border-gray-300 rounded-lg px-3 sm:px-4 h-11 sm:h-12 shrink-0 hover:border-gray-400 transition-colors">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="text-gray-700 hover:text-gray-900 transition-colors p-1"
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <span className="font-bold text-sm sm:text-base w-8 sm:w-10 text-center text-gray-900 select-none">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="text-gray-700 hover:text-gray-900 transition-colors p-1"
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={handleAddToCart}
              disabled={addedFeedback}
              className={`flex-1 h-11 sm:h-12 rounded-lg font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[11px] sm:text-xs md:text-sm flex items-center justify-center gap-2 sm:gap-2.5 transition-all duration-300 shadow-lg hover:shadow-xl ${addedFeedback
                ? "bg-green-600 text-white border-2 border-green-600"
                : "bg-gray-900 text-white border-2 border-gray-900 hover:bg-gray-800 hover:border-gray-800 active:scale-[0.98]"
                } disabled:opacity-90 disabled:cursor-not-allowed`}
            >
              {addedFeedback ? (
                <>
                  <Check className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={3} />
                  <span>Added to Bag!</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Add to Bag</span>
                </>
              )}
            </button>
          </div>

          {/* Secure Checkout Button */}
          <button
            onClick={handleSecureCheckout}
            className="w-full h-11 sm:h-12 rounded-lg font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[11px] sm:text-xs md:text-sm flex items-center justify-center gap-2 sm:gap-2.5 bg-white text-gray-900 border-2 border-gray-300 hover:border-gray-900 hover:text-gray-900 hover:bg-gray-50 transition-all duration-300 shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Secure Checkout</span>
          </button>

          {/* ─── Premium Feature Buttons ──────────────────────────── */}
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5 sm:gap-3 pt-1">
            {/* Made to Measure */}
            <button
              type="button"
              onClick={() => setM2mOpen(true)}
              className="h-11 sm:h-12 rounded-lg font-bold uppercase tracking-[0.1em] sm:tracking-[0.15em] text-[10px] sm:text-xs flex items-center justify-center gap-2 px-3 sm:px-4 bg-white text-gray-900 border-2 border-gray-300 hover:border-gray-900 hover:bg-gray-50 hover:shadow-md transition-all duration-300 active:scale-[0.98] group"
            >
              <Ruler className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 group-hover:text-gray-900 transition-colors" />
              <span className="whitespace-nowrap">Made to Measure</span>
              <span className="text-[9px] sm:text-[10px] text-green-600 font-bold whitespace-nowrap">+$25</span>
            </button>

            {/* Customize Product */}
            <button
              type="button"
              onClick={() => setCustomizeOpen(true)}
              className="h-11 sm:h-12 rounded-lg font-bold uppercase tracking-[0.1em] sm:tracking-[0.15em] text-[10px] sm:text-xs flex items-center justify-center gap-2 px-3 sm:px-4 bg-white text-gray-900 border-2 border-gray-300 hover:border-gray-900 hover:bg-gray-50 hover:shadow-md transition-all duration-300 active:scale-[0.98] group"
            >
              <Settings className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 group-hover:text-gray-900 transition-colors" />
              <span className="whitespace-nowrap">Customize Product</span>
            </button>
          </div>


        </div>
      </div>

      {/* ─── Modals ─────────────────────────────────────────────── */}
      <MadeToMeasureModal
        product={product}
        isOpen={m2mOpen}
        onClose={() => setM2mOpen(false)}
        onAddToCart={(cartItem) => {
          addToCart(cartItem, true);
        }}
      />
      <CustomizeProductModal
        product={product}
        isOpen={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
      />
    </>
  );
}
