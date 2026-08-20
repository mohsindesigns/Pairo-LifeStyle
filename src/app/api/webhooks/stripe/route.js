import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import PendingCheckout from "@/models/PendingCheckout";
import stripe from "@/lib/stripe";
import { createOrderFromCheckoutPayload } from "@/lib/checkoutFulfillment";
import { getContextLogger, LogCategory } from "@/lib/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePaymentSucceeded(paymentIntent, log) {
  const tenantId = paymentIntent.metadata?.tenantId || "DEFAULT_STORE";
  const pending = await PendingCheckout.findOne({ tenantId, stripePaymentIntentId: paymentIntent.id });

  if (!pending) {
    log.warn({ paymentIntentId: paymentIntent.id }, "No PendingCheckout found for succeeded PaymentIntent");
    return;
  }

  if (pending.status === 'consumed') {
    log.info({ paymentIntentId: paymentIntent.id }, "PendingCheckout already consumed, skipping");
    return;
  }

  const { payload, context } = pending.payload || {};
  if (!payload || !context) {
    log.error({ paymentIntentId: paymentIntent.id }, "PendingCheckout has malformed payload");
    return;
  }

  const chargeId = typeof paymentIntent.latest_charge === 'string'
    ? paymentIntent.latest_charge
    : paymentIntent.latest_charge?.id || null;

  let receiptUrl = null;
  if (chargeId) {
    try {
      const charge = await stripe.charges.retrieve(chargeId);
      receiptUrl = charge.receipt_url || null;
    } catch (error) {
      log.warn({ chargeId, error: error.message }, "Failed to retrieve charge for receipt_url");
    }
  }

  const paymentInfo = {
    method: 'Card',
    status: 'Paid',
    provider: 'stripe',
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
      log.error({ paymentIntentId: paymentIntent.id, error: error.message }, "Order fulfillment failed after payment succeeded. Issuing refund.");
      await handleFulfillmentFailureRefund(pending, paymentIntent, error, log);
      return;
    }
  }

  if (order) {
    await PendingCheckout.updateOne(
      { _id: pending._id },
      { $set: { status: 'consumed', consumedOrderId: order._id } }
    );
    log.info({ orderNumber: order.orderNumber, paymentIntentId: paymentIntent.id }, "Order fulfilled from webhook");
  }
}

async function handleFulfillmentFailureRefund(pending, paymentIntent, error, log) {
  try {
    await stripe.refunds.create({
      payment_intent: paymentIntent.id,
      reason: 'requested_by_customer',
    });
    log.warn({ paymentIntentId: paymentIntent.id }, "Refund issued for unfulfillable payment.");
  } catch (refundError) {
    log.error({ paymentIntentId: paymentIntent.id, refundError: refundError.message }, "CRITICAL: failed to auto-refund an unfulfillable payment. Manual intervention required.");
  }

  await PendingCheckout.updateOne(
    { _id: pending._id },
    { $set: { status: 'expired', failureReason: error.message } }
  );
}

async function handlePaymentFailed(paymentIntent, log) {
  const tenantId = paymentIntent.metadata?.tenantId || "DEFAULT_STORE";
  log.warn({ paymentIntentId: paymentIntent.id, tenantId, error: paymentIntent.last_payment_error?.message }, "PaymentIntent failed");
}

export async function POST(req) {
  const log = getContextLogger(req.headers.get("x-correlation-id") || crypto.randomUUID(), { path: '/api/webhooks/stripe' });

  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    log.error({ category: LogCategory.CHECKOUT_TRANSACTION, error: error.message }, "Webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await dbConnect();

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object, log);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object, log);
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error({ category: LogCategory.CHECKOUT_TRANSACTION, error: error.message, eventType: event.type }, "Webhook handling failed");
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
