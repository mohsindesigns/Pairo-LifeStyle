import mongoose from "mongoose";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Customer from "@/models/Customer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import { getNextOrderNumber } from "@/lib/checkoutFulfillment";
import { resolveAuthoritativePrice } from "@/lib/productPricing";
import pairoEvents from "@/lib/events";
import { buildOrderListQuery, buildOrderCountsPipeline, emptyOrderCounts } from "./orderListQuery";

export async function GET(req) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    const { can } = await import("@/lib/rbac");

    // Security Check
    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(session.user, "orders.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const referral = searchParams.get("referral");
    const affiliateOnly = searchParams.get("affiliateOnly") === "true";
    const trash = searchParams.get("trash") === "true" || searchParams.get("isDeleted") === "true";
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;

    const query = buildOrderListQuery({ status, search, referral, trash, affiliateOnly });

    // Fetch orders with lean() for performance and better serialization
    const [orders, total, countRows] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
      Order.aggregate(buildOrderCountsPipeline(search)),
    ]);

    const counts = { ...emptyOrderCounts(), ...(countRows[0] || {}) };
    delete counts._id;

    return NextResponse.json({
      success: true,
      orders,
      counts,
      pagination: {
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
        currentPage: page
      }
    });

  } catch (error) {
    console.error("Admin Orders Fetch Error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

/**
 * Lets an admin hand-build an order directly (any product/variant/quantity, with
 * a freely editable price per line) — used to gift products or record sales that
 * never went through the customer checkout flow. Unlike customer checkout, there
 * is no promotion engine, no tax, and no shipping-rate lookup involved: the admin
 * is the sole source of truth for pricing on this order.
 */
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "orders.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  const body = await req.json().catch(() => ({}));
  const {
    items,
    customer,
    shippingAddress,
    shippingCost: rawShippingCost,
    paymentStatus,
    adminNote,
    idempotencyKey,
    sendConfirmation = true,
  } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "At least one line item is required" }, { status: 400 });
  }
  if (!shippingAddress?.fullName || !shippingAddress?.street || !shippingAddress?.city || !shippingAddress?.country) {
    return NextResponse.json({ error: "A shipping name, street, city, and country are required" }, { status: 400 });
  }
  if (!customer?.customerId && !customer?.email) {
    return NextResponse.json({ error: "Select an existing customer or provide a guest email" }, { status: 400 });
  }
  if (paymentStatus !== undefined && paymentStatus !== "Paid" && paymentStatus !== "Pending") {
    return NextResponse.json({ error: "paymentStatus must be \"Paid\" or \"Pending\"" }, { status: 400 });
  }
  for (const item of items) {
    if (!mongoose.Types.ObjectId.isValid(item?.productId)) {
      return NextResponse.json({ error: "Every line item needs a valid product" }, { status: 400 });
    }
    if (item.priceOverride !== undefined && item.priceOverride !== null && item.priceOverride !== "") {
      const override = Number(item.priceOverride);
      if (!Number.isFinite(override) || override < 0) {
        return NextResponse.json({ error: "Price cannot be negative" }, { status: 400 });
      }
    }
  }

  const shippingCost = Number.isFinite(Number(rawShippingCost)) ? Math.max(0, Number(rawShippingCost)) : 0;

  // Dedupe a double-click / retried submit the same way customer checkout does — reuse the
  // idempotencyKey the client generated and hand back the existing order instead of creating
  // a second one (with a second stock decrement) for the same submission.
  if (idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey }).lean();
    if (existing) {
      return NextResponse.json({ success: true, order: existing });
    }
  }

  const mongoSession = await mongoose.startSession();
  let newOrder = null;

  try {
    await mongoSession.withTransaction(async () => {
      const orderItems = [];

      for (const item of items) {
        const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
        const product = await Product.findOne({ _id: item.productId, isDeleted: false }).session(mongoSession);
        if (!product) throw new Error(`Product not found: ${item.productId}`);

        const selectedOptions = item.selectedOptions && Object.keys(item.selectedOptions).length > 0
          ? item.selectedOptions
          : null;
        const variantTitle = selectedOptions
          ? (product.attributes || []).map(a => selectedOptions[a.name]).filter(Boolean).join(" / ")
            || Object.values(selectedOptions).join(" / ")
          : null;

        if (product.manageStock) {
          const invRes = await Product.findOneAndUpdate(
            { _id: product._id, stock: { $gte: quantity } },
            { $inc: { stock: -quantity } },
            { session: mongoSession, new: true }
          );
          if (!invRes) throw new Error(`Insufficient stock for ${product.name}`);
        }

        const priceOverride = item.priceOverride !== undefined && item.priceOverride !== null && item.priceOverride !== ""
          ? Number(item.priceOverride)
          : null;
        const priceAtPurchase = priceOverride !== null && Number.isFinite(priceOverride)
          ? priceOverride
          : resolveAuthoritativePrice(product, { selectedOptions });

        orderItems.push({
          productId: product._id,
          name: product.name,
          sku: product.sku,
          image: product.images?.[0] || product.image,
          priceAtPurchase,
          quantity,
          ...(variantTitle ? { selectedVariant: { title: variantTitle, options: selectedOptions } } : {}),
          ...(item.customization?.enabled ? { customization: item.customization } : {}),
        });
      }

      const subtotal = orderItems.reduce((sum, item) => sum + item.priceAtPurchase * item.quantity, 0);
      const total = subtotal + shippingCost;

      const orderNumber = await getNextOrderNumber(mongoSession);

      let customerInfo = { userId: null, email: customer?.email || "", isGuest: true };
      if (customer?.customerId) {
        const existingCustomer = await Customer.findById(customer.customerId).session(mongoSession);
        if (!existingCustomer || existingCustomer.isDeleted) throw new Error("Selected customer not found");
        customerInfo = { userId: existingCustomer._id, email: existingCustomer.email, isGuest: false };
      }

      const isPaid = paymentStatus !== "Pending"; // whitelisted to "Paid"/"Pending"/undefined above; undefined defaults to Paid
      const staffName = session.user.name || session.user.email || "Admin";

      const orderDoc = {
        orderNumber,
        idempotencyKey: idempotencyKey || undefined,
        status: "Confirmed",
        timeline: [{
          status: "Confirmed",
          message: `Order created manually by admin (${staffName}).`,
          source: "Admin",
        }],
        items: orderItems,
        financials: {
          subtotal,
          shippingCost,
          tax: 0,
          discountTotal: 0,
          total,
          currency: "USD",
        },
        payment: {
          method: "Manual/Gift",
          status: isPaid ? "Paid" : "Pending",
          paidAt: isPaid ? new Date() : null,
        },
        customer: customerInfo,
        shippingAddress,
        customerNote: adminNote || "",
      };

      const [created] = await Order.create([orderDoc], { session: mongoSession });
      newOrder = created;
    });
  } catch (err) {
    console.error("[Admin Order Create Error]", err);
    return NextResponse.json({ error: err.message || "Failed to create order" }, { status: 400 });
  } finally {
    await mongoSession.endSession();
  }

  if (newOrder && sendConfirmation) {
    pairoEvents.dispatch("ORDER_CREATED", { order: newOrder, origin: "admin" });
  }

  return NextResponse.json({ success: true, order: newOrder });
}

