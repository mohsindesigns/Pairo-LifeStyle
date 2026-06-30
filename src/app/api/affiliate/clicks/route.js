import dbConnect from "@/lib/db";
import Affiliate from "@/models/Affiliate";
import AffiliateClick from "@/models/AffiliateClick";
import AffiliateSettings from "@/models/AffiliateSettings";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/affiliate/rateLimiter";
import clickQueue from "@/lib/affiliate/ClickQueue";

export async function POST(req) {
  await dbConnect();
  try {
    // Enforce public click rate limiting (Max 100 click events per IP per 15 minutes to block DDoS botnets)
    const rateLimitResponse = rateLimit(req, 100, 15 * 60 * 1000);
    if (rateLimitResponse) return rateLimitResponse;

    const data = await req.json().catch(() => ({}));
    const { code, landingPage, referrer, utm } = data;

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const cleanCode = code.toUpperCase().trim();

    // 1. Look up active affiliate by referralCode or couponCode
    const affiliate = await Affiliate.findOne({
      $or: [
        { referralCode: cleanCode },
        { couponCode: cleanCode }
      ],
      status: 'Active',
      isDeleted: { $ne: true }
    }).lean();

    if (!affiliate) {
      return NextResponse.json({ error: "Invalid or inactive referral code" }, { status: 404 });
    }

    // 2. Fetch cookie duration settings
    let settings = await AffiliateSettings.findOne().lean();
    if (!settings) {
      settings = { cookieDurationDays: 30 };
    }

    // 3. Extract Client IP & UA for analytics and spam protection
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "";

    // 4. Rate Limiting / Duplicate click prevention (5 minute window)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingClick = await AffiliateClick.findOne({
      referralCode: affiliate.referralCode,
      ip,
      createdAt: { $gte: fiveMinutesAgo }
    }).lean();

    if (existingClick) {
      console.log(`[AffiliateClick] Blocked duplicate click from IP: ${ip} for code: ${affiliate.referralCode} (within 5 min window)`);
      return NextResponse.json({
        success: true,
        affiliateId: affiliate._id,
        referralCode: affiliate.referralCode,
        cookieDurationDays: settings.cookieDurationDays || 30,
        customerDiscountType: affiliate.customerDiscountType || 'None',
        customerDiscountValue: affiliate.customerDiscountValue || 0
      });
    }

    // 5. Enqueue click to the telemetry queue buffer
    await clickQueue.enqueue({
      affiliateId: affiliate._id,
      referralCode: affiliate.referralCode,
      landingPage: landingPage || "",
      referrer: referrer || "",
      ip,
      userAgent,
      tenantId: affiliate.tenantId || "default",
      utmParameters: {
        source: utm?.source || "",
        medium: utm?.medium || "",
        campaign: utm?.campaign || "",
        content: utm?.content || "",
        term: utm?.term || ""
      }
    });

    console.log(`[AffiliateClick] Queued click from IP: ${ip} for affiliate: ${affiliate.referralCode}`);

    return NextResponse.json({
      success: true,
      affiliateId: affiliate._id,
      referralCode: affiliate.referralCode,
      cookieDurationDays: settings.cookieDurationDays || 30,
      customerDiscountType: affiliate.customerDiscountType || 'None',
      customerDiscountValue: affiliate.customerDiscountValue || 0
    });

  } catch (error) {
    console.error("[AffiliateClick API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
