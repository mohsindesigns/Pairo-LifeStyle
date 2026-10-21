import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { can } from "@/lib/rbac";

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "corporate_gifting.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;
  const search = searchParams.get("search") || "";
  const paymentStatus = searchParams.get("paymentStatus") || "all";

  const query = { "items.corporateGifting.enabled": true };
  if (paymentStatus !== "all") query["payment.status"] = paymentStatus;
  if (search) {
    const safeSearch = escapeRegex(search);
    query.$or = [
      { orderNumber: { $regex: safeSearch, $options: "i" } },
      { "customer.email": { $regex: safeSearch, $options: "i" } },
      { "shippingAddress.fullName": { $regex: safeSearch, $options: "i" } },
      { "items.name": { $regex: safeSearch, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(query),
  ]);

  const counts = await Order.aggregate([
    { $match: { "items.corporateGifting.enabled": true } },
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
}
