import stripe from "@/lib/stripe";

/**
 * Creates a fresh Stripe Product + Price + Payment Link for an order's current
 * total. Returns the sub-document shape stored at order.paymentLink — callers
 * are responsible for assigning it and saving the order.
 */
export async function createStripePaymentLinkForOrder(order) {
  const amount = order.financials?.total || 0;
  if (amount <= 0) {
    throw new Error("Order total must be greater than zero");
  }

  const product = await stripe.products.create({
    name: `${order.items?.[0]?.name || "Custom Order"} — #${order.orderNumber}`,
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(amount * 100),
    currency: (order.financials?.currency || "USD").toLowerCase(),
  });
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: {
      orderId: order._id.toString(),
      tenantId: order.tenantId,
      orderNumber: order.orderNumber,
    },
  });

  return {
    url: paymentLink.url,
    stripePaymentLinkId: paymentLink.id,
    stripePriceId: price.id,
    stripeProductId: product.id,
    active: true,
    createdAt: new Date(),
  };
}

/** Best-effort deactivation of a Stripe Payment Link — logs, never throws. */
export async function deactivateStripePaymentLink(stripePaymentLinkId) {
  if (!stripePaymentLinkId) return;
  try {
    await stripe.paymentLinks.update(stripePaymentLinkId, { active: false });
  } catch (e) {
    console.error("[PaymentLink] Failed to deactivate link:", e.message);
  }
}
