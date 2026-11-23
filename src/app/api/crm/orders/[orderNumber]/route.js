import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { crmCorsHeaders, validateCrmAuth, crmUnauthorized, crmJson, crmError } from "@/lib/crmAuth";
import { formatCrmOrder } from "@/lib/crmOrders";
import { patchCrmOrder, deleteCrmOrder } from "@/lib/crmOrderActions";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: crmCorsHeaders });
}

const numberOf = async (ctx) => decodeURIComponent((await ctx.params).orderNumber || "");

/** GET /api/crm/orders/{orderNumber}: one order (trashed orders are returned too, with isDeleted: true). */
export async function GET(req, ctx) {
  try {
    if (!validateCrmAuth(req)) return crmUnauthorized();
    await dbConnect();
    const orderNumber = await numberOf(ctx);
    const order = await Order.findOne({ orderNumber }).lean();
    if (!order) return crmError(404, `Order not found with number ${orderNumber}`);
    return crmJson({ success: true, order: formatCrmOrder(order) });
  } catch (err) {
    console.error("CRM Order GET Error:", err);
    return crmError(500, "Internal server error");
  }
}

/** PATCH /api/crm/orders/{orderNumber}: change status, tracking, payment status, address, notes, or restore from the Trash. */
export async function PATCH(req, ctx) {
  try {
    if (!validateCrmAuth(req)) return crmUnauthorized();
    await dbConnect();
    let body;
    try { body = await req.json(); } catch { return crmError(400, "The request body must be valid JSON."); }
    const { status, body: out } = await patchCrmOrder(await numberOf(ctx), body);
    return crmJson(out, status);
  } catch (err) {
    console.error("CRM Order PATCH Error:", err);
    return crmError(500, "Internal server error");
  }
}

/** DELETE /api/crm/orders/{orderNumber}: moves the order to the Trash (never removes it for good). Safe to repeat. */
export async function DELETE(req, ctx) {
  try {
    if (!validateCrmAuth(req)) return crmUnauthorized();
    await dbConnect();
    const { status, body } = await deleteCrmOrder(await numberOf(ctx));
    return crmJson(body, status);
  } catch (err) {
    console.error("CRM Order DELETE Error:", err);
    return crmError(500, "Internal server error");
  }
}
