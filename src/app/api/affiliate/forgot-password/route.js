import dbConnect from "@/lib/db";
import Affiliate from "@/models/Affiliate";
import { sendAffiliatePasswordReset } from "@/lib/email";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req) {
  try {
    const ip = getClientIp(req);

    // 1. Rate Limiting (5 affiliate forgot password requests per minute per IP)
    const rateCheck = await checkRateLimit(req, { limit: 5, window: 60, keyPrefix: "AFF_FORGOT_PW" });
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Too many requests. Please wait ${rateCheck.resetIn} seconds before trying again.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { email, turnstileToken } = body;

    // 2. Cloudflare Turnstile Verification
    const turnstileCheck = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstileCheck.success) {
      return NextResponse.json(
        { error: turnstileCheck.error || "Security check failed. Please verify the captcha." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    await dbConnect();

    const affiliate = await Affiliate.findOne({ 
      email: email.toLowerCase().trim(),
      isDeleted: { $ne: true }
    });

    // Always return success to prevent email enumeration attacks
    if (!affiliate || affiliate.status !== 'Active') {
      return NextResponse.json({ success: true, message: "If an account exists, a reset link has been sent." });
    }

    // Generate secure reset token (32 bytes = 64 hex chars)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store hashed token + 1 hour expiry
    affiliate.resetPasswordToken = hashedToken;
    affiliate.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await affiliate.save({ validateBeforeSave: false });

    // Build reset URL (token sent in plaintext, stored as hash)
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/affiliate/reset-password?token=${resetToken}&email=${encodeURIComponent(affiliate.email)}`;

    try {
      await sendAffiliatePasswordReset(affiliate.email, affiliate.name, resetUrl);
    } catch (mailErr) {
      // Clear token if email fails so user can retry
      affiliate.resetPasswordToken = undefined;
      affiliate.resetPasswordExpires = undefined;
      await affiliate.save({ validateBeforeSave: false });
      console.error("[ForgotPassword] Email send failed:", mailErr.message);
      return NextResponse.json({ error: "Failed to send reset email. Please try again." }, { status: 500 });
    }

    console.log(`[ForgotPassword] Reset link sent to ${affiliate.email}`);
    return NextResponse.json({ success: true, message: "If an account exists, a reset link has been sent." });

  } catch (error) {
    console.error("[AffiliateForgotPassword Error]", error);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
