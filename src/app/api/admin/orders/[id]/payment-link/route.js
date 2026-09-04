import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { can } from "@/lib/rbac";
import { sendPaymentLinkEmail } from "@/lib/email";
import { CUSTOM_ORDER_PAYMENT_METHODS } from "@/lib/customOrderConstants";
import { createStripePaymentLinkForOrder, deactivateStripePaymentLink } from "@/lib/orderPaymentLink";

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();

  try {
    const body = await req.json().catch(() => ({}));
    const { send = false, regenerate = false } = body;

    const order = await Order.findById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!CUSTOM_ORDER_PAYMENT_METHODS.includes(order.payment?.method)) {
      return NextResponse.json({ error: "Payment links are only available for Custom Orders" }, { status: 400 });
    }
    if (order.payment?.status === "Paid") {
      return NextResponse.json({ error: "This order has already been paid" }, { status: 400 });
    }

    const needsNewLink = !order.paymentLink?.stripePaymentLinkId || regenerate;

    if (needsNewLink) {
      if (order.paymentLink?.stripePaymentLinkId && regenerate) {
        await deactivateStripePaymentLink(order.paymentLink.stripePaymentLinkId);
      }

      const newLink = await createStripePaymentLinkForOrder(order);
      order.paymentLink = {
        ...newLink,
        sentAt: order.paymentLink?.sentAt || undefined,
        sentCount: order.paymentLink?.sentCount || 0,
      };

      order.timeline.push({
        status: order.status,
        message: "Stripe payment link generated for this order.",
        source: "Admin",
      });
    }

    if (send) {
      await sendPaymentLinkEmail(order, order.paymentLink.url);
      order.paymentLink.sentAt = new Date();
      order.paymentLink.sentCount = (order.paymentLink.sentCount || 0) + 1;
      order.timeline.push({
        status: order.status,
        message: `Payment link emailed to ${order.customer?.email}.`,
        source: "Admin",
      });
    }

    await order.save();

    return NextResponse.json({ success: true, order });
  } catch (err) {
    console.error("[Order PaymentLink Error]", err);
    return NextResponse.json({ error: err.message || "Failed to generate payment link" }, { status: 500 });
  }
}
