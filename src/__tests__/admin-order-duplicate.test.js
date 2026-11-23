import { describe, it, expect } from "vitest";
import { buildDuplicateOrderDoc } from "@/app/api/admin/orders/duplicateOrder";

const source = {
  _id: "o1",
  orderNumber: "PAI-1001",
  status: "Delivered",
  items: [
    { _id: "i1", productId: "p1", name: "Jacket", priceAtPurchase: 199.99, quantity: 2 },
    { _id: "i2", productId: "p2", name: "Belt", priceAtPurchase: 20, quantity: 1 },
  ],
  financials: {
    subtotal: 419.98, shippingCost: 10, tax: 5, discountTotal: 15, total: 419.98,
    currency: "EUR", promoCode: "SAVE15", appliedPromotions: [{ promotionId: "x", code: "SAVE15" }],
  },
  payment: { method: "Card", status: "Refunded", provider: "stripe", stripePaymentIntentId: "pi_1", refundedAmount: 419.98, paidAt: new Date() },
  customer: { userId: "c1", email: "a@b.co", isGuest: false, ipAddress: "1.2.3.4" },
  shippingAddress: { fullName: "A B", street: "1 St", city: "X", country: "PK" },
  affiliateId: "aff1",
  affiliateReferralCode: "REF",
  idempotencyKey: "pai_123",
  paymentLink: { url: "https://x" },
  invoice: { sentCount: 2 },
  customerNote: "Gift wrap",
  adminNotes: ["old note"],
  timeline: [{ status: "Delivered", message: "done" }],
  isDeleted: true,
};

describe("buildDuplicateOrderDoc", () => {
  const doc = buildDuplicateOrderDoc(source, { orderNumber: "PAI-2000", staffName: "Jo" });

  it("keeps the original line-item prices and totals", () => {
    expect(doc.items.map((i) => i.priceAtPurchase)).toEqual([199.99, 20]);
    expect(doc.items[0]._id).toBeUndefined();
    expect(doc.financials).toMatchObject({ subtotal: 419.98, shippingCost: 10, tax: 5, discountTotal: 15, total: 419.98, currency: "EUR" });
  });

  it("is a Pending draft noted with the source order number", () => {
    expect(doc.orderNumber).toBe("PAI-2000");
    expect(doc.status).toBe("Pending");
    expect(doc.adminNotes).toEqual(["Duplicated from #PAI-1001"]);
    expect(doc.timeline).toHaveLength(1);
    expect(doc.timeline[0].message).toContain("Duplicated from #PAI-1001");
  });

  it("drops payment, affiliate, promotion and trash data", () => {
    expect(doc.payment).toEqual({ method: "Card", status: "Pending", refundedAmount: 0 });
    expect(doc.affiliateId).toBeUndefined();
    expect(doc.affiliateReferralCode).toBeUndefined();
    expect(doc.idempotencyKey).toBeUndefined();
    expect(doc.paymentLink).toBeUndefined();
    expect(doc.invoice).toBeUndefined();
    expect(doc.isDeleted).toBeUndefined();
    expect(doc.financials.promoCode).toBeUndefined();
    expect(doc.financials.appliedPromotions).toBeUndefined();
  });

  it("keeps the customer and shipping snapshot", () => {
    expect(doc.customer).toEqual({ userId: "c1", email: "a@b.co", isGuest: false });
    expect(doc.shippingAddress).toEqual(source.shippingAddress);
    expect(doc.customerNote).toBe("Gift wrap");
  });

  it("requires an order number", () => {
    expect(() => buildDuplicateOrderDoc(source, {})).toThrow();
  });
});
