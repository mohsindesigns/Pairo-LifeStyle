import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Affiliate from "@/models/Affiliate";
import AffiliateClick from "@/models/AffiliateClick";
import AffiliateCommission from "@/models/AffiliateCommission";
import AffiliateLedger from "@/models/AffiliateLedger";
import AffiliatePayout from "@/models/AffiliatePayout";
import Order from "@/models/Order";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { can } from "@/lib/rbac";
import { decryptAffiliate } from "@/models/Affiliate";
import { stripDeletedSuffix, permanentDeleteBlockers, blockersMessage } from "./trash-utils";

// Counts the financial history that keeps each affiliate from being deleted permanently.
async function blockersFor(affiliates) {
  if (!affiliates.length) return new Map();
  const ids = affiliates.map(a => a._id);
  const codes = affiliates.map(a => stripDeletedSuffix(a.referralCode)).filter(Boolean);
  const countBy = async (Model, match, key) => {
    const rows = await Model.aggregate([{ $match: match }, { $group: { _id: `$${key}`, n: { $sum: 1 } } }]);
    return new Map(rows.map(r => [String(r._id), r.n]));
  };
  const [commissions, payouts, ledger, orders] = await Promise.all([
    countBy(AffiliateCommission, { affiliateId: { $in: ids } }, "affiliateId"),
    countBy(AffiliatePayout, { affiliateId: { $in: ids } }, "affiliateId"),
    countBy(AffiliateLedger, { affiliateId: { $in: ids } }, "affiliateId"),
    countBy(Order, { affiliateReferralCode: { $in: codes } }, "affiliateReferralCode"),
  ]);
  return new Map(affiliates.map(a => [String(a._id), permanentDeleteBlockers({
    commissions: commissions.get(String(a._id)) || 0,
    payouts: payouts.get(String(a._id)) || 0,
    ledger: ledger.get(String(a._id)) || 0,
    orders: orders.get(stripDeletedSuffix(a.referralCode)) || 0,
    balance: a.balance || 0,
    lifetimeEarnings: a.lifetimeEarnings || 0,
  })]));
}

// List affiliates (not trashed). ?includeTrashed=1 also returns `trashed`, each with the
// reasons (if any) it can't be deleted permanently.
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

    const { searchParams } = new URL(req.url);
    if (searchParams.get("includeTrashed") !== "1") {
      return NextResponse.json({ success: true, affiliates });
    }

    const rawTrashed = await Affiliate.find({ isDeleted: true })
      .select("-password -bankingInfo -resetPasswordToken -resetPasswordExpires")
      .sort({ deletedAt: -1, updatedAt: -1 })
      .lean();
    const blockers = await blockersFor(rawTrashed);
    const trashed = rawTrashed.map(a => ({
      ...a,
      deleteBlockers: blockers.get(String(a._id)) || [],
    }));

    return NextResponse.json({ success: true, affiliates, trashed });

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
      address, bankingInfo, companyName, website, createdAt, phone, dob, __v 
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
    if (phone !== undefined) affiliate.phone = phone;
    if (dob !== undefined) affiliate.dob = dob ? new Date(dob) : undefined;
    if (commissionRate !== undefined) affiliate.commissionRate = Number(commissionRate);
    if (commissionType !== undefined) affiliate.commissionType = commissionType;
    if (customerDiscountType !== undefined) affiliate.customerDiscountType = customerDiscountType;
    if (customerDiscountValue !== undefined) affiliate.customerDiscountValue = Number(customerDiscountValue);
    if (status) {
      if (!["Active", "Suspended"].includes(status)) {
        return NextResponse.json({ error: "Status must be Active or Suspended." }, { status: 400 });
      }
      affiliate.status = status;
    }
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

