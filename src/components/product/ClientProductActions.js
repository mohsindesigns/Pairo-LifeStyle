"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, Minus, ShoppingBag, Check, Ruler, Palette, Shield, Settings } from "lucide-react";

import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import { trackViewItem } from "@/lib/analytics";
import SwatchBubble from "@/components/common/SwatchBubble";
import MadeToMeasureModal from "@/components/product/MadeToMeasureModal";
import CustomizeProductModal from "@/components/product/CustomizeProductModal";
import SizeGuideModal from "@/components/product/SizeGuideModal";
import SelectOptionsPopup from "@/components/product/SelectOptionsPopup";

import { recordOptionSelect } from "@/lib/siteAnalytics";

export default function ClientProductActions({ product, onVariantChange, unitPrice }) {
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [m2mOpen, setM2mOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [missingAttrsModal, setMissingAttrsModal] = useState({ isOpen: false, missing: [] });
  const [highlightedAttrs, setHighlightedAttrs] = useState([]);
  const attrRefs = useRef({});
  const highlightTimeoutRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    return () => window.clearTimeout(highlightTimeoutRef.current);
  }, []);

  // GA4 Event: view_item — fire once per distinct product detail view.
  const lastViewedId = useRef(null);
  useEffect(() => {
    const pid = product?._id || product?.id;
    if (pid && lastViewedId.current !== pid) {
      lastViewedId.current = pid;
      trackViewItem(product);
    }
  }, [product]);
  const { addToCart } = useCart();
  const router = useRouter();

  const focusMissingAttributes = (missing) => {
    const firstNode = missing[0] && attrRefs.current[missing[0].name];
    if (firstNode) {
      firstNode.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setHighlightedAttrs(missing.map((a) => a.name));
    window.clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = window.setTimeout(() => setHighlightedAttrs([]), 1600);
  };

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
    recordOptionSelect(attrName, option.label, product);
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
        setMissingAttrsModal({ isOpen: true, missing: missingAttrs });
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
        setMissingAttrsModal({ isOpen: true, missing: missingAttrs });
        return;
      }
    }
    handleAddToCart(false);
    router.push("/checkout");
  };

  // Total shown inside the Add to cart button (unit price x quantity)
  const actionTotal = Number.isFinite(Number(unitPrice))
    ? (Number(unitPrice) * quantity).toFixed(2)
    : null;

  const handleCloseMissingAttrsModal = () => {
    setMissingAttrsModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleJumpToMissingAttrs = () => {
    const missing = missingAttrsModal.missing;
    setMissingAttrsModal({ isOpen: false, missing: [] });
    focusMissingAttributes(missing);
  };

  return (
    <>
      <div className="space-y-4">
        {product.productType === "variable" && attributes.map((attr) => {
          const isColor =
            attr.type === "color" || attr.name.toLowerCase().includes("color");

          const isHighlighted = highlightedAttrs.includes(attr.name);

          return (
            <div
              key={attr.name}
              ref={(el) => { attrRefs.current[attr.name] = el; }}
              className={`space-y-2.5 -m-2.5 p-2.5 rounded-[var(--radius,0px)] transition-shadow duration-700 ${
                isHighlighted ? "shadow-[0_0_0_2px_#dc2626] animate-attr-shake" : "shadow-[0_0_0_0px_transparent]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <p className={`text-[15px] md:text-[17px] font-bold transition-colors duration-700 ${isHighlighted ? "text-red-600" : "text-primary"}`}>
                    {attr.name}:
                  </p>
                  {selectedOptions[attr.name] && (
                    <span className="text-[13px] md:text-[14px] font-medium text-primary/60">
                      {selectedOptions[attr.name]}
                    </span>
                  )}
                </div>
                {attr.name.toLowerCase() === "size" && hasSizeChart && (
                  <button
                    type="button"
                    onClick={() => setSizeGuideOpen(true)}
                    className="text-[13px] font-medium text-primary underline underline-offset-2 hover:text-primary/70 transition-colors"
                  >
                    Size guide
                  </button>
                )}
              </div>

              {attr.name.toLowerCase() === "size" ? (
                <div className="inline-flex flex-wrap max-w-full rounded-[var(--radius,8px)] border border-primary/30 overflow-hidden divide-x divide-primary/20">
                  {(attr.values || []).map((option) => {
                    const isSelected = selectedOptions[attr.name] === option.label;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => handleOptionSelect(attr.name, option)}
                        className={`h-11 min-w-[3.25rem] px-4 text-[14px] font-semibold uppercase transition-colors duration-200 ${isSelected
                          ? "bg-primary text-white"
                          : "bg-white text-primary hover:bg-primary/5"
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
                          className={`relative w-10 h-10 md:w-11 md:h-11 rounded-full transition-all duration-200 flex items-center justify-center ${isSelected
                            ? "ring-2 ring-offset-2 ring-primary"
                            : "ring-1 ring-black/15 hover:ring-primary/50 hover:scale-105"
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
                            <span className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full bg-primary border-2 border-white flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
                            </span>
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

        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-3">
            <p className="text-[15px] md:text-[17px] font-bold text-primary">Quantity:</p>
            <div className="flex items-center justify-center rounded-[var(--radius,8px)] border border-primary/30 gap-2 h-10 min-w-[104px]">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="text-primary hover:text-primary/70 transition-colors p-1.5"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-bold text-[14px] w-6 text-center text-primary select-none">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="text-primary hover:text-primary/70 transition-colors p-1.5"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Primary CTA — color follows the theme's primary color set in admin */}
          <button
            type="button"
            onClick={() => handleAddToCart(true)}
            className="w-full h-14 rounded-[var(--radius,12px)] bg-primary text-white font-bold uppercase tracking-wide text-[15px] md:text-[16px] flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:brightness-110 transition-all duration-200 active:scale-[0.99]"
          >
            {addedFeedback ? (
              <>
                <Check className="w-5 h-5" strokeWidth={3} /> Added to cart
              </>
            ) : (
              <>
                <ShoppingBag className="w-5 h-5" />
                Add to cart{actionTotal !== null ? ` — $${actionTotal}` : ""}
              </>
            )}
          </button>

          {/* Secondary CTA — outlined in the same theme color */}
          <button
            type="button"
            onClick={handleSecureCheckout}
            className="w-full h-12 rounded-[var(--radius,12px)] border-2 border-primary bg-white text-primary font-bold uppercase tracking-wide text-[15px] hover:bg-primary hover:text-white transition-all duration-200 active:scale-[0.99] flex items-center justify-center"
          >
            Buy now
          </button>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleM2mClick}
              className="w-full h-10 rounded-[var(--radius,8px)] border border-primary/30 text-primary font-semibold text-[13px] hover:border-primary hover:bg-primary/5 transition-all duration-200 flex items-center justify-center"
            >
              Made to measure (+$25)
            </button>
            <button
              type="button"
              onClick={handleCustomizeClick}
              className="w-full h-10 rounded-[var(--radius,8px)] border border-primary/30 text-primary font-semibold text-[13px] hover:border-primary hover:bg-primary/5 transition-all duration-200 flex items-center justify-center"
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
          <SelectOptionsPopup
            product={product}
            missing={missingAttrsModal.missing}
            isOpen={missingAttrsModal.isOpen}
            onClose={handleCloseMissingAttrsModal}
            onSelectOptions={handleJumpToMissingAttrs}
          />
        </>,
        document.body
      )}

      <style jsx global>{`
        @keyframes attrShake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-3px); }
          40%, 60% { transform: translateX(3px); }
        }
        .animate-attr-shake { animation: attrShake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
      `}</style>
    </>
  );
}