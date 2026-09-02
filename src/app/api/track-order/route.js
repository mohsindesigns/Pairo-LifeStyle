import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { sanitizeText } from "@/lib/sanitize";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req) {
  try {
    const ip = getClientIp(req);

    // 1. Rate Limiting (10 lookups per minute per IP)
    const rateCheck = await checkRateLimit(req, { limit: 10, window: 60, keyPrefix: "TRACK_ORDER" });
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Too many tracking requests. Please wait ${rateCheck.resetIn} seconds before trying again.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { email, orderNumber, turnstileToken } = body;

    // 2. Cloudflare Turnstile Verification
    const turnstileCheck = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstileCheck.success) {
      return NextResponse.json(
        { error: turnstileCheck.error || "Security check failed. Please verify the captcha." },
        { status: 400 }
      );
    }

    if (!email || !orderNumber) {
      return NextResponse.json({ error: "Email and Order Number are required" }, { status: 400 });
    }

    await dbConnect();

    const cleanOrderNumber = sanitizeText(orderNumber.trim());
    const cleanEmail = sanitizeText(email.trim().toLowerCase());

    const order = await Order.findOne({ 
      orderNumber: cleanOrderNumber, 
      "customer.email": cleanEmail 
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      orderId: order._id 
    });

  } catch (error) {
    console.error("Track Order POST Error:", error);
    return NextResponse.json({ error: "Failed to track order" }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const ip = getClientIp(req);

    // Rate Limiting
    const rateCheck = await checkRateLimit(req, { limit: 10, window: 60, keyPrefix: "TRACK_ORDER_GET" });
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Too many tracking requests. Please wait ${rateCheck.resetIn} seconds before trying again.` },
        { status: 429 }
      );
    }

    await dbConnect();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const orderNumber = searchParams.get("orderNumber");

    if (!email || !orderNumber) {
      return NextResponse.json({ error: "Email and Order Number are required" }, { status: 400 });
    }

    const cleanOrderNumber = sanitizeText(orderNumber.trim());
    const cleanEmail = sanitizeText(email.trim().toLowerCase());

    const order = await Order.findOne({ 
      orderNumber: cleanOrderNumber, 
      "customer.email": cleanEmail 
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      orderId: order._id 
    });

  } catch (error) {
    console.error("Track Order GET Error:", error);
    return NextResponse.json({ error: "Failed to track order" }, { status: 500 });
  }
}
