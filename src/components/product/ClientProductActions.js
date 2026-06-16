"use client";

import { useState } from "react";
import { Plus, Minus, ShoppingBag, Check } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";

export default function ClientProductActions({ product, onVariantChange }) {
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
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
        image: val.image || "",
        variantImage: "",
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
    <div className="space-y-6 pt-6 border-t border-black/5">
      {product.productType === "variable" && attributes.map((attr) => {
        const isColor =
          attr.type === "color" || attr.name.toLowerCase().includes("color");

        return (
          <div key={attr.name} className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-bold text-black/30 uppercase tracking-[0.25em]">
                {attr.name}
              </p>
              {selectedOptions[attr.name] && (
                <span className="text-[10px] font-bold text-black/60 uppercase tracking-wider">
                  {selectedOptions[attr.name]}
                </span>
              )}
            </div>

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
                      className={`relative w-9 h-9 md:w-10 md:h-10 rounded-full transition-all duration-200 flex items-center justify-center ${
                        isSelected
                          ? "ring-2 ring-offset-2 ring-black scale-105 shadow-lg"
                          : "ring-1 ring-black/10 hover:ring-black/30 hover:scale-105"
                      }`}
                      style={{
                        backgroundColor: option.hex || "#ddd",
                        backgroundImage: option.image
                          ? `url(${option.image})`
                          : "none",
                        backgroundSize: "cover",
                      }}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/10">
                          <Check
                            className={`w-3 h-3 ${
                              option.hex === "#FFFFFF" ||
                              option.hex === "#ffffff"
                                ? "text-black"
                                : "text-white"
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
                    className={`h-10 px-5 rounded-lg text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-200 border-2 ${
                      isSelected
                        ? "bg-black text-white border-black shadow-md"
                        : "bg-[#F9F9F9] text-black/40 border-transparent hover:border-black/10 hover:text-black"
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
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">In Stock</span>
              </>
            );
          }
          const stockNum = Number(product.stock) || 0;
          const lowThreshold = Number(product.lowStockThreshold) || 5;
          if (stockNum <= 0) {
            return (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-red-500">Out of Stock</span>
              </>
            );
          } else if (stockNum <= lowThreshold) {
            return (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600">Low Stock — {stockNum} units remaining</span>
              </>
            );
          } else {
            return (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">In Stock — {stockNum} units</span>
              </>
            );
          }
        })()}
      </div>

      {/* Quantity + ATC */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex items-center bg-[#F9F9F9] rounded-xl border border-black/[0.04] px-4 gap-4 h-12 shadow-sm shrink-0">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="text-black/20 hover:text-black transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-bold text-base w-5 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="text-black/20 hover:text-black transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleAddToCart}
            className={`flex-1 h-12 rounded-xl font-bold uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.98] shadow-xl ${
              addedFeedback
                ? "bg-emerald-500 text-white shadow-emerald-500/30"
                : "bg-black text-white hover:bg-black/90 shadow-black/20"
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

        <button
          onClick={handleSecureCheckout}
          className="w-full h-12 border-2 border-black rounded-xl text-black font-bold uppercase tracking-[0.25em] text-[10px] hover:bg-black hover:text-white transition-all duration-200 active:scale-[0.98]"
        >
          Secure Checkout
        </button>
      </div>
    </div>
  );
}
