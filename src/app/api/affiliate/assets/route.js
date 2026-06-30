import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import AffiliateMarketingAsset from "@/models/AffiliateMarketingAsset";
import { NextResponse } from "next/server";

export async function GET(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isAffiliate) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assets = await AffiliateMarketingAsset.find({ status: "Active" })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, assets });

  } catch (error) {
    console.error("[AffiliateAssets API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
