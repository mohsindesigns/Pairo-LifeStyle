"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";

// One shared in-flight/resolved request per page load so cart drawer, cart page, product page and badges
// do not each hit the endpoint.
let inflight = null;
let resolved = null;

function loadEstimate() {
  if (resolved) return Promise.resolve(resolved);
  if (!inflight) {
    inflight = fetch("/api/shipping/estimate")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const s = d && d.success && d.summary ? d.summary : null;
        if (s) resolved = s;
        else inflight = null;
        return s;
      })
      .catch(() => {
        inflight = null;
        return null;
      });
  }
  return inflight;
}

/** Returns the estimate summary ({freeShippingOver, cheapestRate, allFree}) or null while loading / on failure. */
export function useShippingEstimate() {
  const [summary, setSummary] = useState(resolved);
  useEffect(() => {
    let alive = true;
    loadEstimate().then((s) => {
      if (alive && s) setSummary(s);
    });
    return () => {
      alive = false;
    };
  }, []);
  return summary;
}

/** Short value for a "Shipping" row. */
export function shippingRowText(summary, subtotal = 0) {
  if (!summary) return "Calculated at checkout";
  if (summary.allFree) return "Free";
  // The cart already reaches the free-shipping threshold, so say Free instead of repeating the threshold.
  if (summary.freeShippingOver > 0 && Number(subtotal) >= summary.freeShippingOver) return "Free";
  if (summary.freeShippingOver > 0) return `Free over $${formatMoney(summary.freeShippingOver)}`;
  if (summary.cheapestRate > 0) return `From $${formatMoney(summary.cheapestRate)}`;
  return "Calculated at checkout";
}

/** Sentence for the product page note. */
export function shippingNoteText(summary) {
  if (!summary) return null;
  if (summary.allFree) return "Free shipping";
  if (summary.freeShippingOver > 0) return `Free shipping over $${formatMoney(summary.freeShippingOver)}`;
  if (summary.cheapestRate > 0) return `Shipping from $${formatMoney(summary.cheapestRate)}, calculated at checkout`;
  return null;
}

/** Remaining amount to free shipping, or null when not applicable. */
export function amountToFreeShipping(summary, subtotal) {
  if (!summary || summary.allFree || !(summary.freeShippingOver > 0)) return null;
  const left = summary.freeShippingOver - (Number(subtotal) || 0);
  return left > 0 ? left : null;
}
