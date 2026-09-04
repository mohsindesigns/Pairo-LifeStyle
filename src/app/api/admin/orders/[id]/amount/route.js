import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { can } from "@/lib/rbac";
import { CUSTOM_ORDER_PAYMENT_METHODS } from "@/lib/customOrderConstants";
import { deactivateStripePaymentLink } from "@/lib/orderPaymentLink";

/**
 * Lets an admin set the final price on a Custom Order (Custom Jacket Inquiry
 * conversions and "Customize This Product" requests both land with either no
 * price or the raw catalog price — the real price depends on customization
 * and is decided by an admin, not computed automatically).
 *
 * Any Stripe payment link generated against the old amount is deactivated,
 * since a Payment Link's price can't be edited in place — the admin has to
 * generate a fresh one after changing the amount.
 */
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();

  try {
    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
    }

    const order = await Order.findById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!CUSTOM_ORDER_PAYMENT_METHODS.includes(order.payment?.method)) {
      return NextResponse.json({ error: "The final amount can only be set on Custom Orders" }, { status: 400 });
    }
    if (order.payment?.status === "Paid") {
      return NextResponse.json({ error: "This order has already been paid" }, { status: 400 });
    }

    const currency = order.financials?.currency || "USD";
    const previousTotal = order.financials?.total || 0;

    order.financials.subtotal = amount;
    order.financials.total = amount;
    if (order.items?.[0]) order.items[0].priceAtPurchase = amount;

    if (order.paymentLink?.stripePaymentLinkId) {
      await deactivateStripePaymentLink(order.paymentLink.stripePaymentLinkId);
      order.paymentLink = undefined;
    }

    order.timeline.push({
      status: order.status,
      message: `Final amount set to ${currency} ${amount.toLocaleString()} (was ${currency} ${previousTotal.toLocaleString()}).`,
      source: "Admin",
    });

    await order.save();

    return NextResponse.json({ success: true, order });
  } catch (err) {
    console.error("[Order SetAmount Error]", err);
    return NextResponse.json({ error: err.message || "Failed to set amount" }, { status: 500 });
  }
}
