import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Affiliate from "@/models/Affiliate";
import AffiliatePayout from "@/models/AffiliatePayout";
import { sendAffiliatePayoutUpdate } from "@/lib/email";
import { NextResponse } from "next/server";

import { can } from "@/lib/rbac";
import AffiliateLedger from "@/models/AffiliateLedger";
import mongoose from "mongoose";

// List all requested payouts
export async function GET(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isStaff || !can(session.user, "affiliates.view")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payouts = await AffiliatePayout.find()
      .populate("affiliateId", "name email referralCode")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, payouts });

  } catch (error) {
    console.error("[AdminAffiliatePayouts GET Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Approve (Pay) or Reject Payout Request
export async function PUT(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isStaff || !can(session.user, "affiliates.payouts")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { payoutId, action, transactionId, notes } = body;

    if (!payoutId || !['Approve', 'Reject'].includes(action)) {
      return NextResponse.json({ error: "Invalid action or parameters." }, { status: 400 });
    }

    const payout = await AffiliatePayout.findById(payoutId);
    if (!payout) {
      return NextResponse.json({ error: "Payout request not found." }, { status: 404 });
    }

    if (payout.status !== 'Requested') {
      return NextResponse.json({ error: `Payout request is already processed. Current status: ${payout.status}` }, { status: 400 });
    }

    const affiliate = await Affiliate.findById(payout.affiliateId);
    if (!affiliate) {
      return NextResponse.json({ error: "Affiliate account not found." }, { status: 404 });
    }

    if (action === 'Approve') {
      payout.status = 'Paid';
      payout.transactionId = transactionId || `TX-${Date.now()}`;
      payout.paidBy = session.user.id;
      payout.paidDate = new Date();
      payout.notes = notes || "Payout completed successfully.";
      await payout.save();

      console.log(`[AdminPayoutProcessor] Paid payout of $${payout.amount} to affiliate ${affiliate.referralCode} | TxID: ${payout.transactionId}`);

      // Dispatch success email
      try {
        await sendAffiliatePayoutUpdate(affiliate.email, affiliate.name, payout.amount, 'Paid', payout.notes);
      } catch (mailErr) {
        console.error("Payout approval mail send error:", mailErr.message);
      }

      return NextResponse.json({ success: true, payout });
    }

    // ACTION === 'Reject'
    payout.status = 'Rejected';
    payout.notes = notes || "Request does not meet withdrawal criteria.";
    await payout.save();

    // Refund the deducted amount back to available balance (financial ledger record)
    await AffiliateLedger.record({
      affiliateId: affiliate._id,
      tenantId: payout.tenantId || affiliate.tenantId || "default",
      type: 'Credit',
      amount: payout.amount,
      source: 'Reversal',
      referenceModel: 'AffiliatePayout',
      referenceId: payout._id,
      description: `Refunded payout request of $${payout.amount} due to rejection: ${payout.notes}`
    });

    console.log(`[AdminPayoutProcessor] Rejected payout of $${payout.amount} for affiliate ${affiliate.referralCode}. Refunded amount logged in Ledger. New balance: $${affiliate.balance}`);

    // Dispatch rejection email
    try {
      await sendAffiliatePayoutUpdate(affiliate.email, affiliate.name, payout.amount, 'Rejected', payout.notes);
    } catch (mailErr) {
      console.error("Payout rejection mail send error:", mailErr.message);
    }

    return NextResponse.json({ success: true, payout });

  } catch (error) {
    console.error("[AdminAffiliatePayouts PUT Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
