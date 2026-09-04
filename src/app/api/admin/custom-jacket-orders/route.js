import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { can } from "@/lib/rbac";
import { CUSTOM_ORDER_PAYMENT_METHODS } from "@/lib/customOrderConstants";
import { reconcilePaymentLinkOrder } from "@/lib/stripeFulfillment";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;
  const search = searchParams.get("search") || "";
  const paymentStatus = searchParams.get("paymentStatus") || "all";
  const tenantId = searchParams.get("tenantId") || "DEFAULT_STORE";

  const query = { tenantId, "payment.method": { $in: CUSTOM_ORDER_PAYMENT_METHODS } };
  if (paymentStatus !== "all") query["payment.status"] = paymentStatus;
  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      { "customer.email": { $regex: search, $options: "i" } },
      { "shippingAddress.fullName": { $regex: search, $options: "i" } },
      { "customJacketSnapshot.jacketType": { $regex: search, $options: "i" } },
      { "items.name": { $regex: search, $options: "i" } },
    ];
  }

  try {
    const [items, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(query),
    ]);

    // Self-heal: reconcile any pending orders with an active payment link against
    // Stripe directly, in case the checkout.session.completed webhook was missed.
    const pendingWithLink = items.filter((o) => o.payment?.status !== "Paid" && o.paymentLink?.stripePaymentLinkId);
    if (pendingWithLink.length > 0) {
      await Promise.all(pendingWithLink.map(async (lean) => {
        const doc = await Order.findById(lean._id);
        if (!doc) return;
        const reconciled = await reconcilePaymentLinkOrder(doc, null);
        Object.assign(lean, reconciled.toObject());
      }));
    }

    const counts = await Order.aggregate([
      { $match: { tenantId, "payment.method": { $in: CUSTOM_ORDER_PAYMENT_METHODS } } },
      { $group: { _id: "$payment.status", count: { $sum: 1 } } },
    ]);

    const paymentStatusCounts = {
      all: counts.reduce((a, c) => a + c.count, 0),
      Pending: counts.find((c) => c._id === "Pending")?.count || 0,
      Paid: counts.find((c) => c._id === "Paid")?.count || 0,
      Failed: counts.find((c) => c._id === "Failed")?.count || 0,
      Refunded: counts.find((c) => c._id === "Refunded")?.count || 0,
      "Partially Refunded": counts.find((c) => c._id === "Partially Refunded")?.count || 0,
    };

    return NextResponse.json({
      success: true,
      items,
      pagination: { total, pages: Math.ceil(total / limit), page, limit },
      counts: paymentStatusCounts,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
