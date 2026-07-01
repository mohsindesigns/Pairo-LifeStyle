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
                <p className="text-[11px] md:text-[12px] font-black text-black uppercase tracking-[0.25em]">
                  {attr.name}
                </p>
                {selectedOptions[attr.name] && (
                  <span className="text-[12px] md:text-[13px] font-black text-black uppercase tracking-wider">
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
                      className={`h-10 px-5 rounded text-[12px] md:text-[13px] font-black uppercase tracking-[0.2em] transition-all duration-200 border-2 ${isSelected
                        ? "bg-black text-white border-black"
                        : "bg-white text-black border-black/30 hover:border-black"
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
        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Quantity Selector */}
            <div className="flex items-center justify-between sm:justify-center bg-white border-2 border-black rounded px-4 gap-4 h-12 shrink-0">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="text-black/50 hover:text-black transition-colors p-1"
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-bold text-sm w-6 text-center text-black select-none">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="text-black/50 hover:text-black transition-colors p-1"
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={handleAddToCart}
              className={`flex-1 h-12 rounded font-black uppercase tracking-[0.2em] text-[11px] sm:text-xs md:text-[13px] flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.98] border-2 ${
                addedFeedback
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "bg-black border-black text-white hover:bg-neutral-800"
              }`}
            >
              {addedFeedback ? (
                <>
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                  Added!
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  Add to Bag
                </>
              )}
            </button>
          </div>

          {/* Secure Checkout */}
          <button
            onClick={handleSecureCheckout}
            className="w-full h-12 bg-white text-black border-2 border-black rounded font-black uppercase tracking-[0.2em] text-[11px] sm:text-xs md:text-[13px] flex items-center justify-center gap-2.5 hover:bg-black hover:text-white transition-all duration-300 active:scale-[0.98]"
          >
            <Shield className="w-4 h-4" />
            Secure Checkout
          </button>

          {/* ─── Premium Feature Buttons ──────────────────────────── */}
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 pt-0.5">
            {/* Made to Measure */}
            <button
              type="button"
              onClick={() => setM2mOpen(true)}
              className="w-full h-12 bg-white text-black border-2 border-black rounded font-black uppercase tracking-[0.15em] text-[10px] sm:text-[11px] flex items-center justify-center gap-2 hover:bg-black hover:text-white transition-all duration-300 active:scale-[0.98]"
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>Measure (+$25)</span>
            </button>

            {/* Customize Product */}
            <button
              type="button"
              onClick={() => setCustomizeOpen(true)}
              className="w-full h-12 bg-white text-black border-2 border-black rounded font-black uppercase tracking-[0.15em] text-[10px] sm:text-[11px] flex items-center justify-center gap-2 hover:bg-black hover:text-white transition-all duration-300 active:scale-[0.98]"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Customize</span>
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
