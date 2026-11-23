// Pure helpers for the admin refund route (no DB / Stripe access, unit-tested in
// src/__tests__/admin-order-refund-helpers.test.js).

export const toCents = (amount) => Math.round((Number(amount) || 0) * 100);

// "$12.50", "€12.50", "PKR 1,200.00"… in the order's own currency.
export function formatRefundAmount(amount, currency = "USD") {
  const code = typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch {
    return `${code} ${(Number(amount) || 0).toFixed(2)}`;
  }
}

// Same order + same refunded-so-far + same amount => same Stripe key, so a
// double-submitted or retried refund request can never create a second refund.
export function buildRefundIdempotencyKey(orderId, refundedSoFar, amount) {
  return `admin-refund:${String(orderId)}:${toCents(refundedSoFar)}:${toCents(amount)}`;
}

// Compare-and-set filter on payment.refundedAmount: only matches while the stored
// value is still the one this request read (older orders may not have the field).
export function refundedAmountMatch(refundedSoFar) {
  const value = Number(refundedSoFar) || 0;
  return value === 0 ? { $in: [0, null] } : value;
}
