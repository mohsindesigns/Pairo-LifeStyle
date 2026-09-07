import Order from "@/models/Order";
import PendingCheckout from "@/models/PendingCheckout";
import Promotion from "@/models/Promotion";
import PromotionCustomerUsage from "@/models/PromotionCustomerUsage";
import stripe from "@/lib/stripe";
import { createOrderFromCheckoutPayload } from "@/lib/checkoutFulfillment";

/**
 * Fulfills a succeeded Stripe PaymentIntent into an Order, if it hasn't been already.
 *
 * Shared by the Stripe webhook (payment_intent.succeeded) and the client-side
 * /api/checkout/status poller — the latter self-heals order creation when the
 * webhook is delayed, missed, or (in local dev) never reaches this server at all
 * because no `stripe listen` forwarder is running.
 *
 * Idempotency is enforced by Order's unique { tenantId, idempotencyKey } index:
 * concurrent callers racing here will have exactly one succeed and the rest will
 * re-fetch the resulting order on a duplicate-key error.
 */
export async function fulfillSucceededPaymentIntent(paymentIntent, log) {
  const tenantId = paymentIntent.metadata?.tenantId || "DEFAULT_STORE";
  const pending = await PendingCheckout.findOne({ tenantId, stripePaymentIntentId: paymentIntent.id });

  if (!pending) {
    log?.warn?.({ paymentIntentId: paymentIntent.id }, "No PendingCheckout found for succeeded PaymentIntent");
    return null;
  }

  if (pending.status === "consumed") {
    if (pending.consumedOrderId) return Order.findById(pending.consumedOrderId);
    return null;
  }

  if (pending.status === "expired") {
    return null;
  }

  const { payload, context } = pending.payload || {};
  if (!payload || !context) {
    log?.error?.({ paymentIntentId: paymentIntent.id }, "PendingCheckout has malformed payload");
    return null;
  }

  const chargeId = typeof paymentIntent.latest_charge === "string"
    ? paymentIntent.latest_charge
    : paymentIntent.latest_charge?.id || null;

  let receiptUrl = null;
  if (chargeId) {
    try {
      const charge = await stripe.charges.retrieve(chargeId);
      receiptUrl = charge.receipt_url || null;
    } catch (error) {
      log?.warn?.({ chargeId, error: error.message }, "Failed to retrieve charge for receipt_url");
    }
  }

  const paymentInfo = {
    method: "Card",
    status: "Paid",
    provider: "stripe",
    stripePaymentIntentId: paymentIntent.id,
    stripeChargeId: chargeId,
    receiptUrl,
    paidAt: new Date(),
  };

  let order;
  try {
    order = await createOrderFromCheckoutPayload(payload, {
      tenantId: context.tenantId,
      orderUserId: context.orderUserId,
      checkoutEmail: context.checkoutEmail,
      isGuestSession: context.isGuestSession,
      ipAddress: context.ipAddress,
      paymentInfo,
    });
  } catch (error) {
    if (error?.code === 11000) {
      order = await Order.findOne({ tenantId: context.tenantId, idempotencyKey: payload.idempotencyKey });
    } else {
      log?.error?.({ paymentIntentId: paymentIntent.id, error: error.message }, "Order fulfillment failed after payment succeeded. Issuing refund.");
      await refundUnfulfillablePayment(pending, paymentIntent, error, log);
      return null;
    }
  }

  if (order) {
    await PendingCheckout.updateOne(
      { _id: pending._id, status: { $ne: "consumed" } },
      { $set: { status: "consumed", consumedOrderId: order._id } }
    );
    log?.info?.({ orderNumber: order.orderNumber, paymentIntentId: paymentIntent.id }, "Order fulfilled");
  }

  return order;
}

