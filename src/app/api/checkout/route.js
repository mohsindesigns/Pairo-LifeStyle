import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { getContextLogger, LogCategory } from "@/lib/logger";
import { NextResponse } from "next/server";
import { createOrderFromCheckoutPayload } from "@/lib/checkoutFulfillment";

export async function POST(req) {
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  const tenantId = req.headers.get("x-tenant-id") || "DEFAULT_STORE";
  const log = getContextLogger(correlationId, { path: '/api/checkout', tenantId });

  const MAX_RETRIES = 3;
  let attempt = 0;

  const body = await req.json();
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
