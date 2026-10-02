import crypto from "crypto";
import QueueService from "@/lib/queue";
import AuditLog from "@/models/AuditLog";
import dbConnect from "@/lib/db";

/**
 * Pairo Lifestyle CRM Webhook Dispatcher
 * Automatically pushes order events to an external CRM endpoint.
 * Configured via:
 * - CRM_WEBHOOK_URL: target URL (e.g. https://crm.yourdomain.com/api/webhooks/pairo/order)
 * - CRM_WEBHOOK_SECRET: shared secret for HMAC-SHA256 signature verification
 */
export async function dispatchOrderToCRM(event, order) {
  if (!order || !order.orderNumber) {
    return;
  }

  const webhookUrl = process.env.CRM_WEBHOOK_URL;
  if (!webhookUrl) {
    // CRM webhook not configured, skip silently
    return;
  }

  const webhookSecret = process.env.CRM_WEBHOOK_SECRET || process.env.CRM_API_KEY || "pairo-crm-secret";

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    data: {
      orderId: order._id?.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      customer: {
        userId: order.customer?.userId?.toString() || null,
        email: order.customer?.email || "",
        isGuest: Boolean(order.customer?.isGuest),
        ipAddress: order.customer?.ipAddress || "",
      },
      shippingAddress: {
        fullName: order.shippingAddress?.fullName || "",
        street: order.shippingAddress?.street || "",
        city: order.shippingAddress?.city || "",
        state: order.shippingAddress?.state || "",
        zip: order.shippingAddress?.zip || "",
        country: order.shippingAddress?.country || "",
        phone: order.shippingAddress?.phone || "",
      },
      financials: {
        subtotal: order.financials?.subtotal || 0,
        shippingCost: order.financials?.shippingCost || 0,
        tax: order.financials?.tax || 0,
        discountTotal: order.financials?.discountTotal || 0,
        total: order.financials?.total || 0,
        currency: order.financials?.currency || "USD",
        promoCode: order.financials?.promoCode || null,
      },
      payment: {
        method: order.payment?.method || "Cash on Delivery",
        status: order.payment?.status || "Pending",
        provider: order.payment?.provider || null,
        stripePaymentIntentId: order.payment?.stripePaymentIntentId || null,
        paidAt: order.payment?.paidAt || null,
        refundedAmount: order.payment?.refundedAmount || 0,
      },
      items: (order.items || [])
        .filter(Boolean)
        .map((item) => ({
          productId: item.productId?.toString?.() || item.productId || null,
          name: item.name || "Product",
          slug: item.slug || "",
          sku: item.sku || null,
          image: item.image || "",
          priceAtPurchase: item.priceAtPurchase || 0,
          quantity: item.quantity || 1,
          selectedVariant: item.selectedVariant || null,
          madeToMeasure: item.madeToMeasure?.enabled ? item.madeToMeasure : null,
          customization: item.customization?.enabled ? item.customization : null,
        })),
      customJacketSnapshot: order.customJacketSnapshot || null,
      affiliateReferralCode: order.affiliateReferralCode || null,
      customerNote: order.customerNote || null,
      timeline: order.timeline || [],
    },
  };

  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", webhookSecret)
    .update(payloadString)
    .digest("hex");

  QueueService.push(
    `CRM_DISPATCH_${event}_${order.orderNumber}`,
    async () => {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Pairo-Lifestyle-Webhook/1.0",
          "X-Pairo-Signature": `sha256=${signature}`,
          "X-Pairo-Event": event,
        },
        body: payloadString,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`CRM webhook responded with HTTP ${response.status}`);
      }

      try {
        await dbConnect();
        await AuditLog.create({
          event: "CRM_WEBHOOK_DISPATCH_SUCCESS",
          referenceId: order._id?.toString() || order.orderNumber,
          severity: "info",
          message: `Successfully pushed order ${order.orderNumber} to CRM (${event})`,
        });
      } catch (_) {}
    },
    { retries: 3, referenceId: order._id?.toString() || order.orderNumber }
  );
}
