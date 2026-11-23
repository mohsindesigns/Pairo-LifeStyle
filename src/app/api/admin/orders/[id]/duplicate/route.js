import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { can } from "@/lib/rbac";
import { orderLookupQuery } from "@/lib/orderLookup";
import { getNextOrderNumber } from "@/lib/checkoutFulfillment";
import { buildDuplicateOrderDoc } from "../../duplicateOrder";

/**
 * Admin "Duplicate" for an order: creates a Pending draft copy with the original
 * line-item prices. Unlike POST /api/admin/orders it does NOT re-price items,
 * deduct stock, dispatch ORDER_CREATED (customer emails) or carry affiliate /
 * promotion attribution (commissions, coupon usage).
 */
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "orders.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await dbConnect();
    const { id } = await params;
    const source = await orderLookupQuery(id).lean();
    if (!source) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (!Array.isArray(source.items) || source.items.length === 0) {
      return NextResponse.json({ error: "This order has no line items to duplicate." }, { status: 400 });
    }

    const orderNumber = await getNextOrderNumber();
    const doc = buildDuplicateOrderDoc(source, {
      orderNumber,
      staffName: session.user.name || session.user.email || "Admin",
    });
    const order = await Order.create(doc);

    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error) {
    console.error("[Admin Order Duplicate Error]", error);
    return NextResponse.json({ error: error.message || "Failed to duplicate order" }, { status: 500 });
  }
}
