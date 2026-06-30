import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import AffiliateSettings from "@/models/AffiliateSettings";
import { NextResponse } from "next/server";

import { can } from "@/lib/rbac";

// Get global settings
export async function GET(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isStaff || !can(session.user, "affiliates.settings")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let settings = await AffiliateSettings.findOne();
    if (!settings) {
      settings = await AffiliateSettings.create({
        defaultCommissionRate: 5,
        cookieDurationDays: 30,
        minimumPayoutAmount: 50,
        autoApproveApplications: false,
        supportEmail: "affiliates@pairolifestyle.com"
      });
    }

    return NextResponse.json({ success: true, settings });

  } catch (error) {
    console.error("[AdminAffiliateSettings GET Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Update settings
export async function PUT(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isStaff || !can(session.user, "affiliates.settings")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { defaultCommissionRate, cookieDurationDays, minimumPayoutAmount, autoApproveApplications, supportEmail } = body;

    let settings = await AffiliateSettings.findOne();
    if (!settings) {
      settings = new AffiliateSettings();
    }

    if (defaultCommissionRate !== undefined) settings.defaultCommissionRate = Number(defaultCommissionRate);
    if (cookieDurationDays !== undefined) settings.cookieDurationDays = Number(cookieDurationDays);
    if (minimumPayoutAmount !== undefined) settings.minimumPayoutAmount = Number(minimumPayoutAmount);
    if (autoApproveApplications !== undefined) settings.autoApproveApplications = !!autoApproveApplications;
    if (supportEmail) settings.supportEmail = supportEmail;

    await settings.save();
    console.log("[AdminAffiliateSettings] Global settings updated successfully.");

    return NextResponse.json({ success: true, settings });

  } catch (error) {
    console.error("[AdminAffiliateSettings PUT Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
