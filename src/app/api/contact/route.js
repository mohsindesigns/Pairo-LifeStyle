import dbConnect from "@/lib/db";
import Submission from "@/models/Submission";
import { checkSpam } from "@/lib/spamProtection";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { sanitizeObject } from "@/lib/sanitize";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { NextResponse } from "next/server";

/**
 * POST /api/contact
 * Public endpoint for customer inquiries (Security Hardened)
 */
export async function POST(req) {
  try {
    const ip = getClientIp(req);

    // 1. Rate Limiting (5 requests per minute per IP)
    const rateCheck = await checkRateLimit(req, { limit: 5, window: 60, keyPrefix: "CONTACT" });
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Too many requests. Please wait ${rateCheck.resetIn} seconds before trying again.` },
        { status: 429 }
      );
    }

    const rawData = await req.json().catch(() => ({}));
    
    // 2. Anti-XSS & NoSQL Injection Sanitization
    const data = sanitizeObject(rawData);

    // 3. Cloudflare Turnstile CAPTCHA Verification
    const turnstileCheck = await verifyTurnstileToken(rawData.turnstileToken, ip);
    if (!turnstileCheck.success) {
      return NextResponse.json(
        { error: turnstileCheck.error || "Security check failed. Please verify the captcha." },
        { status: 400 }
      );
    }

    await dbConnect();

    // 4. Honeypot & Keyword Spam Protection
    const spamCheck = checkSpam(data, ip);
    if (spamCheck.isSpam) {
      console.warn(`[SPAM BLOCKED] IP: ${ip} | Reason: ${spamCheck.reason}`);
      // Save silently as Spam without notifying bot
      await Submission.create({
        name: data.name,
        email: data.email,
        phone: data.phone,
        subject: data.subject,
        message: data.message,
        status: 'Spam',
        internalNotes: [{ content: `AUTO-SPAM: ${spamCheck.reason}` }],
        ipAddress: ip,
        userAgent: req.headers.get("user-agent")
      });
      return NextResponse.json({ success: true, message: "Thank you for your message." });
    }

    // 5. Create Verified Submission
    await Submission.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      subject: data.subject,
      message: data.message,
      sourceForm: data.sourceForm || 'Contact',
      sourcePage: data.sourcePage || '/contact',
      ipAddress: ip,
      userAgent: req.headers.get("user-agent")
    });

    return NextResponse.json({ 
      success: true, 
      message: "Message received. Our team will contact you shortly." 
    });

  } catch (error) {
    console.error("[CONTACT_SUBMIT_ERROR]", error);
    return NextResponse.json({ error: "Failed to send message. Please try again." }, { status: 500 });
  }
}
