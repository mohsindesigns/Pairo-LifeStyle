"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function AffiliateTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // 1. Check URL parameters: ref, affiliate, coupon
    const ref = searchParams.get("ref");
    const affiliate = searchParams.get("affiliate");
    const coupon = searchParams.get("coupon");

    const code = ref || affiliate || coupon;
    if (!code) return;

    // 2. Prevent tracking self-referrals if logged in as affiliate
    // We can fetch session or local checks later, but simple API check will validate on server
    
    const trackClick = async () => {
      try {
        const res = await fetch("/api/affiliate/clicks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            landingPage: window.location.href,
            referrer: document.referrer,
            utm: {
              source: searchParams.get("utm_source") || "",
              medium: searchParams.get("utm_medium") || "",
              campaign: searchParams.get("utm_campaign") || "",
              content: searchParams.get("utm_content") || "",
              term: searchParams.get("utm_term") || ""
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            // Calculate sliding cookie expiration
            const durationDays = data.cookieDurationDays || 30;
            const expires = new Date();
            expires.setDate(expires.getDate() + durationDays);

            const payload = {
              affiliateId: data.affiliateId,
              code: data.referralCode,
              timestamp: Date.now(),
              landingUrl: window.location.href,
              referrer: document.referrer,
              expiresAt: expires.getTime(),
              customerDiscountType: data.customerDiscountType || 'None',
              customerDiscountValue: data.customerDiscountValue || 0
            };

            // Set secure cookie
            document.cookie = `pairo_ref=${encodeURIComponent(JSON.stringify(payload))}; path=/; expires=${expires.toUTCString()}; SameSite=Lax; Secure`;

            // Set LocalStorage fallback
            localStorage.setItem("pairo_ref", JSON.stringify(payload));

            console.log(`[AffiliateTracker] Active attribution registered: ${data.referralCode}. Cookies set for ${durationDays} days.`);
          }
        }
      } catch (err) {
        console.error("[AffiliateTracker] Failed to register click:", err);
      }
    };

    trackClick();
  }, [searchParams]);

  return null;
}