// DELETE ?id=…               → move to Trash (suspends the affiliate; nothing else is touched)
// DELETE ?id=…&permanent=1    → delete for good, only from the Trash and only when the affiliate
//                                has no commissions, payouts, ledger entries, referred orders or
//                                money owed — that history is kept, so such affiliates stay trashed.
export async function DELETE(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isStaff || !can(session.user, "affiliates.manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const affiliateId = searchParams.get("id");
    const permanent = searchParams.get("permanent") === "1";

    if (!affiliateId) {
      return NextResponse.json({ error: "Affiliate ID is required." }, { status: 400 });
    }
    if (!mongoose.isValidObjectId(affiliateId)) {
      return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
    }

    const affiliate = await Affiliate.findById(affiliateId).lean();
    if (!affiliate) {
      return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
    }

    if (permanent) {
      if (!affiliate.isDeleted) {
        return NextResponse.json({ error: "Move the affiliate to Trash before deleting it permanently." }, { status: 409 });
      }
      const reasons = (await blockersFor([affiliate])).get(String(affiliate._id)) || [];
      if (reasons.length) {
        return NextResponse.json({ error: blockersMessage(reasons), blockers: reasons }, { status: 409 });
      }
      // Only click logs are left to clean up (they expire on their own after 90 days anyway).
      await AffiliateClick.deleteMany({ affiliateId: affiliate._id });
      await Affiliate.deleteOne({ _id: affiliate._id });
      console.log(`[AdminAffiliateDelete] Permanently deleted affiliate ${affiliate.referralCode}.`);
      return NextResponse.json({ success: true, message: "Affiliate deleted permanently." });
    }

    if (affiliate.isDeleted) {
      return NextResponse.json({ success: true, message: "Affiliate is already in Trash." });
    }

    // Trash = hidden from the lists + suspended, which blocks login, ends open sessions on the
    // next request and stops referral codes/coupons from earning at checkout. Commissions,
    // payouts and the ledger are kept. updateOne skips the banking-format checks in the save
    // hook, which older records may not pass.
    await Affiliate.updateOne(
      { _id: affiliate._id },
      { $set: { isDeleted: true, deletedAt: new Date(), statusBeforeTrash: affiliate.status || "Active", status: "Suspended" } }
    );
    return NextResponse.json({ success: true, message: "Affiliate moved to Trash." });

  } catch (error) {
    console.error("[AdminAffiliatesList DELETE Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH { affiliateId, action: "restore" } → bring an affiliate back from the Trash with the
// status it had before (trashed by the old delete flow → Suspended, for an admin to review).
export async function PATCH(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isStaff || !can(session.user, "affiliates.manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { affiliateId, action } = await req.json().catch(() => ({}));
    if (action !== "restore" || !affiliateId) {
      return NextResponse.json({ error: "Invalid action or parameters." }, { status: 400 });
    }
    if (!mongoose.isValidObjectId(affiliateId)) {
      return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
    }

    const affiliate = await Affiliate.findById(affiliateId).lean();
    if (!affiliate) {
      return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
    }
    if (!affiliate.isDeleted) {
      return NextResponse.json({ success: true, message: "Affiliate is not in Trash." });
    }

    const email = stripDeletedSuffix(affiliate.email);
    const referralCode = stripDeletedSuffix(affiliate.referralCode);
    const couponCode = affiliate.couponCode ? stripDeletedSuffix(affiliate.couponCode) : affiliate.couponCode;
    const others = { _id: { $ne: affiliate._id } };
    if (email !== affiliate.email && await Affiliate.exists({ ...others, email })) {
      return NextResponse.json({ error: `Another affiliate now uses ${email}, so this one can't be restored.` }, { status: 409 });
    }
    if (referralCode !== affiliate.referralCode && await Affiliate.exists({ ...others, referralCode })) {
      return NextResponse.json({ error: `Another affiliate now uses the referral code ${referralCode}, so this one can't be restored.` }, { status: 409 });
    }
    if (couponCode && couponCode !== affiliate.couponCode && await Affiliate.exists({ ...others, couponCode })) {
      return NextResponse.json({ error: `Another affiliate now uses the coupon code ${couponCode}, so this one can't be restored.` }, { status: 409 });
    }

    const status = affiliate.statusBeforeTrash || "Suspended";
    await Affiliate.updateOne(
      { _id: affiliate._id },
      // couponCode is only set when present: it has a sparse unique index, so it must stay absent, never null.
      { $set: { isDeleted: false, deletedAt: null, statusBeforeTrash: null, status, email, referralCode, ...(couponCode ? { couponCode } : {}) } }
    );
    return NextResponse.json({ success: true, status, message: `Affiliate restored as ${status}.` });
  } catch (error) {
    console.error("[AdminAffiliatesList PATCH Error]", error);
    if (error.code === 11000) {
      return NextResponse.json({ error: "Email, referral code or coupon code is already used by another affiliate." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
