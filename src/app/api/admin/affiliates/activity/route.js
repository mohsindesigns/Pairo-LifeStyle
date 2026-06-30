import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import AffiliateCommission from "@/models/AffiliateCommission";
import AffiliateClick from "@/models/AffiliateClick";
import Order from "@/models/Order";
import { NextResponse } from "next/server";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  try {
    const [commissions, clicks, referredOrders] = await Promise.all([
      AffiliateCommission.find({})
        .populate("affiliateId", "name referralCode email")
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),

      AffiliateClick.find({})
        .populate("affiliateId", "name referralCode")
        .sort({ createdAt: -1 })
        .limit(500)
        .lean(),

      Order.find({ affiliateReferralCode: { $ne: null } })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean()
    ]);

    return NextResponse.json({ success: true, commissions, clicks, referredOrders });
  } catch (error) {
    console.error("[AdminAffiliatesActivity GET Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
