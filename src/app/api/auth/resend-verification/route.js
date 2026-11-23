import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/db";
import Customer from "@/models/Customer";
import { sendEmailVerification } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const rawEmail = body?.email || "";
    const email = String(rawEmail).trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: "Please provide a valid email address." }, { status: 400 });
    }

    await dbConnect();

    const customer = await Customer.findOne({ email });
    if (!customer) {
      return NextResponse.json({
        message: "No account found with this email. Please sign up first.",
      }, { status: 404 });
    }

    if (customer.emailVerified) {
      return NextResponse.json({
        message: "This email address is already verified. You can log in directly.",
        alreadyVerified: true,
      }, { status: 200 });
    }

    // Generate fresh verification token
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    customer.verificationToken = token;
    customer.verificationTokenExpiry = expiry;
    await customer.save();

    const siteUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://pairolifestyle.com";
    const verificationUrl = `${siteUrl}/verify-email?token=${token}`;

    let emailSent = false;
    try {
      await sendEmailVerification(customer.email, customer.name || "Customer", verificationUrl);
      emailSent = true;
      console.log(`[ResendVerification] ✅ Verification email sent to ${customer.email}`);
    } catch (err) {
      console.error(`[ResendVerification] ⚠️ Error sending email to ${customer.email}:`, err.message);
      console.log(`[ResendVerification] 🔗 Direct Verification Link for ${customer.email}: ${verificationUrl}`);
    }

    return NextResponse.json({
      success: true,
      message: emailSent
        ? "Verification email resent successfully! Please check your inbox and spam folder."
        : "Verification link generated. Please check your inbox shortly or contact support if it does not arrive.",
      emailSent,
      verificationUrl: process.env.NODE_ENV !== "production" ? verificationUrl : undefined,
    }, { status: 200 });
  } catch (err) {
    console.error("[ResendVerification] ❌ Error:", err);
    return NextResponse.json({ message: "Failed to resend verification email." }, { status: 500 });
  }
}
