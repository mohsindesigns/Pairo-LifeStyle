import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { can } from "@/lib/rbac";
import { sendOrderInvoiceEmail } from "@/lib/email";
import { createStripePaymentLinkForOrder } from "@/lib/orderPaymentLink";

/**
 * Switches an order from Cash on Delivery to Card, generates a Stripe payment
 * link for its existing total, and emails the customer an invoice carrying a
 * "Pay Now" link — one action for the common case of a COD order the customer
 * (or store) decides should be prepaid online instead of collected on delivery.
 */
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();

  try {
    const order = await Order.findById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.payment?.method !== "Cash on Delivery") {
      return NextResponse.json({ error: "Only Cash on Delivery orders can be updated to Card" }, { status: 400 });
    }
    if (order.payment?.status === "Paid") {
      return NextResponse.json({ error: "This order has already been paid" }, { status: 400 });
    }
    if (!order.customer?.email) {
      return NextResponse.json({ error: "This order has no customer email on file" }, { status: 400 });
    }

    const newLink = await createStripePaymentLinkForOrder(order);
    order.paymentLink = { ...newLink, sentCount: 0 };
    order.payment.method = "Card";

    order.timeline.push({
      status: order.status,
      message: "Payment method updated from Cash on Delivery to Card. Stripe payment link generated.",
      source: "Admin",
    });

    await sendOrderInvoiceEmail(order);

    order.invoice = order.invoice || {};
    order.invoice.sentAt = new Date();
    order.invoice.sentCount = (order.invoice.sentCount || 0) + 1;
    order.paymentLink.sentAt = new Date();
    order.paymentLink.sentCount = 1;
    order.timeline.push({
      status: order.status,
      message: `Invoice with payment link emailed to ${order.customer.email}.`,
      source: "Admin",
    });

    await order.save();

    return NextResponse.json({ success: true, order });
  } catch (err) {
    console.error("[Order Convert To Card Error]", err);
    return NextResponse.json({ error: err.message || "Failed to update payment method" }, { status: 500 });
  }
}
