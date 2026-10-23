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
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
  const skip = (page - 1) * limit;
  const search = searchParams.get("search") || "";
  const paymentStatus = searchParams.get("paymentStatus") || "all";
  // Custom orders are ordinary orders, so Trash is the orders soft delete (isDeleted).
  const trash = searchParams.get("trash") === "true";

  const base = { "payment.method": { $in: CUSTOM_ORDER_PAYMENT_METHODS } };
  const query = { ...base, isDeleted: trash ? true : { $ne: true } };
  if (!trash && paymentStatus !== "all") query["payment.status"] = paymentStatus;
  const searchOr = search
    ? (() => {
        const rx = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
        return [
          { orderNumber: rx },
          { "customer.email": rx },
          { "shippingAddress.fullName": rx },
          { "customJacketSnapshot.jacketType": rx },
          { "items.name": rx },
        ];
      })()
    : null;
  if (searchOr) query.$or = searchOr;

  try {
    const [items, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(query),
    ]);

    // Self-heal: reconcile any pending orders with an active payment link against
    // Stripe directly, in case the checkout.session.completed webhook was missed.
    const pendingWithLink = trash ? [] : items.filter((o) => o.payment?.status !== "Paid" && o.paymentLink?.stripePaymentLinkId);
    if (pendingWithLink.length > 0) {
      await Promise.all(pendingWithLink.map(async (lean) => {
        const doc = await Order.findById(lean._id);
        if (!doc) return;
        const reconciled = await reconcilePaymentLinkOrder(doc, null);
        Object.assign(lean, reconciled.toObject());
      }));
    }

    // Tab counts respect the search term (same as the Orders list).
    const countMatch = { ...base, ...(searchOr ? { $or: searchOr } : {}) };
    const [counts, trashCount] = await Promise.all([
      Order.aggregate([
        { $match: { ...countMatch, isDeleted: { $ne: true } } },
        { $group: { _id: "$payment.status", count: { $sum: 1 } } },
      ]),
      Order.countDocuments({ ...countMatch, isDeleted: true }),
    ]);

    const paymentStatusCounts = {
      all: counts.reduce((a, c) => a + c.count, 0),
      Pending: counts.find((c) => c._id === "Pending")?.count || 0,
      Paid: counts.find((c) => c._id === "Paid")?.count || 0,
      Failed: counts.find((c) => c._id === "Failed")?.count || 0,
      Refunded: counts.find((c) => c._id === "Refunded")?.count || 0,
      "Partially Refunded": counts.find((c) => c._id === "Partially Refunded")?.count || 0,
      trash: trashCount,
    };

    return NextResponse.json({
      success: true,
      items,
      pagination: { total, pages: Math.max(1, Math.ceil(total / limit)), page, limit },
      counts: paymentStatusCounts,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
