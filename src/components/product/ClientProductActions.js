"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Minus, ShoppingBag, Check, Ruler, Palette, Shield, Settings } from "lucide-react";

import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import SwatchBubble from "@/components/common/SwatchBubble";
import MadeToMeasureModal from "@/components/product/MadeToMeasureModal";
import CustomizeProductModal from "@/components/product/CustomizeProductModal";
import SizeGuideModal from "@/components/product/SizeGuideModal";
import { usePopup } from "@/context/PopupContext";

export default function ClientProductActions({ product, onVariantChange }) {
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [m2mOpen, setM2mOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const { addToCart } = useCart();
  const router = useRouter();
  const { showPopup } = usePopup();

  const getResolvedSizeChart = () => {
    const source = product.sizeChartSource || (product.sizeGuide?.enabled ? "product_custom" : "category_default");
    
    if (source === "none") {
      return null;
    }
    
    if (source === "product_custom") {
      return {
        type: "product_custom",
        sizeGuide: product.sizeGuide
      };
    }
    
    if (source === "custom" && product.sizeChart) {
      return {
        type: "reusable",
        chart: product.sizeChart
      };
    }
    
    if (source === "category_default") {
      const primaryCat = product.primaryCategory;
      if (primaryCat && primaryCat.sizeChart) {
        return {
          type: "reusable",
          chart: primaryCat.sizeChart
        };
      }
      
      if (product.categories && product.categories.length > 0) {
        for (const cat of product.categories) {
          if (cat && cat.sizeChart) {
             return {
               type: "reusable",
               chart: cat.sizeChart
             };
          }
        }
      }
    }
    
    return null;
  };

  const resolvedSizeChart = getResolvedSizeChart();
  const hasSizeChart = resolvedSizeChart !== null;

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

  const sizeAttribute = attributes.find(a => a.name.toLowerCase() === "size");
  const isCustomSizeSelected = sizeAttribute && selectedOptions[sizeAttribute.name]?.toLowerCase() === "custom";

  const handleCustomizeClick = () => {
    const updatedOptions = { ...selectedOptions };
    for (const key of Object.keys(updatedOptions)) {
      if (key.toLowerCase().includes("size") || key.toLowerCase().includes("color")) {
        delete updatedOptions[key];
      }
    }
    setSelectedOptions(updatedOptions);
    setCustomizeOpen(true);
  };

  const handleM2mClick = () => {
    const updatedOptions = { ...selectedOptions };
    const sizeAttr = attributes.find(a => a.name.toLowerCase() === "size");
    if (sizeAttr) {
      delete updatedOptions[sizeAttr.name];
    }
    setSelectedOptions(updatedOptions);
    setM2mOpen(true);
  };

  const handleOptionSelect = (attrName, option) => {
    const newOptions = { ...selectedOptions, [attrName]: option.label };
    setSelectedOptions(newOptions);

    const attr = attributes.find((a) => a.name === attrName);
    const isColor =
      attr?.type === "color" || attrName.toLowerCase().includes("color");

    if (isColor && onVariantChange) {
      onVariantChange({ image: option.variantImage || "", isPartial: true });
    } else if (option.variantImage && onVariantChange) {
      onVariantChange({ image: option.variantImage, isPartial: true });
    }

    if (product.variantCombinations?.length) {
      const attrOrder = product.attributes?.map(a => newOptions[a.name]).filter(Boolean) || [];
      const selectedStr = attrOrder.join(" / ");
      const match = product.variantCombinations.find(
        (v) => v.title === selectedStr || Object.values(newOptions).join(" / ") === v.title
      );
      if (match && onVariantChange) onVariantChange(match);
    }
  };

  const handleAddToCart = (openDrawer = true) => {
    if (product.productType === "variable") {
      const missingAttrs = attributes.filter(attr => !selectedOptions[attr.name]);
      if (missingAttrs.length > 0) {
        const missingLabels = missingAttrs.map(a => a.name).join(" and ");
        showPopup({
          title: "Select Options Required",
          message: `Please choose your preferred ${missingLabels} before adding this item to your bag.`,
          type: "warning",
          confirmText: "Select Options",
        });
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
        const missingLabels = missingAttrs.map(a => a.name).join(" and ");
        showPopup({
          title: "Select Options Required",
          message: `Please choose your preferred ${missingLabels} before proceeding to checkout.`,
          type: "warning",
          confirmText: "Select Options",
        });
        return;
      }
    }
    handleAddToCart(false);
    router.push("/checkout");
  };

  return (
    <>
      <div className="space-y-4">
        {product.productType === "variable" && attributes.map((attr) => {
          const isColor =
            attr.type === "color" || attr.name.toLowerCase().includes("color");

          return (
            <div key={attr.name} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] md:text-[12px] font-bold text-black uppercase tracking-[0.25em]">
                    {attr.name}
                  </p>
                  {selectedOptions[attr.name] && (
                    <span className="text-[12px] md:text-[13px] font-bold text-black uppercase tracking-wider">
                      — {selectedOptions[attr.name]}
                    </span>
                  )}
                </div>
                {attr.name.toLowerCase() === "size" && hasSizeChart && (
                  <button
                    type="button"
                    onClick={() => setSizeGuideOpen(true)}
                    className="text-[11px] font-bold text-black underline uppercase tracking-wider hover:text-black/80 transition-colors"
                  >
                    Size guide
                  </button>
                )}
              </div>

              {attr.name.toLowerCase() === "size" ? (
                <div className="grid grid-cols-4 gap-2">
                  {(attr.values || []).map((option) => {
                    const isSelected = selectedOptions[attr.name] === option.label;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => handleOptionSelect(attr.name, option)}
                        className={`w-full h-10 rounded-[var(--radius,0px)] text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-200 border ${isSelected
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
                          className={`relative w-9 h-9 md:w-10 md:h-10 rounded-full transition-all duration-200 flex items-center justify-center ${isSelected
                            ? "ring-1 ring-offset-2 ring-black scale-105"
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
                                className={`w-3 h-3 ${option.hex === "#FFFFFF" ||
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
                        className={`h-9 min-w-[2.75rem] px-3 rounded-[var(--radius,0px)] text-[10px] font-medium uppercase tracking-[0.15em] transition-all duration-200 border ${isSelected
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

        {product.productType === "variable" && attributes.length > 0 && (
          <hr className="border-t border-black/10" />
        )}

        <div className="space-y-2.5 pt-1">
          <div className="flex gap-2 items-stretch">
            <div className="flex items-center justify-center bg-transparent rounded-[var(--radius,0px)] border border-black/30 gap-2 h-11 min-w-[100px] shrink-0">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="text-black hover:text-black/70 transition-colors p-1"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-bold text-[14px] w-6 text-center text-black select-none">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="text-black hover:text-black/70 transition-colors p-1"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
               onClick={handleAddToCart}
               className="flex-1 h-11 rounded-[var(--radius,0px)] font-bold uppercase tracking-[0.2em] text-[11px] flex items-center justify-center transition-all duration-300 active:scale-[0.98] border bg-black text-white border-black hover:bg-black/90"
             >
              {addedFeedback ? "Added!" : "Add to Bag"}
            </button>

            <button
              onClick={handleSecureCheckout}
              className="flex-1 h-11 rounded-[var(--radius,0px)] border border-black/30 text-black font-bold uppercase tracking-[0.2em] text-[11px] hover:bg-black hover:text-white hover:border-black transition-all duration-200 active:scale-[0.98] flex items-center justify-center"
            >
              Checkout
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleM2mClick}
              className="w-full h-11 rounded-[var(--radius,0px)] border border-black/30 text-black font-bold uppercase tracking-[0.2em] text-[11px] hover:bg-black hover:text-white hover:border-black transition-all duration-200 active:scale-[0.98] flex items-center justify-center"
            >
              Measure (+$25)
            </button>
            <button
              type="button"
              onClick={handleCustomizeClick}
              className="w-full h-11 rounded-[var(--radius,0px)] border border-black/30 text-black font-bold uppercase tracking-[0.2em] text-[11px] hover:bg-black hover:text-white hover:border-black transition-all duration-200 active:scale-[0.98] flex items-center justify-center"
            >
              Customize
            </button>
          </div>
        </div>
      </div>

      {mounted && typeof document !== "undefined" && createPortal(
        <>
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
          <SizeGuideModal
            isOpen={sizeGuideOpen}
            onClose={() => setSizeGuideOpen(false)}
            resolvedSizeChart={resolvedSizeChart}
          />
        </>,
        document.body
      )}
    </>
  );
}