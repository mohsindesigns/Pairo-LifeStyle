// Builds the document for an admin "Duplicate" of an order
// (POST /api/admin/orders/[id]/duplicate). Kept free of DB/Next imports so it
// can be unit-tested (src/__tests__/admin-order-duplicate.test.js).
//
// The copy is a Pending draft: same line items at the ORIGINAL prices, same
// customer/shipping snapshot and totals — but no payment, Stripe, refund,
// invoice/payment-link, affiliate or promotion-usage data, so nothing downstream
// (commissions, coupon usage counts, refunds) treats it as a real sale.

const plain = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

export function buildDuplicateOrderDoc(source, { orderNumber, staffName = "Admin" } = {}) {
  if (!source) throw new Error("Source order is required");
  if (!orderNumber) throw new Error("orderNumber is required");

  const note = `Duplicated from #${source.orderNumber}`;

  // Line items keep their stored priceAtPurchase (no re-pricing); drop subdocument ids.
  const items = (source.items || []).map((item) => {
    const { _id, ...rest } = plain(item) || {};
    return rest;
  });

  const f = plain(source.financials) || {};
  const subtotal = Number.isFinite(Number(f.subtotal))
    ? Number(f.subtotal)
    : items.reduce((sum, i) => sum + (Number(i.priceAtPurchase) || 0) * (Number(i.quantity) || 0), 0);
  const financials = {
    subtotal,
    shippingCost: Number(f.shippingCost) || 0,
    tax: Number(f.tax) || 0,
    discountTotal: Number(f.discountTotal) || 0,
    affiliateDiscountType: f.affiliateDiscountType || "None",
    affiliateDiscountValue: Number(f.affiliateDiscountValue) || 0,
    affiliateDiscountAmount: Number(f.affiliateDiscountAmount) || 0,
    total: Number.isFinite(Number(f.total)) ? Number(f.total) : subtotal,
    currency: f.currency || "USD",
    // promoCode / appliedPromotions are intentionally not copied: they drive coupon
    // usage counts and usage reconciliation, which must not count this copy.
  };

  const c = plain(source.customer) || {};
  const customer = {
    userId: c.userId || null,
    email: c.email || "",
    isGuest: c.isGuest ?? !c.userId,
  };

  const shippingAddress = plain(source.shippingAddress) || {};
  const { _id: _addrId, ...shipping } = shippingAddress;

  const doc = {
    orderNumber,
    status: "Pending",
    stockDeducted: false, // see Order.stockDeducted: cancelling this copy must not restock
    items,
    financials,
    payment: {
      method: source.payment?.method || "Cash on Delivery",
      status: "Pending",
      refundedAmount: 0,
    },
    customer,
    shippingAddress: shipping,
    customerNote: source.customerNote || "",
    adminNotes: [note],
    timeline: [{
      status: "Pending",
      message: `${note} by admin (${staffName}). Draft copy — stock was not deducted and no emails were sent.`,
      source: "Admin",
    }],
  };

  if (source.shippingSnapshot) {
    const { _id, capturedAt, ...snap } = plain(source.shippingSnapshot);
    doc.shippingSnapshot = snap;
  }
  if (source.customJacketSnapshot) doc.customJacketSnapshot = plain(source.customJacketSnapshot);

  return doc;
}
