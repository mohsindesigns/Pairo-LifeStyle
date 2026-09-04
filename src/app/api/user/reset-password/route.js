import dbConnect from "@/lib/db";
import Customer from "@/models/Customer";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    const ip = getClientIp(req);

    // 1. Rate Limiting (5 password reset attempts per minute per IP)
    const rateCheck = await checkRateLimit(req, { limit: 5, window: 60, keyPrefix: "RESET_PW" });
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Too many attempts. Please wait ${rateCheck.resetIn} seconds before trying again.` },
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

    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    await dbConnect();

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const customer = await Customer.findOne({
      email: email.toLowerCase().trim(),
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!customer) {
      return NextResponse.json({ error: "This reset link is invalid or has expired. Please request a new one." }, { status: 400 });
    }

    const saltRounds = 12;
    customer.password = await bcrypt.hash(password, saltRounds);
    customer.resetPasswordToken = undefined;
    customer.resetPasswordExpires = undefined;
    await customer.save({ validateBeforeSave: false });

    console.log(`[CustomerResetPassword] Password reset successfully for ${customer.email}`);
    return NextResponse.json({ success: true, message: "Your password has been reset. You can now sign in." });

  } catch (error) {
    console.error("[CustomerResetPassword Error]", error);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