/**
 * Best-effort reconciliation of a Stripe Payment Link redemption against this
 * app's own Promotion records. Stripe's own max_redemptions already enforces
 * the global usage cap on Stripe's side (see StripeSync.js) — but
 * maxUsesPerCustomer has no Stripe-side equivalent, and none of this reaches
 * our own Promotion/PromotionCustomerUsage analytics without this step,
 * meaning the admin's usage analytics would otherwise undercount and a
 * customer who redeemed here wouldn't be caught by the per-customer check on
 * a later normal storefront checkout.
 *
 * The Checkout Session in the webhook payload doesn't carry which promotion
 * code was redeemed by default, so the session is re-retrieved here with
 * `discounts.promotion_code` expanded to find it.
 *
 * This can never retroactively block the payment that already completed — it
 * only catches the customer up for their next order. Never throws: a
 * promo-tracking hiccup must not break fulfillment for a payment that already
 * succeeded. Mirrors the $inc/upsert patterns in checkoutPricing.js.
 */
async function reconcilePromotionUsageForPaymentLink(order, session, discountAmount, log) {
  try {
    const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["discounts.promotion_code"],
    });

    const discountEntry = expandedSession.discounts?.find((d) => d.promotion_code);
    const stripePromotionCodeId = typeof discountEntry?.promotion_code === "string"
      ? discountEntry.promotion_code
      : discountEntry?.promotion_code?.id;
    if (!stripePromotionCodeId) return;

    const promotion = await Promotion.findOne({ tenantId: order.tenantId, stripePromotionCodeId });
    if (!promotion) {
      log?.warn?.({ stripePromotionCodeId, orderId: order._id }, "Payment Link promo code has no matching local Promotion");
      return;
    }

    order.financials.appliedPromotions = order.financials.appliedPromotions || [];
    order.financials.appliedPromotions.push({
      promotionId: promotion._id,
      code: promotion.code,
      title: promotion.title,
      type: promotion.actions?.[0]?.type || "discount",
      value: promotion.actions?.[0]?.value,
      discountAmount,
      explanation: `Promotion code ${promotion.code} applied via Stripe payment link`,
      rulesSnapshot: {
        conditions: promotion.conditions,
        actions: promotion.actions,
      },
    });
    if (!order.financials.promoCode) order.financials.promoCode = promotion.code;

    await Promotion.updateOne(
      { _id: promotion._id },
      {
        $inc: {
          "usageLimits.currentTotalUses": 1,
          "analytics.timesUsed": 1,
          "analytics.discountDistributed": discountAmount,
          "analytics.revenueGenerated": order.financials?.subtotal || 0,
        },
      }
    );

    const maxPerCustomer = promotion.usageLimits?.maxUsesPerCustomer;
    if (maxPerCustomer) {
      const customerKey = order.customer?.userId
        ? `user:${order.customer.userId}`
        : `email:${(order.customer?.email || "").toLowerCase().trim()}`;

      // No $lt guard here (unlike checkoutPricing.js's blocking version) — the
      // payment already went through and can't be undone, so this only needs
      // to record the usage for next time, not gate this one.
      await PromotionCustomerUsage.findOneAndUpdate(
        { tenantId: order.tenantId, promotionId: promotion._id, customerKey },
        { $inc: { usageCount: 1 } },
        { upsert: true }
      );
    }
  } catch (error) {
    log?.warn?.({ orderId: order._id, sessionId: session.id, error: error.message }, "Failed to reconcile Payment Link promotion usage");
  }
}

/**
 * Marks a Custom Order Paid from a completed Stripe Checkout Session created by
 * an admin-generated Payment Link (as opposed to the cart-checkout PaymentIntent
 * flow above). Called from the webhook's checkout.session.completed handler and
 * from reconcilePaymentLinkOrder's self-heal path below.
 */
