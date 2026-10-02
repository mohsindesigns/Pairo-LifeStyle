import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import pairoEvents from "@/lib/events";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Validates the CRM API Key if configured in environment.
 * If CRM_API_KEY is not set in .env.local, access is permitted so the endpoint works out of the box.
 * Supports:
 * - Header: x-api-key: <key>
 * - Header: Authorization: Bearer <key>
 * - Query Param: ?apiKey=<key> or ?api_key=<key>
 */
function validateCrmAuth(req) {
  const configuredKey = process.env.CRM_API_KEY;
  if (!configuredKey) {
    // If no key is set, allow access out-of-the-box
    return true;
  }

  const { searchParams } = new URL(req.url);
  const queryKey = searchParams.get("apiKey") || searchParams.get("api_key");
  const apiKeyHeader = req.headers.get("x-api-key");
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;

  const providedKey = apiKeyHeader || bearerToken || queryKey;
  return providedKey && providedKey === configuredKey;
}

/**
 * GET /api/crm/orders (also available at /api/orders)
 * Retrieve list of orders with pagination, status filtering, and incremental sync
 */
export async function GET(req) {
  try {
    if (!validateCrmAuth(req)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Invalid or missing CRM API Key." },
        { status: 401, headers: corsHeaders }
      );
    }

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const status = searchParams.get("status");
    const since = searchParams.get("since");
    const orderNumber = searchParams.get("orderNumber");
    const email = searchParams.get("email");

    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (orderNumber) {
      const sanitized = escapeRegex(orderNumber.trim());
      query.orderNumber = { $regex: sanitized, $options: "i" };
    }

    if (email) {
      const sanitized = escapeRegex(email.trim());
      query["customer.email"] = { $regex: sanitized, $options: "i" };
    }

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        query.$or = [
          { updatedAt: { $gte: sinceDate } },
          { createdAt: { $gte: sinceDate } },
        ];
      }
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    const formattedOrders = orders.map((o) => ({
      id: o._id.toString(),
      orderNumber: o.orderNumber,
      status: o.status,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      customer: {
        userId: o.customer?.userId?.toString() || null,
        email: o.customer?.email || "",
        isGuest: Boolean(o.customer?.isGuest),
        ipAddress: o.customer?.ipAddress || "",
      },
      shippingAddress: o.shippingAddress || {},
      financials: {
        subtotal: o.financials?.subtotal || 0,
        shippingCost: o.financials?.shippingCost || 0,
        tax: o.financials?.tax || 0,
        discountTotal: o.financials?.discountTotal || 0,
        total: o.financials?.total || 0,
        currency: o.financials?.currency || "USD",
        promoCode: o.financials?.promoCode || null,
        appliedPromotions: o.financials?.appliedPromotions || [],
      },
      payment: {
        method: o.payment?.method || "Cash on Delivery",
        status: o.payment?.status || "Pending",
        provider: o.payment?.provider || null,
        stripePaymentIntentId: o.payment?.stripePaymentIntentId || null,
        paidAt: o.payment?.paidAt || null,
        refundedAmount: o.payment?.refundedAmount || 0,
      },
      items: (o.items || []).map((item) => ({
        productId: item.productId?.toString() || null,
        name: item.name,
        slug: item.slug,
        sku: item.sku || null,
        image: item.image,
        priceAtPurchase: item.priceAtPurchase,
        quantity: item.quantity,
        selectedVariant: item.selectedVariant || null,
        madeToMeasure: item.madeToMeasure?.enabled ? item.madeToMeasure : null,
        customization: item.customization?.enabled ? item.customization : null,
      })),
      customJacketSnapshot: o.customJacketSnapshot || null,
      affiliateReferralCode: o.affiliateReferralCode || null,
      customerNote: o.customerNote || null,
      adminNotes: o.adminNotes || [],
      timeline: o.timeline || [],
    }));

    return NextResponse.json(
      {
        success: true,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        orders: formattedOrders,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("CRM Orders API GET Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PATCH /api/crm/orders (also available at /api/orders)
 * Updates an order status or adds fulfillment notes from the CRM
 */
export async function PATCH(req) {
  try {
    if (!validateCrmAuth(req)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Invalid or missing CRM API Key." },
        { status: 401, headers: corsHeaders }
      );
    }

    await dbConnect();
    const body = await req.json();
    const { orderNumber, status, trackingNumber, carrier, trackingUrl, adminNote } = body;

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: "Missing required field: orderNumber" },
        { status: 400, headers: corsHeaders }
      );
    }

    const order = await Order.findOne({ orderNumber });
    if (!order) {
      return NextResponse.json(
        { success: false, error: `Order not found with number ${orderNumber}` },
        { status: 404, headers: corsHeaders }
      );
    }

    const oldStatus = order.status;
    const timelineMessages = [];

    // Valid order statuses in Pairo
    const validStatuses = [
      "Pending",
      "Confirmed",
      "Processing",
      "Packed",
      "Shipped",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
      "Refunded",
    ];

    if (status && status !== oldStatus) {
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid status '${status}'. Must be one of: ${validStatuses.join(", ")}`,
          },
          { status: 400, headers: corsHeaders }
        );
      }
      order.status = status;
      timelineMessages.push(`Status changed from '${oldStatus}' to '${status}' via CRM Integration`);
    }

    if (trackingNumber) {
      const trackingMsg = `Carrier: ${carrier || "Standard"} | Tracking: ${trackingNumber}${trackingUrl ? ` (${trackingUrl})` : ""}`;
      timelineMessages.push(trackingMsg);
      if (!order.adminNotes) order.adminNotes = [];
      order.adminNotes.push(trackingMsg);
    }

    if (adminNote) {
      if (!order.adminNotes) order.adminNotes = [];
      order.adminNotes.push(`[CRM Note]: ${adminNote}`);
      timelineMessages.push(`CRM Note: ${adminNote}`);
    }

    // Append to timeline
    for (const msg of timelineMessages) {
      order.timeline.push({
        status: order.status,
        message: msg,
        timestamp: new Date(),
        source: "System",
      });
    }

    await order.save();

    // Trigger internal events for status update
    if (status && status !== oldStatus) {
      pairoEvents.dispatch("ORDER_STATUS_UPDATED", {
        order,
        oldStatus,
        newStatus: status,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: `Order ${orderNumber} successfully updated by CRM.`,
        order: {
          orderNumber: order.orderNumber,
          status: order.status,
          updatedAt: order.updatedAt,
          timeline: order.timeline,
        },
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("CRM Orders API PATCH Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
