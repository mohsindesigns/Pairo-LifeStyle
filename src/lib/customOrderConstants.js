// Orders that count as "bespoke" for the admin Custom Orders screen and its
// payment-link / invoice actions. Two flows create orders in this category:
// - "Custom Order": Custom Jacket Inquiry converted to an order by an admin
// - "Custom Inquiry": the "Customize This Product" storefront modal
export const CUSTOM_ORDER_PAYMENT_METHODS = ["Custom Order", "Custom Inquiry"];

// True for a bespoke order, OR any order (e.g. a COD order an admin converted
// to Card) that already has a Stripe payment link on it. Used to gate the
// Payment & Invoice card and its endpoints so they keep working post-conversion
// without pulling converted orders into the Custom Orders list (that stays
// scoped strictly to CUSTOM_ORDER_PAYMENT_METHODS).
export function isPayableByLink(order) {
  return CUSTOM_ORDER_PAYMENT_METHODS.includes(order?.payment?.method) || !!order?.paymentLink?.stripePaymentLinkId;
}