export async function fulfillPaymentLinkSession(session, log) {
  const orderId = session.metadata?.orderId;
  if (!session.payment_link || !orderId) return null;

  const order = await Order.findById(orderId);
  if (!order) {
    log?.warn?.({ orderId, sessionId: session.id }, "No Order found for completed Payment Link checkout session");
    return null;
  }
  if (order.payment?.status === "Paid") return order;

  let chargeId = null;
  let receiptUrl = null;
  if (session.payment_intent) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
      chargeId = typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id || null;
      if (chargeId) {
        const charge = await stripe.charges.retrieve(chargeId);
        receiptUrl = charge.receipt_url || null;
      }
    } catch (error) {
      log?.warn?.({ sessionId: session.id, error: error.message }, "Failed to retrieve charge for Payment Link session");
    }
  }

  order.payment.status = "Paid";
  order.payment.provider = "stripe";
  order.payment.stripePaymentIntentId = session.payment_intent || order.payment.stripePaymentIntentId;
  order.payment.stripeChargeId = chargeId || order.payment.stripeChargeId;
  order.payment.receiptUrl = receiptUrl || order.payment.receiptUrl;
  order.payment.paidAt = new Date();
  if (order.status === "Pending") order.status = "Confirmed";

  // The customer may have typed one of our synced Promotion codes into
  // Stripe's own hosted page — reflect what was actually collected rather
  // than letting the order silently disagree with the real charge.
  const amountDiscountCents = session.total_details?.amount_discount || 0;
  let paymentMessage = "Payment received via Stripe payment link.";
  if (amountDiscountCents > 0) {
    const discountAmount = amountDiscountCents / 100;
    const currency = order.financials?.currency || "USD";
    order.financials.discountTotal = (order.financials.discountTotal || 0) + discountAmount;
    order.financials.total = Math.max(0, (order.financials.total || 0) - discountAmount);
    paymentMessage = `Payment received via Stripe payment link (promotion code applied: -${currency} ${discountAmount.toLocaleString()}).`;

    await reconcilePromotionUsageForPaymentLink(order, session, discountAmount, log);
  }

  order.timeline.push({
    status: order.status,
    message: paymentMessage,
    source: "System",
  });

  await order.save();
  log?.info?.({ orderId, orderNumber: order.orderNumber, sessionId: session.id }, "Custom order marked Paid from Payment Link checkout");
  return order;
}

/**
 * Self-heal for Custom Order payment links: checks Stripe directly for a
 * completed Checkout Session against this order's payment link, in case the
 * checkout.session.completed webhook never arrived (e.g. no `stripe listen`
 * forwarder running locally, or a missed delivery). Cheap to call repeatedly —
 * a no-op once the order has no payment link or is already Paid.
 */
export async function reconcilePaymentLinkOrder(order, log) {
  if (!order || order.payment?.status === "Paid" || !order.paymentLink?.stripePaymentLinkId) {
    return order;
  }

  try {
    const sessions = await stripe.checkout.sessions.list({
      payment_link: order.paymentLink.stripePaymentLinkId,
      limit: 5,
    });
    const paidSession = sessions.data.find((s) => s.payment_status === "paid");
    if (!paidSession) return order;

    const fulfilled = await fulfillPaymentLinkSession(paidSession, log);
    return fulfilled || order;
  } catch (error) {
    log?.warn?.({ orderId: order._id, error: error.message }, "Failed to reconcile payment link order against Stripe");
    return order;
  }
}

async function refundUnfulfillablePayment(pending, paymentIntent, error, log) {
  try {
    await stripe.refunds.create({
      payment_intent: paymentIntent.id,
      reason: "requested_by_customer",
    });
    log?.warn?.({ paymentIntentId: paymentIntent.id }, "Refund issued for unfulfillable payment.");
  } catch (refundError) {
    log?.error?.({ paymentIntentId: paymentIntent.id, refundError: refundError.message }, "CRITICAL: failed to auto-refund an unfulfillable payment. Manual intervention required.");
  }

  await PendingCheckout.updateOne(
    { _id: pending._id },
    { $set: { status: "expired", failureReason: error.message } }
  );
}
