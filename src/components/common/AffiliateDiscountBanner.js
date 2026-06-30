"use client";

import { useCart } from "@/context/CartContext";
import { useState } from "react";
import { Tag, X, Sparkles } from "lucide-react";

export default function AffiliateDiscountBanner() {
  const { affiliateDiscount, affiliateDiscountAmount, cartSubtotal } = useCart();
  const [dismissed, setDismissed] = useState(false);

  // Only show when an active affiliate discount is configured
  if (dismissed) return null;
  if (!affiliateDiscount || affiliateDiscount.type === "None" || !affiliateDiscount.value) return null;

  const discountLabel =
    affiliateDiscount.type === "Percentage"
      ? `${affiliateDiscount.value}% off`
      : `$${affiliateDiscount.value} off`;

  return (
    <div
      className="w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white"
      role="alert"
      aria-live="polite"
    >
      <div className="container mx-auto px-4 sm:px-6 md:px-16 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-[12px] sm:text-[13px] font-semibold leading-tight truncate">
            <span className="font-bold">Special Referral Discount Applied!</span>
            <span className="ml-2 opacity-90">
              You&apos;re saving{" "}
              <span className="underline underline-offset-2 font-bold">{discountLabel}</span>
              {cartSubtotal > 0 && affiliateDiscountAmount > 0 && (
                <span className="ml-1 opacity-80">(${affiliateDiscountAmount.toFixed(2)} saved)</span>
              )}
              {" "}on your order.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
            <Tag className="w-3 h-3" />
            <span className="text-[11px] font-bold uppercase tracking-wider">{discountLabel}</span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss affiliate discount banner"
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
