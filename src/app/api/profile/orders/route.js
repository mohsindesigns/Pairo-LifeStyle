import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orders = await Order.find({ "customer.userId": session.user.id })
      .populate('items.productId', 'images image')
      .sort({ createdAt: -1 })
      .lean();

    const enrichedOrders = orders.map(order => ({
      ...order,
      items: (order.items || []).map(item => ({
        ...item,
        image: item.image || item.productId?.images?.[0] || item.productId?.image || "/images/placeholder.jpg"
      }))
    }));

    return NextResponse.json({ success: true, orders: enrichedOrders });

  } catch (error) {
    console.error("Profile Orders Fetch Error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
