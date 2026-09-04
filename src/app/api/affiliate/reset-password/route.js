import dbConnect from "@/lib/db";
import Affiliate from "@/models/Affiliate";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(req) {
  try {
    const ip = getClientIp(req);

    // 1. Rate Limiting (5 affiliate reset attempts per minute per IP)
    const rateCheck = await checkRateLimit(req, { limit: 5, window: 60, keyPrefix: "AFF_RESET_PW" });
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Too many requests. Please wait ${rateCheck.resetIn} seconds before trying again.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { token, email, password, turnstileToken } = body;

    // 2. Cloudflare Turnstile Verification
    const turnstileCheck = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstileCheck.success) {
      return NextResponse.json(
        { error: turnstileCheck.error || "Security check failed. Please verify the captcha." },
        { status: 400 }
      );
    }

    if (!token || !email || !password) {
      return NextResponse.json({ error: "Token, email, and new password are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
    }

    await dbConnect();

    // Hash the incoming token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const affiliate = await Affiliate.findOne({
      email: email.toLowerCase().trim(),
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() } // Must not be expired
    });

    if (!affiliate) {
      return NextResponse.json({ error: "Invalid or expired reset link. Please request a new one." }, { status: 400 });
    }

    // Set new password (salt 12 for strong security) and clear reset token fields
    affiliate.password = await bcrypt.hash(password, 12);
    affiliate.resetPasswordToken = undefined;
    affiliate.resetPasswordExpires = undefined;
    await affiliate.save({ validateBeforeSave: false });

    console.log(`[ResetPassword] Password updated for affiliate: ${affiliate.email}`);
    return NextResponse.json({ success: true, message: "Password updated successfully. You can now log in." });

  } catch (error) {
    console.error("[AffiliateResetPassword Error]", error);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
