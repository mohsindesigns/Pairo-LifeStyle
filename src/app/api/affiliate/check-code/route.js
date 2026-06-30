import Affiliate from "@/models/Affiliate";
import AffiliateApplication from "@/models/AffiliateApplication";
import dbConnect from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/affiliate/check-code?code=MYCODE
 * Returns { taken: boolean } — used for real-time referral code uniqueness validation in the signup form.
 */
export async function GET(req) {
  await dbConnect();
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.toUpperCase().trim();

    if (!code || code.length < 2) {
      return NextResponse.json({ taken: false, error: "Code too short" });
    }

    if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      return NextResponse.json({ taken: false, error: "Invalid characters" });
    }

    const conflict = await Affiliate.findOne({ referralCode: code }) ||
                     await AffiliateApplication.findOne({ referralCode: code, status: { $ne: 'Rejected' } });

    return NextResponse.json({ taken: !!conflict });
  } catch (error) {
    console.error("[CheckCode Error]", error);
    return NextResponse.json({ taken: false }, { status: 500 });
  }
}
