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

// Approve/Reject Application
export async function PUT(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isStaff || !can(session.user, "affiliates.manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { applicationId, action, notes, rejectionReason, customCommissionRate } = body;

    if (!applicationId || !['Approve', 'Reject'].includes(action)) {
      return NextResponse.json({ error: "Invalid action or parameters." }, { status: 400 });
    }

    const application = await AffiliateApplication.findById(applicationId);
    if (!application) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    if (application.status === 'Approved' || application.status === 'Rejected') {
      return NextResponse.json({ error: "Application has already been reviewed." }, { status: 400 });
    }

    if (action === 'Reject') {
      application.status = 'Rejected';
      application.rejectionReason = rejectionReason || "Does not meet program criteria.";
      application.notes = notes || "";
      application.verification = {
        verifiedBy: session.user.id,
        verifiedAt: new Date()
      };
      await application.save();

      // Dispatch rejection email
      try {
        await sendAffiliateApplicationRejected(application.email, application.name, application.rejectionReason);
      } catch (mailErr) {
        console.error("Rejection mail send error:", mailErr.message);
      }

      return NextResponse.json({ success: true, application });
    }

    // ACTION === 'Approve'
    // 1. Double check if email already registered as active affiliate
    const existing = await Affiliate.findOne({ email: application.email }).lean();
    if (existing) {
      return NextResponse.json({ error: "An active affiliate with this email already exists." }, { status: 400 });
    }

    // 2. Generate unique referralCode (e.g. MOHSIN)
    const namePart = application.name.trim().split(" ")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    let referralCode = namePart;
    let codeCount = 0;
    while (await Affiliate.findOne({ referralCode })) {
      codeCount++;
      referralCode = `${namePart}${codeCount}`;
    }

    // 3. Generate unique affiliateId (e.g. AFF-1001)
    const affiliatesCount = await Affiliate.countDocuments();
    const affiliateId = `AFF-${1000 + affiliatesCount + 1}`;

    // 4. Generate random temporary password
    const tempPassword = crypto.randomBytes(6).toString("hex"); // e.g. "a2f9b8c3d4e5"
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // 5. Create Affiliate
    const affiliate = await Affiliate.create({
      name: application.name,
      email: application.email,
      password: hashedPassword,
      affiliateId,
      referralCode,
      commissionRate: customCommissionRate ? Number(customCommissionRate) : 5,
      balance: 0,
      lifetimeEarnings: 0,
      address: application.address,
      bankingInfo: application.bankingInfo,
      businessInfo: application.businessInfo,
      marketingAnswers: application.marketingAnswers
    });

    // 6. Update Application status
    application.status = 'Approved';
    application.notes = notes || "";
    application.verification = {
      verifiedBy: session.user.id,
      verifiedAt: new Date()
    };
    await application.save();

    // 7. Dispatch approval email with temporary password & referralCode details
    try {
      await sendAffiliateApplicationApproved(application.email, application.name, referralCode);
      console.log(`[AdminAffiliateApproval] Approved affiliate ${referralCode}. Temporary Password sent in email: ${tempPassword}`);
    } catch (mailErr) {
      console.error("Approval mail send error:", mailErr.message);
    }

    return NextResponse.json({ 
      success: true, 
      affiliate: {
        _id: affiliate._id,
        affiliateId: affiliate.affiliateId,
        referralCode: affiliate.referralCode,
        tempPassword // Return temporarily for admin convenience
      }
    });

  } catch (error) {
    console.error("[AdminAffiliateRequests PUT Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
