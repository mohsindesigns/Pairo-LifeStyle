import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import PendingCheckout from "@/models/PendingCheckout";
import stripe from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function GET(req) {
  const tenantId = req.headers.get("x-tenant-id") || "DEFAULT_STORE";
  const { searchParams } = new URL(req.url);
  const idempotencyKey = searchParams.get("idempotencyKey");

  if (!idempotencyKey) {
    return NextResponse.json({ error: "idempotencyKey is required" }, { status: 400 });
  }

  try {
    await dbConnect();

    const [order, pending] = await Promise.all([
      Order.findOne({ tenantId, idempotencyKey }),
      PendingCheckout.findOne({ tenantId, idempotencyKey }),
    ]);

    if (order) {
      return NextResponse.json({
        success: true,
        status: 'succeeded',
        orderId: order._id,
        orderNumber: order.orderNumber,
      });
    }

    if (!pending) {
      return NextResponse.json({ success: true, status: 'not_found' });
    }

    if (pending.status === 'consumed') {
      return NextResponse.json({ success: true, status: 'processing' });
    }

    if (pending.status === 'expired') {
      return NextResponse.json({
        success: true,
        status: 'failed',
        error: pending.failureReason || "We were unable to complete your order and have refunded your payment.",
      });
    }

    if (pending.stripePaymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(pending.stripePaymentIntentId);
        if (paymentIntent.status === 'succeeded') {
          return NextResponse.json({ success: true, status: 'processing' });
        }
        if (paymentIntent.status === 'canceled' || paymentIntent.last_payment_error) {
          return NextResponse.json({
            success: true,
            status: 'failed',
            error: paymentIntent.last_payment_error?.message || "Payment failed.",
          });
        }
      } catch {
        return NextResponse.json({ success: true, status: 'processing' });
      }
    }

    return NextResponse.json({ success: true, status: 'processing' });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
