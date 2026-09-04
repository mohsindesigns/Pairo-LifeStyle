import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { getContextLogger, LogCategory } from "@/lib/logger";
import { NextResponse } from "next/server";
import { createOrderFromCheckoutPayload } from "@/lib/checkoutFulfillment";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { sanitizeText, sanitizeObject } from "@/lib/sanitize";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req) {
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  const tenantId = req.headers.get("x-tenant-id") || "DEFAULT_STORE";
  const log = getContextLogger(correlationId, { path: '/api/checkout', tenantId });
  const ip = getClientIp(req);

  // 1. Rate Limiting (10 checkouts per minute per IP)
  const rateCheck = await checkRateLimit(req, { limit: 10, window: 60, keyPrefix: "CHECKOUT" });
  if (!rateCheck.success) {
    return NextResponse.json(
      { error: `Too many checkout requests. Please wait ${rateCheck.resetIn} seconds before trying again.` },
      { status: 429 }
    );
  }

  const rawBody = await req.json().catch(() => ({}));
  const { turnstileToken } = rawBody;

  // 2. Cloudflare Turnstile Verification
  const turnstileCheck = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstileCheck.success) {
    return NextResponse.json(
      { error: turnstileCheck.error || "Security check failed. Please complete the captcha." },
      { status: 400 }
    );
  }

  const body = sanitizeObject(rawBody);

  const MAX_RETRIES = 3;
  let attempt = 0;

  const { idempotencyKey } = body;

  while (attempt < MAX_RETRIES) {
    try {
      log.info({ category: LogCategory.CHECKOUT_TRANSACTION, attempt: attempt + 1 }, "Processing checkout attempt");
      await dbConnect();

      const authSession = await getServerSession(authOptions);
      const orderUserId = authSession?.user?.id || null;
      const checkoutEmail = (body.customerEmail || authSession?.user?.email || "").trim().toLowerCase();

      if (idempotencyKey) {
        const existingOrder = await Order.findOne({ idempotencyKey, tenantId });
        if (existingOrder) {
          log.warn({ idempotencyKey, orderNumber: existingOrder.orderNumber }, "Idempotency hit");
          return NextResponse.json({ success: true, orderNumber: existingOrder.orderNumber });
        }
      }

      const checkoutResult = await createOrderFromCheckoutPayload(body, {
        tenantId,
        orderUserId,
        checkoutEmail,
        isGuestSession: !orderUserId,
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      });

      if (checkoutResult) {
        log.info({ orderNumber: checkoutResult.orderNumber }, "Checkout success");
        return NextResponse.json({ success: true, orderNumber: checkoutResult.orderNumber, orderId: checkoutResult._id });
      }

    } catch (error) {
      attempt++;
      const isTransient = error.name === 'MongoServerError' && error.code === 112;

      if (isTransient && attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 100;
        log.warn({ attempt, delay }, "Write conflict detected. Retrying...");
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      log.error({ category: LogCategory.CHECKOUT_TRANSACTION, error: error.message }, "Checkout failed");
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Max retries exceeded" }, { status: 503 });
}
