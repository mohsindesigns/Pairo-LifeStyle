import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { crmCorsHeaders, validateCrmAuth, crmUnauthorized, crmJson, crmError } from "@/lib/crmAuth";
import { formatCrmOrder } from "@/lib/crmOrders";
import { createCrmOrder, patchCrmOrder } from "@/lib/crmOrderActions";

/** CORS preflight */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: crmCorsHeaders });
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /api/crm/orders (also available at /api/orders)
 * List orders with pagination, status filtering and incremental sync (?since=). ?includeDeleted=true also returns orders
 * that were moved to the Trash (each has isDeleted: true), so the CRM can mirror deletions.
 */
export async function GET(req) {
  try {
    if (!validateCrmAuth(req)) return crmUnauthorized();
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const status = searchParams.get("status");
    const since = searchParams.get("since");
    const orderNumber = searchParams.get("orderNumber");
    const email = searchParams.get("email");

    // Orders an admin moved to the Trash are treated as gone, unless the CRM asks for them.
    const query = searchParams.get("includeDeleted") === "true" ? {} : { isDeleted: { $ne: true } };

    if (status && status !== "all") query.status = status;
    if (orderNumber) query.orderNumber = { $regex: escapeRegex(orderNumber.trim()), $options: "i" };
    if (email) query["customer.email"] = { $regex: escapeRegex(email.trim()), $options: "i" };
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) query.$or = [{ updatedAt: { $gte: sinceDate } }, { createdAt: { $gte: sinceDate } }];
    }

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(query),
    ]);

    return crmJson({
      success: true,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      orders: orders.map(formatCrmOrder),
    });
  } catch (err) {
    console.error("CRM Orders API GET Error:", err);
    return crmError(500, "Internal server error");
  }
}

/**
 * POST /api/crm/orders: create an order from the CRM (see createCrmOrder for the body). Safe to retry: the same
 * externalId returns the existing order with duplicate: true.
 */
export async function POST(req) {
  try {
    if (!validateCrmAuth(req)) return crmUnauthorized();
    await dbConnect();
    let body;
    try { body = await req.json(); } catch { return crmError(400, "The request body must be valid JSON."); }
    const { status, body: out } = await createCrmOrder(body);
    return crmJson(out, status);
  } catch (err) {
    console.error("CRM Orders API POST Error:", err);
    return crmError(500, "Internal server error");
  }
}

/**
 * PATCH /api/crm/orders (also at /api/orders): update an order, with its orderNumber in the body. The same update is
 * available at PATCH /api/crm/orders/{orderNumber}.
 */
export async function PATCH(req) {
  try {
    if (!validateCrmAuth(req)) return crmUnauthorized();
    await dbConnect();
    let body;
    try { body = await req.json(); } catch { return crmError(400, "The request body must be valid JSON."); }
    const { status, body: out } = await patchCrmOrder(body?.orderNumber, body);
    return crmJson(out, status);
  } catch (err) {
    console.error("CRM Orders API PATCH Error:", err);
    return crmError(500, "Internal server error");
  }
}
