"use client";

import { useState } from "react";
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

export default function ProductMainSection({ product }) {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedVariantImage, setSelectedVariantImage] = useState("");

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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
      {/* LEFT SIDE: STATIC/STICKY GALLERY */}
      <div className="lg:col-span-6 lg:sticky lg:top-24 transition-all duration-500">
        <ProductGallery
          images={product.images}
          variantImage={selectedVariantImage}
          productName={product.name}
          imageAlts={product.imageAlts}
        />
      </div>

      {/* RIGHT SIDE: SCROLLABLE INFO */}
      <div className="lg:col-span-6 space-y-8 md:space-y-12">
        <div className="space-y-4 md:space-y-6">
          <div className="space-y-2">
            <p className="text-[11px] md:text-[12px] font-bold text-primary/80 uppercase tracking-[0.25em]">
              Pairo Studio — {categoryName}
            </p>
            <p className="text-[18px] md:text-[30px] font-medium heading-font tracking-tight leading-[1.2] text-primary">
              {product.name}
            </p>
          </div>

          <p className="flex items-center gap-2 text-[13px] md:text-[14px] font-semibold text-primary/80">
            <Star className="w-3.5 h-3.5 fill-primary text-primary" />
            <span>{(product.rating || 0).toFixed(1)}/5.0</span>
            <span className="text-black/10">•</span>
            <span>({product.reviewCount || 0} Reviews)</span>
          </p>

          <div className="flex items-center flex-wrap gap-3.5">
            {hasAffiliateDiscount && affiliateDiscountedPrice !== null ? (
              <>
                <span className="text-2xl font-semibold tracking-tight text-emerald-600">${affiliateDiscountedPrice.toFixed(2)}</span>
                <span className="text-sm font-medium text-primary/40 line-through">${displayPrice}</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-[var(--radius,0px)] select-none">
                  {affiliateSavingsLabel}
                </span>
              </>
            ) : (
              <>
                <span className="text-2xl font-semibold tracking-tight text-primary">${displayPrice}</span>
                {displayCompareAtPrice > displayPrice && (
                  <>
                    <span className="text-sm font-medium text-primary/40 line-through">${displayCompareAtPrice}</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-[var(--radius,0px)] select-none">
                      Save {Math.round(((displayCompareAtPrice - displayPrice) / displayCompareAtPrice) * 100)}%
                    </span>
                  </>
                )}
              </>
            )}
            {displaySku && (
              <span className="text-[11px] md:text-[12px] font-semibold text-primary/60 uppercase tracking-[0.15em] ml-auto">SKU: {displaySku}</span>
            )}
          </div>
        </div>

        {product.shortDescription && (
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary/20" />
            <p className="text-primary/85 text-sm md:text-base leading-relaxed font-normal italic pl-6 py-0.5">
              {product.shortDescription}
            </p>
          </div>
        )}

        {/* Variant Selector + Stock + ATC */}
        <ClientProductActions
          product={{ ...product, stock: displayStock }}
          onVariantChange={handleVariantChange}
        />

        {/* Stats Block - CMS Driven */}
        {product.stats && product.stats.length > 0 && (
          <div className="grid grid-cols-2 gap-6 pt-8 border-t border-black/5">
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

        {/* FAQ Summary Section */}
        {product.faqs && product.faqs.length > 0 && (
          <div className="pt-8 border-t border-black/5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.2em] text-primary/60">Frequent Inquiries</h3>
              <div className="flex items-center gap-2 text-[10px] font-medium text-black/40 uppercase tracking-widest">
                <MessageSquare className="w-3 h-3 text-primary/60" /> {product.faqs.length} Total
              </div>
            </div>
            <div className="space-y-2.5">
              {product.faqs.slice(0, 2).map((faq, i) => (
                <div key={i} className="p-4 bg-white border border-border rounded-[var(--radius,0px)] flex gap-3.5 hover:border-primary/30 transition-all cursor-pointer group">
                  <div className="shrink-0 w-7 h-7 bg-white border border-border/60 rounded-[var(--radius,0px)] flex items-center justify-center group-hover:bg-primary transition-colors">
                    <HelpCircle className="w-3.5 h-3.5 text-primary/70 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-normal text-black tracking-tight">{faq.question}</p>
                    <p className="text-[12px] text-primary/70 leading-relaxed line-clamp-1 font-light">{faq.answer}</p>
                  </div>
                </div>
              ))}
              <p className="text-center text-[10px] font-normal text-black/40 uppercase tracking-[0.15em] pt-1.5">
                View detailed FAQs below
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
