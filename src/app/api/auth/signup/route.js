import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Customer from "@/models/Customer";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendEmailVerification } from "@/lib/email";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { sanitizeText } from "@/lib/sanitize";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const ip = getClientIp(req);

    // 1. Rate Limiting (5 signups per minute per IP)
    const rateCheck = await checkRateLimit(req, { limit: 5, window: 60, keyPrefix: "SIGNUP" });
    if (!rateCheck.success) {
      return NextResponse.json(
        { message: `Too many attempts. Please wait ${rateCheck.resetIn} seconds before trying again.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { password, hp_field, turnstileToken } = body;
    const name = sanitizeText(body.name);
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";

    // 2. Honeypot check
    if (hp_field) {
      return NextResponse.json({
        message: "Account created. Please check your email to verify your account.",
        pendingVerification: true
      }, { status: 201 });
    }

    // 3. Cloudflare Turnstile Verification
    const turnstileCheck = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstileCheck.success) {
      return NextResponse.json(
        { message: turnstileCheck.error || "Captcha verification failed. Please try again." },
        { status: 400 }
      );
    }

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return NextResponse.json({ message: "Please provide a valid email address." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters" }, { status: 400 });
    }

    const conn = await dbConnect();
    if (!conn) {
      return NextResponse.json({
        message: "Database connection error",
        error: "Database configuration is missing in environment variables."
      }, { status: 500 });
    }

    // Check existing
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      // If they exist but never verified, resend the verification email
      if (!existingCustomer.emailVerified) {
        const token = crypto.randomBytes(32).toString("hex");
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
        existingCustomer.verificationToken = token;
        existingCustomer.verificationTokenExpiry = expiry;
        await existingCustomer.save();

        const siteUrl = process.env.NEXTAUTH_URL || "https://pairolifestyle.com";
        const verificationUrl = `${siteUrl}/verify-email?token=${token}`;
        try {
          await sendEmailVerification(email, name, verificationUrl);
          return NextResponse.json({
            message: "Verification email resent. Please check your inbox.",
            resent: true
          }, { status: 200 });
        } catch (emailError) {
          console.error("[Signup] ⚠️ Failed to resend verification email:", emailError);
          return NextResponse.json({
            message: "Failed to resend verification email. Please try again.",
            error: emailError.message
          }, { status: 500 });
        }
      }
      return NextResponse.json({ message: "An account with this email already exists." }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Create unverified customer
    const customer = await Customer.create({
      name,
      email,
      password: hashedPassword,
      emailVerified: false,
      verificationToken,
      verificationTokenExpiry,
    });
    console.log(`[Signup] ✨ Customer created (unverified): ${customer._id}`);

    // Send verification email
    const siteUrl = process.env.NEXTAUTH_URL || "https://pairolifestyle.com";
    const verificationUrl = `${siteUrl}/verify-email?token=${verificationToken}`;
    try {
      await sendEmailVerification(email, name, verificationUrl);
      console.log(`[Signup] ✅ Verification email dispatched to ${email}`);
      return NextResponse.json({
        message: "Account created. Please check your email to verify your account.",
        pendingVerification: true
      }, { status: 201 });
    } catch (emailError) {
      console.error("[Signup] ⚠️ Failed to send verification email:", emailError);
      return NextResponse.json({
        message: "Failed to send verification email. Please try again.",
        error: emailError.message
      }, { status: 500 });
    }

  } catch (error) {
    console.error("[Signup] ❌ CRITICAL ERROR:", error);
    return NextResponse.json({
      message: "Internal server error",
      error: error.message,
    }, { status: 500 });
  }
}
