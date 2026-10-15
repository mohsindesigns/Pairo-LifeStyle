"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { sanitizeRichHtml } from "@/lib/sanitize";
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
  MessageSquare,
  Clock
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

  return `${startStr} â€“ ${endStr}${yearSuffix}`;
}

export default function ProductMainSection({ product, topReview = null }) {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedVariantImage, setSelectedVariantImage] = useState("");
  const [deliveryRange, setDeliveryRange] = useState("");

  useEffect(() => {
    setDeliveryRange(getDeliveryRange());
  }, []);

  const handleVariantChange = (variant) => {
    if (variant.isPartial) {
      // Always set â€” empty string resets gallery to product default
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

  const unitPrice = hasAffiliateDiscount && affiliateDiscountedPrice !== null
    ? Number(affiliateDiscountedPrice.toFixed(2))
    : Number(displayPrice);

  const hasSale = !hasAffiliateDiscount && displayCompareAtPrice > displayPrice;
  const salePercent = hasSale
    ? Math.round(((displayCompareAtPrice - displayPrice) / displayCompareAtPrice) * 100)
    : 0;

  const rating = Number(product.rating) || 0;
  const reviewCount = Number(product.reviewCount) || 0;

  // Urgency only when real stock is low (never fabricated)
  const lowStockLimit = Math.max(Number(product.lowStockThreshold) || 0, 10);
  const showLowStock =
    product.manageStock !== false && displayStock > 0 && displayStock <= lowStockLimit;

  const badgeLabel = product.isFeatured ? "Best Seller" : hasSale ? "On Sale" : null;

  return (
    <div className="">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 items-start">
        {/* LEFT SIDE: STICKY GALLERY */}
        <div className="lg:sticky lg:top-28 self-start w-full min-w-0">
          <ProductGallery
            images={product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : [])}
            variantImage={selectedVariantImage}
            productName={product.name}
            imageAlts={product.imageAlts}
          />
        </div>
        {/* RIGHT SIDE: PRODUCT INFO */}
        <div className="space-y-4 min-w-0 lg:pt-1.5">
          {badgeLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 text-white text-[12px] md:text-[13px] font-bold uppercase tracking-wide px-4 py-1.5">
              {badgeLabel}
            </span>
          )}

          <h1 className="text-[26px] md:text-[38px] font-extrabold heading-font tracking-tight leading-[1.1] text-primary">
            {product.name}
          </h1>

          <div>
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
              className="flex flex-col items-start gap-1 text-left cursor-pointer group"
              title="Click to view ratings & reviews"
            >
              <span className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`w-5 h-5 ${n <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-transparent text-black/20"}`}
                  />
                ))}
              </span>
              <span className="text-[14px] md:text-[15px] text-primary/70 group-hover:text-primary group-hover:underline underline-offset-2">
                {rating.toFixed(1)} ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
              </span>
            </button>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            <span className="text-[34px] md:text-[42px] font-extrabold tracking-tight leading-none text-primary">
              ${unitPrice.toFixed(2)}
            </span>
            {hasAffiliateDiscount && affiliateDiscountedPrice !== null ? (
              <>
                <span className="text-lg md:text-xl font-medium text-primary/40 line-through">${Number(displayPrice).toFixed(2)}</span>
                <span className="text-[12px] md:text-[13px] font-bold uppercase tracking-wide text-white bg-red-600 px-3 py-1 rounded-md select-none">
                  {affiliateSavingsLabel}
                </span>
              </>
            ) : (
              hasSale && (
                <>
                  <span className="text-lg md:text-xl font-medium text-primary/40 line-through">${Number(displayCompareAtPrice).toFixed(2)}</span>
                  <span className="text-[13px] md:text-[14px] font-bold uppercase text-white bg-red-600 px-3 py-1 rounded-md select-none">
                    {salePercent}% off
                  </span>
                </>
              )
            )}
          </div>

          {showLowStock && (
            <p className="flex items-center gap-2 text-[14px] md:text-[15px] font-semibold text-red-600">
              <Clock className="w-4 h-4 shrink-0" />
              Limited stock left: only {displayStock} left
            </p>
          )}

          {deliveryRange && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-black/10 bg-white/80 text-[11px] font-semibold text-black tracking-wide shadow-sm">
              <Truck className="w-3 h-3 text-black/50 shrink-0" />
              Delivered between&nbsp;<span className="font-bold">{deliveryRange}</span>
            </span>
          )}

          {/* Variant Selector + Stock + ATC */}
          <ClientProductActions
            product={{ ...product, stock: displayStock }}
            onVariantChange={handleVariantChange}
            unitPrice={unitPrice}
          />

          {/* Trust strip - CMS Driven */}
          {product.stats && product.stats.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
              {product.stats.map((stat, i) => {
                const Icon = ICON_MAP[stat.icon] || Info;
                return (
                  <div key={i} className="flex items-center gap-1.5 text-[13px] text-primary">
                    <Icon className="w-4 h-4 text-primary/70 shrink-0" />
                    <span className="font-semibold">{stat.label}</span>
                    {stat.value && <span className="text-primary/70">{stat.value}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {product.shortDescription && (
            <div className="rounded-xl bg-black/[0.04] p-4 md:p-5 space-y-2">
              <h2 className="text-[17px] md:text-[19px] font-bold text-primary">Why You&apos;ll Love It</h2>
              <div
                className="short-description-prose text-primary/80 text-[14px] md:text-[15px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.shortDescription) }}
              />
            </div>
          )}

          {topReview && (
            <div className="rounded-xl bg-black/[0.06] p-4 md:p-5 space-y-1.5">
              <h2 className="text-[17px] md:text-[19px] font-bold text-primary">What Customers Are Saying</h2>
              <p className="text-[14px] md:text-[15px] text-primary/80 leading-snug">
                <span className="inline-flex align-middle gap-0.5 mr-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`w-3.5 h-3.5 ${n <= topReview.rating ? "fill-amber-400 text-amber-400" : "fill-transparent text-black/20"}`}
                    />
                  ))}
                </span>
                &ldquo;{topReview.comment}&rdquo;
              </p>
              <p className="text-[13px] text-primary/60">
                {topReview.customerName}
                {topReview.verifiedPurchase ? ", Verified Buyer" : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

