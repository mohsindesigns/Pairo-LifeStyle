import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { can } from "@/lib/rbac";
import { sendOrderInvoiceEmail } from "@/lib/email";
import { CUSTOM_ORDER_PAYMENT_METHODS } from "@/lib/customOrderConstants";
import { createStripePaymentLinkForOrder } from "@/lib/orderPaymentLink";

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();

  try {
    const order = await Order.findById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!order.customer?.email) {
      return NextResponse.json({ error: "This order has no customer email on file" }, { status: 400 });
    }

    // Custom Orders aren't payable at checkout — make sure the invoice can carry
    // a "Pay Now" link by generating one on the fly if it doesn't have one yet.
    const isUnpaidCustomOrder = CUSTOM_ORDER_PAYMENT_METHODS.includes(order.payment?.method)
      && order.payment?.status !== "Paid";
    if (isUnpaidCustomOrder && !order.paymentLink?.url) {
      const newLink = await createStripePaymentLinkForOrder(order);
      order.paymentLink = { ...newLink, sentCount: 0 };
      order.timeline.push({
        status: order.status,
        message: "Stripe payment link generated for this order.",
        source: "Admin",
      });
    }

    await sendOrderInvoiceEmail(order);

    order.invoice = order.invoice || {};
    order.invoice.sentAt = new Date();
    order.invoice.sentCount = (order.invoice.sentCount || 0) + 1;
    order.timeline.push({
      status: order.status,
      message: `Invoice emailed to ${order.customer.email}.`,
      source: "Admin",
    });
    await order.save();

    return NextResponse.json({ success: true, order });
  } catch (err) {
    console.error("[Order Send Invoice Error]", err);
    return NextResponse.json({ error: err.message || "Failed to send invoice" }, { status: 500 });
  }
}
