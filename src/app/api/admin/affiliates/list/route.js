import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Affiliate from "@/models/Affiliate";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { can } from "@/lib/rbac";
import { decryptAffiliate } from "@/models/Affiliate";

// List all active/suspended affiliates
export async function GET(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isStaff || !can(session.user, "affiliates.view")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawAffiliates = await Affiliate.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean();

    const affiliates = rawAffiliates.map(aff => decryptAffiliate(aff));

    return NextResponse.json({ success: true, affiliates });

  } catch (error) {
    console.error("[AdminAffiliatesList GET Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Edit affiliate settings
export async function PUT(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isStaff || !can(session.user, "affiliates.manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { 
      affiliateId, name, email, commissionRate, commissionType, status, 
      couponCode, password, referralCode, customerDiscountType, customerDiscountValue, 
      address, bankingInfo, companyName, website, createdAt, __v 
    } = body;

    if (!affiliateId) {
      return NextResponse.json({ error: "Affiliate ID is required." }, { status: 400 });
    }

    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate || affiliate.isDeleted) {
      return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
    }

    // Optimistic Concurrency Control (OCC) using Mongoose version keys
    if (__v !== undefined && affiliate.__v !== Number(__v)) {
      return NextResponse.json({ 
        error: "Conflict: This record was modified by another administrator. Please reload to see latest updates." 
      }, { status: 409 });
    }

    // Set fields
    if (name) affiliate.name = name;
    if (email) affiliate.email = email.toLowerCase().trim();
    if (commissionRate !== undefined) affiliate.commissionRate = Number(commissionRate);
    if (commissionType !== undefined) affiliate.commissionType = commissionType;
    if (customerDiscountType !== undefined) affiliate.customerDiscountType = customerDiscountType;
    if (customerDiscountValue !== undefined) affiliate.customerDiscountValue = Number(customerDiscountValue);
    if (status) affiliate.status = status;
    if (createdAt) affiliate.createdAt = new Date(createdAt);
    
    if (couponCode !== undefined) {
      affiliate.couponCode = couponCode ? couponCode.toUpperCase().trim() : undefined;
    }

    // Address merge/override
    if (address) {
      affiliate.address = {
        street: address.street || "",
        city: address.city || "",
        state: address.state || "",
        zipCode: address.zipCode || "",
        country: address.country || "",
      };
    }

    // Banking info merge/override (sensitive fields will be encrypted by schema pre-save hook)
    if (bankingInfo) {
      affiliate.bankingInfo = {
        accountHolder: bankingInfo.accountHolder || "",
        bankName: bankingInfo.bankName || "",
        accountNumber: bankingInfo.accountNumber || "",
        iban: bankingInfo.iban || "",
        swiftCode: bankingInfo.swiftCode || "",
        routingNumber: bankingInfo.routingNumber || "",
        paypalEmail: bankingInfo.paypalEmail || "",
      };
    }

    // Business details
    if (companyName !== undefined || website !== undefined) {
      affiliate.businessInfo = {
        companyName: companyName !== undefined ? companyName : (affiliate.businessInfo?.companyName || ""),
        website: website !== undefined ? website : (affiliate.businessInfo?.website || ""),
        socialLinks: affiliate.businessInfo?.socialLinks || [],
      };
    }

    // Referral code update (admin only — validated for uniqueness)
    if (referralCode !== undefined && referralCode !== "") {
      const cleanCode = referralCode.toUpperCase().trim();
      if (!/^[A-Za-z0-9_-]+$/.test(cleanCode)) {
        return NextResponse.json({ error: "Referral code may only contain letters, numbers, hyphens, and underscores." }, { status: 400 });
      }
      const conflict = await Affiliate.findOne({ referralCode: cleanCode, _id: { $ne: affiliateId } });
      if (conflict) {
        return NextResponse.json({ error: "Referral code is already in use by another affiliate." }, { status: 400 });
      }
      affiliate.referralCode = cleanCode;
    }

    if (password) {
      affiliate.password = await bcrypt.hash(password, 10);
    }

    await affiliate.save();
    console.log(`[AdminAffiliateUpdate] Updated settings for affiliate: ${affiliate.referralCode}. New version: ${affiliate.__v}`);

    return NextResponse.json({ success: true, affiliate });

  } catch (error) {
    console.error("[AdminAffiliatesList PUT Error]", error);
    // Handle duplicate key errors cleanly (e.g. couponCode already registered)
    if (error.code === 11000) {
      return NextResponse.json({ error: "Email or Coupon Code is already in use by another affiliate." }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
