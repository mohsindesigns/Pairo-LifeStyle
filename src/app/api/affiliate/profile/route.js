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
    
    // Build partial update — only include fields that are explicitly provided
    const setFields = {};
    
    if (body.street !== undefined || body.city !== undefined || body.state !== undefined || body.zipCode !== undefined || body.country !== undefined) {
      // Fetch existing address to merge
      const existing = await Affiliate.findById(session.user.id).select("address").lean();
      setFields.address = {
        street: body.street !== undefined ? body.street : (existing?.address?.street || ""),
        city: body.city !== undefined ? body.city : (existing?.address?.city || ""),
        state: body.state !== undefined ? body.state : (existing?.address?.state || ""),
        zipCode: body.zipCode !== undefined ? body.zipCode : (existing?.address?.zipCode || ""),
        country: body.country !== undefined ? body.country : (existing?.address?.country || "")
      };
    }

    if (body.accountHolder !== undefined || body.bankName !== undefined || body.accountNumber !== undefined || 
        body.iban !== undefined || body.swiftCode !== undefined || body.routingNumber !== undefined || body.paypalEmail !== undefined) {
      const existing = await Affiliate.findById(session.user.id).select("bankingInfo").lean();
      setFields.bankingInfo = {
        accountHolder: body.accountHolder !== undefined ? body.accountHolder : (existing?.bankingInfo?.accountHolder || ""),
        bankName: body.bankName !== undefined ? body.bankName : (existing?.bankingInfo?.bankName || ""),
        accountNumber: body.accountNumber !== undefined ? body.accountNumber : (existing?.bankingInfo?.accountNumber || ""),
        iban: body.iban !== undefined ? body.iban : (existing?.bankingInfo?.iban || ""),
        swiftCode: body.swiftCode !== undefined ? body.swiftCode : (existing?.bankingInfo?.swiftCode || ""),
        routingNumber: body.routingNumber !== undefined ? body.routingNumber : (existing?.bankingInfo?.routingNumber || ""),
        paypalEmail: body.paypalEmail !== undefined ? body.paypalEmail : (existing?.bankingInfo?.paypalEmail || "")
      };
    }

    if (Object.keys(setFields).length === 0) {
      return NextResponse.json({ error: "No fields provided to update." }, { status: 400 });
    }

    const updatedAffiliate = await Affiliate.findByIdAndUpdate(
      session.user.id,
      { $set: setFields },
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
