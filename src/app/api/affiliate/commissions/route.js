import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
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

    const commissions = await AffiliateCommission.find({ affiliateId: session.user.id })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, commissions });

  } catch (error) {
    console.error("[AffiliateCommissions API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
