import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Affiliate from "@/models/Affiliate";
import AffiliateApplication from "@/models/AffiliateApplication";
import { sendAffiliateApplicationApproved, sendAffiliateApplicationRejected } from "@/lib/email";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";

import { can } from "@/lib/rbac";
import { decryptApplication } from "@/models/AffiliateApplication";

// List applications
export async function GET(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isStaff || !can(session.user, "affiliates.view")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawApplications = await AffiliateApplication.find()
      .sort({ createdAt: -1 })
      .lean();

    const applications = rawApplications.map(app => decryptApplication(app));

    return NextResponse.json({ success: true, applications });

  } catch (error) {
    console.error("[AdminAffiliateRequests GET Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Approve/Reject/UpdateCode Application
export async function PUT(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isStaff || !can(session.user, "affiliates.manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { applicationId, action, notes, rejectionReason, customCommissionRate, commissionType, referralCode, customerDiscountType, customerDiscountValue } = body;

    if (!applicationId || !['Approve', 'Reject', 'UpdateCode'].includes(action)) {
      return NextResponse.json({ error: "Invalid action or parameters." }, { status: 400 });
    }

    const application = await AffiliateApplication.findById(applicationId);
    if (!application) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    // ─── UpdateCode: Admin edits referral code before approving ──────────────
    if (action === 'UpdateCode') {
      if (!referralCode) {
        return NextResponse.json({ error: "Referral code is required." }, { status: 400 });
      }
      const cleanCode = referralCode.toUpperCase().trim();
      if (!/^[A-Za-z0-9_-]+$/.test(cleanCode)) {
        return NextResponse.json({ error: "Referral code may only contain letters, numbers, hyphens, and underscores." }, { status: 400 });
      }
      // Uniqueness check — exclude this application
      const conflict = await Affiliate.findOne({ referralCode: cleanCode }) ||
                       await AffiliateApplication.findOne({ referralCode: cleanCode, _id: { $ne: applicationId } });
      if (conflict) {
        return NextResponse.json({ error: "Referral code is already in use." }, { status: 400 });
      }
      application.referralCode = cleanCode;
      if (notes !== undefined) application.notes = notes;
      await application.save();
      return NextResponse.json({ success: true, referralCode: application.referralCode });
    }

    if (application.status === 'Approved' || application.status === 'Rejected') {
      return NextResponse.json({ error: "Application has already been reviewed." }, { status: 400 });
    }

    // ─── Reject ──────────────────────────────────────────────────────────────
    if (action === 'Reject') {
      application.status = 'Rejected';
      application.rejectionReason = rejectionReason || "Does not meet program criteria.";
      application.notes = notes || "";
      application.verification = { verifiedBy: session.user.id, verifiedAt: new Date() };
      await application.save();

      try {
        await sendAffiliateApplicationRejected(application.email, application.name, application.rejectionReason);
      } catch (mailErr) {
        console.error("Rejection mail send error:", mailErr.message);
      }

      return NextResponse.json({ success: true, application });
    }

    // ─── Approve ─────────────────────────────────────────────────────────────
    const existing = await Affiliate.findOne({ email: application.email }).lean();
    if (existing) {
      return NextResponse.json({ error: "An active affiliate with this email already exists." }, { status: 400 });
    }

    // 1. Determine final referral code
    // Priority: admin-provided (from modal) > application.referralCode > auto-generate
    let finalReferralCode = referralCode ? referralCode.toUpperCase().trim() : (application.referralCode || "");

    if (!finalReferralCode) {
      // Auto-generate from name
      const namePart = application.name.trim().split(" ")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      finalReferralCode = namePart;
      let codeCount = 0;
      while (await Affiliate.findOne({ referralCode: finalReferralCode })) {
        codeCount++;
        finalReferralCode = `${namePart}${codeCount}`;
      }
    } else {
      // Validate uniqueness of provided code
      if (!/^[A-Za-z0-9_-]+$/.test(finalReferralCode)) {
        return NextResponse.json({ error: "Referral code may only contain letters, numbers, hyphens, and underscores." }, { status: 400 });
      }
      const codeConflict = await Affiliate.findOne({ referralCode: finalReferralCode });
      if (codeConflict) {
        return NextResponse.json({ error: "Referral code already in use. Please choose a different one." }, { status: 400 });
      }
    }

    // 2. Generate unique affiliateId
    const affiliatesCount = await Affiliate.countDocuments();
    const affiliateId = `AFF-${1000 + affiliatesCount + 1}`;

    // 3. Generate temporary password
    const tempPassword = crypto.randomBytes(6).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const affiliate = await Affiliate.create({
      name: application.name,
      email: application.email,
      password: hashedPassword,
      affiliateId,
      referralCode: finalReferralCode,
      commissionRate: customCommissionRate ? Number(customCommissionRate) : 5,
      commissionType: commissionType || 'Percentage',
      customerDiscountType: customerDiscountType || 'None',
      customerDiscountValue: customerDiscountValue ? Number(customerDiscountValue) : 0,
      balance: 0,
      lifetimeEarnings: 0,
      address: application.address,
      bankingInfo: application.bankingInfo,
      businessInfo: application.businessInfo,
      marketingAnswers: application.marketingAnswers,
      profilePhoto: application.profilePhoto || null,
    });

    // 5. Update Application status
    application.status = 'Approved';
    application.notes = notes || "";
    application.referralCode = finalReferralCode; // Persist the final code back to application
    application.verification = { verifiedBy: session.user.id, verifiedAt: new Date() };
    await application.save();

    // 6. Dispatch approval email
    try {
      await sendAffiliateApplicationApproved(
        application.email,
        application.name,
        finalReferralCode,
        tempPassword,
        affiliate.commissionType,
        affiliate.commissionRate
      );
      console.log(`[AdminAffiliateApproval] Approved affiliate ${finalReferralCode}.`);
    } catch (mailErr) {
      console.error("Approval mail send error:", mailErr.message);
    }

    return NextResponse.json({ 
      success: true, 
      affiliate: {
        _id: affiliate._id,
        affiliateId: affiliate.affiliateId,
        referralCode: affiliate.referralCode,
        tempPassword
      }
    });

  } catch (error) {
    console.error("[AdminAffiliateRequests PUT Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
