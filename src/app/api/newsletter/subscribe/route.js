import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Submission from "@/models/Submission";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { sanitizeText } from "@/lib/sanitize";

export async function POST(req) {
  try {
    const ip = getClientIp(req);

    // 1. Rate Limiting (5 newsletter requests per minute per IP)
    const rateCheck = await checkRateLimit(req, { limit: 5, window: 60, keyPrefix: "NEWSLETTER" });
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Too many requests. Please wait ${rateCheck.resetIn} seconds before trying again.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { hp_field, turnstileToken } = body;
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";

    // 2. Honeypot check for bots
    if (hp_field) {
      return NextResponse.json({ message: "You're now on the list. Welcome!" }, { status: 201 });
    }

    // 3. Turnstile check if token provided
    if (turnstileToken) {
      const turnstileCheck = await verifyTurnstileToken(turnstileToken, ip);
      if (!turnstileCheck.success) {
        return NextResponse.json(
          { error: turnstileCheck.error || "Captcha verification failed. Please try again." },
          { status: 400 }
        );
      }
    }

    if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    await dbConnect();

    const cleanEmail = sanitizeText(email);

    // Check if this email already has a newsletter submission
    const existing = await Submission.findOne({
      email: cleanEmail,
      sourceForm: 'Email Subscriber',
      isDeleted: false,
    });

    if (existing) {
      return NextResponse.json({ message: "You're already subscribed! Thank you." });
    }

    await Submission.create({
      name: cleanEmail.split('@')[0],
      email: cleanEmail,
      message: 'Newsletter subscription',
      sourceForm: 'Email Subscriber',
      sourcePage: sanitizeText(body.sourcePage || 'Footer'),
      status: 'Read',
      priority: 'Low',
      ipAddress: ip,
      userAgent: req.headers.get("user-agent")
    });

    return NextResponse.json({ message: "You're now on the list. Welcome!" }, { status: 201 });
  } catch (error) {
    console.error("[Newsletter Subscribe Error]", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
