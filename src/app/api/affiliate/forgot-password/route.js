import dbConnect from "@/lib/db";
import Affiliate from "@/models/Affiliate";
import { sendAffiliatePasswordReset } from "@/lib/email";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req) {
  await dbConnect();
  try {
    const { email } = await req.json().catch(() => ({}));
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    const affiliate = await Affiliate.findOne({ 
      email: email.toLowerCase().trim(),
      isDeleted: { $ne: true }
    });

    // Always return success to prevent email enumeration attacks
    if (!affiliate) {
      return NextResponse.json({ success: true, message: "If an account exists, a reset link has been sent." });
    }

    if (affiliate.status !== 'Active') {
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
