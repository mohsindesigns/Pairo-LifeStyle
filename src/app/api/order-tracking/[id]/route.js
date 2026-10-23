import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(req, { params }) {
  try {
    const rateCheck = await checkRateLimit(req, { limit: 30, window: 60, keyPrefix: "ORDER_TRACKING" });
    if (!rateCheck.success) {
      return NextResponse.json({ error: `Too many requests. Please wait ${rateCheck.resetIn} seconds before trying again.` }, { status: 429 });
    }

    await dbConnect();

    const { id } = await params;

    // Only the order's own id is accepted. Order numbers (PAI-1001, PAI-1002, ...) are sequential, so looking an order up
    // by number let anyone walk through every customer's address, phone and payment details. The id is only handed to the
    // buyer by checkout, and by /api/track-order after they prove the order's email address.
    if (!/^[0-9a-fA-F]{24}$/.test(String(id))) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Orders an admin moved to the Trash are not viewable by the customer.
    const order = await Order.findOne({ _id: id, isDeleted: { $ne: true } });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only what the success and tracking pages show. Payment-provider ids, staff-only timeline entries and the
    // promotion rule snapshots stay on the server.
    const financials = order.financials || {};
    const payment = order.payment || {};
    const safeOrder = {
      orderNumber: order.orderNumber,
      status: order.status,
      items: order.items,
      financials: {
        subtotal: financials.subtotal,
        shippingCost: financials.shippingCost,
        tax: financials.tax,
        discountTotal: financials.discountTotal,
        affiliateDiscountAmount: financials.affiliateDiscountAmount,
        total: financials.total,
        currency: financials.currency,
        promoCode: financials.promoCode,
      },
      shippingAddress: order.shippingAddress,
      payment: { method: payment.method, status: payment.status, paidAt: payment.paidAt, receiptUrl: payment.receiptUrl },
      timeline: (order.timeline || []).filter((entry) => entry.source !== "Admin"),
      createdAt: order.createdAt
    };

    return NextResponse.json({ success: true, order: safeOrder });

  } catch (error) {
    console.error("Order Tracking Fetch Error:", error);
    return NextResponse.json({ error: "Failed to fetch order details" }, { status: 500 });
  }
}
