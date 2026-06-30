import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import AffiliateCommission from "@/models/AffiliateCommission";
import { NextResponse } from "next/server";

export async function GET(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isAffiliate) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const affiliate = await Affiliate.findById(session.user.id).select("status").lean();
    if (!affiliate || affiliate.status !== 'Active') {
      return NextResponse.json({ error: "Unauthorized: Account suspended or inactive" }, { status: 403 });
    }

    const orders = await Order.find({ affiliateId: session.user.id })
      .select("orderNumber status financials items createdAt")
      .sort({ createdAt: -1 })
      .lean();

    // Map each order with its corresponding commission status & amount
    const orderIds = orders.map(o => o._id);
    const commissions = await AffiliateCommission.find({ orderId: { $in: orderIds } }).lean();

    const mappedOrders = orders.map(order => {
      const comm = commissions.find(c => c.orderId.toString() === order._id.toString());
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        date: order.createdAt,
        subtotal: order.financials?.subtotal || 0,
        commissionAmount: comm ? comm.commissionAmount : 0,
        commissionStatus: comm ? comm.status : "N/A"
      };
    });

    return NextResponse.json({ success: true, orders: mappedOrders });

  } catch (error) {
    console.error("[AffiliateOrders API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
