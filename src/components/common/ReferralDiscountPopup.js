"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/context/CartContext";
import { X, Gift, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

const SESSION_KEY = "pairo_referral_popup_shown";

export default function ReferralDiscountPopup() {
  const { affiliateDiscount, affiliateDiscountAmount } = useCart();
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    // Only show if there's an active referral discount
    const hasDiscount =
      affiliateDiscount &&
      affiliateDiscount.type !== "None" &&
      affiliateDiscount.value > 0;

    if (!hasDiscount) return;

    // Only show once per browser session
    const alreadyShown = sessionStorage.getItem(SESSION_KEY);
    if (alreadyShown) return;

    // Small delay so the page loads first before popup appears
    const timer = setTimeout(() => {
      setVisible(true);
      setAnimating(true);
      sessionStorage.setItem(SESSION_KEY, "1");
    }, 900);

    return () => clearTimeout(timer);
  }, [affiliateDiscount]);

  const dismiss = () => {
    setAnimating(false);
    setTimeout(() => setVisible(false), 300);
  };

  if (!visible) return null;

  const discountLabel =
    affiliateDiscount?.type === "Percentage"
      ? `${affiliateDiscount.value}% OFF`
      : `$${affiliateDiscount.value} OFF`;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        className="fixed inset-0 z-[9998] bg-black/30 backdrop-blur-[2px]"
        style={{
          opacity: animating ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-black/5 w-full max-w-sm overflow-hidden"
          style={{
            opacity: animating ? 1 : 0,
            transform: animating ? "scale(1) translateY(0)" : "scale(0.95) translateY(16px)",
            transition: "opacity 0.35s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* Top accent strip */}
          <div className="h-1 w-full bg-black" />

          {/* Close button */}
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5 text-black/50" />
          </button>

          <div className="p-8 pt-7">
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center mb-6">
              <Gift className="w-7 h-7 text-white" />
            </div>

            {/* Discount badge */}
            <div className="inline-flex items-center gap-1.5 bg-black text-white px-3 py-1.5 rounded-full mb-4">
              <Sparkles className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                Referral Discount
              </span>
            </div>

            {/* Heading */}
            <h2 className="text-2xl font-bold heading-font uppercase tracking-tight text-black mb-2">
              {discountLabel} Unlocked!
            </h2>

            {/* Description */}
            <p className="text-sm text-black/50 leading-relaxed mb-7">
              A special referral discount has been automatically applied to your order.
              {affiliateDiscountAmount > 0
                ? ` You'll save $${affiliateDiscountAmount.toFixed(2)} at checkout.`
                : " Your savings will appear at checkout."}
            </p>

            {/* CTA Buttons */}
            <div className="space-y-3">
              <Link
                href="/shop"
                onClick={dismiss}
                className="w-full h-12 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-[0.2em] hover:bg-black/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                Start Shopping
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={dismiss}
                className="w-full h-10 bg-transparent text-black/40 rounded-xl text-xs font-medium hover:text-black transition-colors"
              >
                I&apos;ll browse first
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
