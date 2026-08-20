import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import PendingCheckout from "@/models/PendingCheckout";
import Order from "@/models/Order";
import Product from "@/models/Product";
import stripe from "@/lib/stripe";
import { computeAuthoritativeCheckout } from "@/lib/checkoutPricing";
import { getContextLogger, LogCategory } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function POST(req) {
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  const tenantId = req.headers.get("x-tenant-id") || "DEFAULT_STORE";
  const log = getContextLogger(correlationId, { path: '/api/checkout/create-payment-intent', tenantId });

  try {
    await dbConnect();

    const body = await req.json();
    const { items, shippingAddress, financials, customerEmail, customerNote, idempotencyKey, shippingSnapshot, referralCode } = body;

    if (!idempotencyKey) {
      return NextResponse.json({ error: "idempotencyKey is required" }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const existingOrder = await Order.findOne({ idempotencyKey, tenantId });
    if (existingOrder) {
      return NextResponse.json({ error: "This order has already been placed." }, { status: 409 });
    }

    const authSession = await getServerSession(authOptions);
    const orderUserId = authSession?.user?.id || null;
    const checkoutEmail = (customerEmail || authSession?.user?.email || "").trim().toLowerCase();
    const isGuestSession = !orderUserId;
    const ipAddress = req.headers.get("x-forwarded-for") || "unknown";

    const itemProductIds = items.map(item => item.id || item._id);
    const foundProducts = await Product.find({ _id: { $in: itemProductIds }, tenantId });
    const productById = new Map(foundProducts.map(p => [p._id.toString(), p]));

    for (const item of items) {
      const product = productById.get((item.id || item._id)?.toString());
      if (!product) {
        return NextResponse.json({ error: `Product ${item.name || item.id} is no longer available.` }, { status: 400 });
      }
      if (product.manageStock && product.stock < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${product.name}.` }, { status: 400 });
      }
    }

    const pricing = await computeAuthoritativeCheckout({
      items,
      financials,
      referralCode,
      checkoutEmail,
      orderUserId,
      tenantId,
      mongoSession: null,
      dryRun: true,
      log,
    });

    const amountCents = Math.round(pricing.authoritativeTotal * 100);
    if (amountCents <= 0) {
      return NextResponse.json({ error: "Order total must be greater than zero to pay by card." }, { status: 400 });
    }

    const storedPayload = {
      items,
      shippingAddress,
      financials,
      customerEmail,
      customerNote,
      idempotencyKey,
      shippingSnapshot,
      referralCode,
    };
    const storedContext = { tenantId, orderUserId, checkoutEmail, isGuestSession, ipAddress };

    let existingPending = await PendingCheckout.findOne({ tenantId, idempotencyKey });

    if (existingPending?.status === 'consumed') {
      return NextResponse.json({ error: "This order has already been placed." }, { status: 409 });
    }

    let paymentIntent;
    if (existingPending?.stripePaymentIntentId) {
      paymentIntent = await stripe.paymentIntents.update(existingPending.stripePaymentIntentId, {
        amount: amountCents,
        currency: 'usd',
      });
      existingPending.payload = { payload: storedPayload, context: storedContext };
      existingPending.status = 'pending';
      await existingPending.save();
    } else {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          idempotencyKey,
          tenantId,
        },
      });

      await PendingCheckout.findOneAndUpdate(
        { tenantId, idempotencyKey },
        {
          $setOnInsert: { tenantId, idempotencyKey, createdAt: new Date() },
          $set: {
            status: 'pending',
            payload: { payload: storedPayload, context: storedContext },
            stripePaymentIntentId: paymentIntent.id,
          },
        },
        { upsert: true, new: true }
      );
    }

    log.info({ idempotencyKey, amount: pricing.authoritativeTotal }, "PaymentIntent created/updated");

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: pricing.authoritativeTotal,
    });

  } catch (error) {
    log.error({ category: LogCategory.CHECKOUT_TRANSACTION, error: error.message }, "create-payment-intent failed");
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
