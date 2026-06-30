import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Affiliate from "@/models/Affiliate";
import AffiliatePayout from "@/models/AffiliatePayout";
import AffiliateSettings from "@/models/AffiliateSettings";
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

    const payouts = await AffiliatePayout.find({ affiliateId: session.user.id })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, payouts });

  } catch (error) {
    console.error("[AffiliatePayouts GET Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isAffiliate) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { amount, paymentMethod } = body;

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return NextResponse.json({ error: "Please enter a valid payout amount." }, { status: 400 });
    }

    if (!['Bank Transfer', 'IBAN', 'PayPal', 'Wise'].includes(paymentMethod)) {
      return NextResponse.json({ error: "Please select a valid payment method." }, { status: 400 });
    }

    // Get global settings
    let settings = await AffiliateSettings.findOne().lean();
    if (!settings) {
      settings = { minimumPayoutAmount: 50 };
    }

    const minPayout = settings.minimumPayoutAmount || 50;
    if (parsedAmount < minPayout) {
      return NextResponse.json({ error: `The minimum withdrawal threshold is $${minPayout}.` }, { status: 400 });
    }

    // Atomic balance check and deduction to prevent concurrent request double-spending (race condition lock)
    const affiliate = await Affiliate.findOneAndUpdate(
      { _id: session.user.id, status: "Active", balance: { $gte: parsedAmount } },
      { $inc: { balance: -parsedAmount } },
      { new: true }
    );

    if (!affiliate) {
      return NextResponse.json({ error: "Insufficient balance or suspended account." }, { status: 400 });
    }

    // Create the payout record
    const payout = await AffiliatePayout.create({
      affiliateId: affiliate._id,
      amount: parsedAmount,
      paymentMethod,
      status: "Requested"
    });

    console.log(`[AffiliatePayouts] Created payout request of $${parsedAmount} for affiliate: ${affiliate.referralCode}. Remaining balance: $${affiliate.balance}`);

    return NextResponse.json({ success: true, payout }, { status: 201 });

  } catch (error) {
    console.error("[AffiliatePayouts POST Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
