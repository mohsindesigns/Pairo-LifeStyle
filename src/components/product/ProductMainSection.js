"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import ProductGallery from "./ProductGallery";
import ClientProductActions from "./ClientProductActions";
import {
  ShieldCheck,
  Truck,
  Zap,
  Package,
  Globe,
  Star,
  Layers,
  Heart,
  Anchor,
  Award,
  RefreshCw,
  Info,
  HelpCircle,
  MessageSquare
} from "lucide-react";

const ICON_MAP = {
  Shield: ShieldCheck,
  Truck: Truck,
  Zap: Zap,
  Package: Package,
  Globe: Globe,
  Star: Star,
  Layers: Layers,
  Heart: Heart,
  Anchor: Anchor,
  Award: Award,
  Refresh: RefreshCw
};

function getDeliveryRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + 15);
  const end = new Date(now);
  end.setDate(end.getDate() + 20);

  const fmt = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const startStr = fmt(start);
  const endStr = fmt(end);

  // Show year only if end date is in a different year than today
  const yearSuffix =
    end.getFullYear() !== now.getFullYear()
      ? ` ${end.getFullYear()}`
      : "";

  return `${startStr} – ${endStr}${yearSuffix}`;
}

export default function ProductMainSection({ product }) {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedVariantImage, setSelectedVariantImage] = useState("");
  const [deliveryRange, setDeliveryRange] = useState("");

  useEffect(() => {
    setDeliveryRange(getDeliveryRange());
  }, []);

  const handleVariantChange = (variant) => {
    if (variant.isPartial) {
      // Always set — empty string resets gallery to product default
      setSelectedVariantImage(variant.image ?? "");
      return;
    }
    setSelectedVariant(variant);
    if (variant.image) setSelectedVariantImage(variant.image);
  };

  const displayPrice = selectedVariant?.price || product.price;
  const displayCompareAtPrice = selectedVariant ? (selectedVariant.compareAtPrice !== undefined && selectedVariant.compareAtPrice !== null ? selectedVariant.compareAtPrice : null) : product.compareAtPrice;
  const displaySku = selectedVariant?.sku || product.sku;
  let displayStock = product.stock;
  if (selectedVariant?.stock !== undefined) {
    displayStock = selectedVariant.stock;
  } else if (product.productType === 'variable' && product.variantCombinations?.length) {
    displayStock = product.variantCombinations.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  }

  // Affiliate referral customer discount
  const { affiliateDiscount } = useCart();
  const hasAffiliateDiscount = affiliateDiscount && affiliateDiscount.type !== 'None' && affiliateDiscount.value > 0;
  const affiliateDiscountedPrice = (() => {
    if (!hasAffiliateDiscount) return null;
    if (affiliateDiscount.type === 'Percentage') {
      return Math.max(0, displayPrice * (1 - affiliateDiscount.value / 100));
    } else if (affiliateDiscount.type === 'Fixed') {
      return Math.max(0, displayPrice - affiliateDiscount.value);
    }
    return null;
  })();
  const affiliateSavingsLabel = hasAffiliateDiscount
    ? affiliateDiscount.type === 'Percentage'
      ? `${affiliateDiscount.value}% Referral Discount`
      : `$${affiliateDiscount.value} Referral Discount`
    : null;

  const categoryName = product.categories?.[0]?.name || product.category || "Collection";

  return (
    <div className="">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-8 items-start">
        {/* LEFT SIDE: STICKY GALLERY - 60% */}
        <div className="lg:col-span-3 lg:sticky lg:top-28 self-start w-full min-w-0">
          <ProductGallery
            images={product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : [])}
            variantImage={selectedVariantImage}
            productName={product.name}
            imageAlts={product.imageAlts}
          />
        </div>

        {/* RIGHT SIDE: SCROLLABLE INFO - 40% */}
        <div className="lg:col-span-2 space-y-4 min-w-0 overflow-hidden lg:pt-1.5">
          <h1 className="text-[20px] md:text-[30px] font-medium heading-font tracking-tight leading-[1.2] text-primary">
            {product.name}
          </h1>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("switch-product-tab", { detail: "Rating & Reviews" }));
                  const el = document.getElementById("product-tabs-section");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }
              }}
              className="flex items-center gap-2 text-[13px] md:text-[14px] font-semibold text-primary/80 hover:text-primary hover:underline transition-all cursor-pointer text-left group"
              title="Click to view ratings & reviews"
            >
              <Star className="w-3.5 h-3.5 fill-primary text-primary transition-transform group-hover:scale-110" />
              <span>{(product.rating || 0).toFixed(1)}/5.0</span>
              <span className="text-black/20">•</span>
              <span className="underline-offset-2">({product.reviewCount || 0} Reviews)</span>
            </button>

            {deliveryRange && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-black/10 bg-white/80 text-[11px] font-semibold text-black tracking-wide shadow-sm"
                style={{ backdropFilter: "blur(6px)" }}
              >
                <Truck className="w-3 h-3 text-black/50 shrink-0" />
                Delivered between&nbsp;<span className="font-bold">{deliveryRange}</span>
              </span>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-3.5">
            {hasAffiliateDiscount && affiliateDiscountedPrice !== null ? (
              <>
                <span className="text-2xl font-semibold tracking-tight text-primary">${affiliateDiscountedPrice.toFixed(2)}</span>
                <span className="text-sm font-medium text-primary/40 line-through">${displayPrice}</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/30 px-2.5 py-0.5 rounded-[var(--radius,0px)] select-none">
                  {affiliateSavingsLabel}
                </span>
              </>
            ) : (
              <>
                <span className="text-2xl font-semibold tracking-tight text-primary">${displayPrice}</span>
                {displayCompareAtPrice > displayPrice && (
                  <>
                    <span className="text-sm font-medium text-primary/40 line-through">${displayCompareAtPrice}</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary bg-primary/10 border border-primary/30 px-2.5 py-0.5 rounded-[var(--radius,0px)] select-none">
                      Save {Math.round(((displayCompareAtPrice - displayPrice) / displayCompareAtPrice) * 100)}%
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          <hr className="border-t border-black/10" />

          {product.shortDescription && (
            <div
              className="short-description-prose text-black text-sm md:text-base leading-relaxed"
              dangerouslySetInnerHTML={{ __html: product.shortDescription }}
            />
          )}

          <hr className="border-t border-black/10" />

          {/* Variant Selector + Stock + ATC */}
          <ClientProductActions
            product={{ ...product, stock: displayStock }}
            onVariantChange={handleVariantChange}
          />

          {/* Stats Block - CMS Driven */}
          {product.stats && product.stats.length > 0 && (
            <div className="grid grid-cols-2 gap-6 pt-2">
              {product.stats.map((stat, i) => {
                const Icon = ICON_MAP[stat.icon] || Info;
                return (
                  <div key={i} className="flex items-center gap-3 group">
                    <div className="p-2.5 bg-white border border-border rounded-[var(--radius,0px)] transition-colors duration-300 group-hover:bg-primary group-hover:border-primary">
                      <Icon className="w-3.5 h-3.5 text-primary/70 group-hover:text-white transition-colors" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-normal uppercase tracking-[0.15em] text-primary/60">{stat.label}</p>
                      <p className="text-[12px] font-normal text-black uppercase tracking-wider">{stat.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}