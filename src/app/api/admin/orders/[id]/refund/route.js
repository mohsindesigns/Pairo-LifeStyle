import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import stripe from "@/lib/stripe";
import { can } from "@/lib/rbac";
import { CommissionEngine } from "@/lib/affiliate/CommissionEngine";

export async function POST(req, { params }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);

    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(session.user, "orders.refund")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "DEFAULT_STORE";
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const requestedAmount = body?.amount;

    const order = await Order.findOne({ _id: id, tenantId });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (order.payment?.provider !== 'stripe' || !order.payment?.stripePaymentIntentId) {
      return NextResponse.json({ error: "Order has no associated Stripe payment to refund." }, { status: 400 });
    }

    const alreadyRefunded = order.payment.refundedAmount || 0;
    const remaining = Math.max(0, (order.financials.total || 0) - alreadyRefunded);

    const refundAmount = requestedAmount !== undefined && requestedAmount !== null
      ? Number(requestedAmount)
      : remaining;

    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      return NextResponse.json({ error: "Refund amount must be greater than zero." }, { status: 400 });
    }
    if (refundAmount > remaining + 0.01) {
      return NextResponse.json({ error: `Refund amount exceeds remaining refundable balance of ${remaining}.` }, { status: 400 });
    }

    const refund = await stripe.refunds.create({
      payment_intent: order.payment.stripePaymentIntentId,
      amount: Math.round(refundAmount * 100),
    });

    const newRefundedAmount = Math.round((alreadyRefunded + refundAmount) * 100) / 100;
    const isFullyRefunded = newRefundedAmount >= (order.financials.total || 0) - 0.01;

    order.payment.refundedAmount = newRefundedAmount;
    order.payment.status = isFullyRefunded ? 'Refunded' : 'Partially Refunded';

    order.timeline.push({
      status: order.status,
      message: `${isFullyRefunded ? 'Full' : 'Partial'} refund of $${refundAmount.toFixed(2)} issued via Stripe (${refund.id}).`,
      source: "Admin",
      adminUser: session.user.id,
    });

    if (isFullyRefunded) {
      order.status = 'Refunded';
    }

    await order.save();

    if (order.affiliateId) {
      try {
        await CommissionEngine.reverseCommission(order._id, "Refunded", isFullyRefunded ? null : refundAmount);
      } catch (e) {
        console.error("[Refund Affiliate Commission Reversal Error]", e);
      }
    }

    return NextResponse.json({ success: true, order, refundId: refund.id });

  } catch (error) {
    console.error("Refund Error:", error);
    return NextResponse.json({ error: error.message || "Refund failed" }, { status: 500 });
  }
}
