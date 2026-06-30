import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Affiliate from "@/models/Affiliate";
import { NextResponse } from "next/server";

export async function PUT(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isAffiliate) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const affiliateCheck = await Affiliate.findById(session.user.id).select("status").lean();
    if (!affiliateCheck || affiliateCheck.status !== 'Active') {
      return NextResponse.json({ error: "Unauthorized: Account suspended or inactive" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    
    // Extract and structure data
    const address = {
      street: body.street || "",
      city: body.city || "",
      state: body.state || "",
      zipCode: body.zipCode || "",
      country: body.country || ""
    };

    const bankingInfo = {
      accountHolder: body.accountHolder || "",
      bankName: body.bankName || "",
      accountNumber: body.accountNumber || "",
      iban: body.iban || "",
      swiftCode: body.swiftCode || "",
      routingNumber: body.routingNumber || "",
      paypalEmail: body.paypalEmail || ""
    };

    const updatedAffiliate = await Affiliate.findByIdAndUpdate(
      session.user.id,
      {
        $set: {
          address,
          bankingInfo
        }
      },
      { new: true }
    );

    if (!updatedAffiliate) {
      return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
    }

    console.log(`[AffiliateAPI] Profile updated for affiliate: ${updatedAffiliate.referralCode}`);

    return NextResponse.json({ success: true, profile: updatedAffiliate });

  } catch (error) {
    console.error("[AffiliateProfile PUT Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