export async function DELETE(req) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    const { can } = await import("@/lib/rbac");

    // Security Check
    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(session.user, "orders.update") && !can(session.user, "orders.edit") && !can(session.user, "orders.delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const permanent = searchParams.get("permanent") === "true";

    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const order = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Default: move to Trash (soft delete). The order, its payment record and any
    // affiliate commission are left untouched so it can be restored later.
    if (!permanent) {
      if (!order.isDeleted) {
        await Order.updateOne({ _id: order._id }, { $set: { isDeleted: true, deletedAt: new Date() } });
        pairoEvents.dispatch("ORDER_DELETED", { order: await Order.findById(order._id), origin: "admin" });
      }
      return NextResponse.json({ success: true, message: "Order moved to trash" });
    }

    // Permanent delete is only allowed from the Trash, so a single click can never
    // wipe out a live order.
    if (!order.isDeleted) {
      return NextResponse.json({ error: "Move the order to the Trash before deleting it permanently." }, { status: 409 });
    }

    // Permanent delete: cancel associated commissions first
    try {
      const { CommissionEngine } = await import("@/lib/affiliate/CommissionEngine");
      await CommissionEngine.cancelCommission(order._id);
    } catch (e) {
      console.error("[Order Delete Affiliate Trigger Error]", e);
    }

    await Order.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: "Order deleted permanently" });
  } catch (error) {
    console.error("Admin Order Delete Error:", error);
    return NextResponse.json({ error: "Delete failed: " + error.message }, { status: 500 });
  }
}

/**
 * Restore an order from the Trash: PUT { id, isDeleted: false }.
 */
export async function PUT(req) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);

    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(session.user, "orders.update") && !can(session.user, "orders.edit") && !can(session.user, "orders.delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { id, isDeleted } = body || {};

    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }
    if (isDeleted !== false) {
      return NextResponse.json({ error: "Only restoring (isDeleted: false) is supported" }, { status: 400 });
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { $set: { isDeleted: false, deletedAt: null } },
      { new: true }
    ).lean();
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    pairoEvents.dispatch("ORDER_RESTORED", { order, origin: "admin" });
    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("Admin Order Restore Error:", error);
    return NextResponse.json({ error: "Restore failed: " + error.message }, { status: 500 });
  }
}
