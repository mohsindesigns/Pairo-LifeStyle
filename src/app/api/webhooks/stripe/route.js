import dbConnect from "@/lib/db";
import stripe from "@/lib/stripe";
import { fulfillSucceededPaymentIntent, fulfillPaymentLinkSession } from "@/lib/stripeFulfillment";
import { getContextLogger, LogCategory } from "@/lib/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
        await fulfillSucceededPaymentIntent(event.data.object, log);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object, log);
        break;
      case 'checkout.session.completed':
        // Only relevant for admin-generated Stripe Payment Links (Custom Orders).
        // Regular cart checkout is fulfilled via payment_intent.succeeded instead.
        await fulfillPaymentLinkSession(event.data.object, log);
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
