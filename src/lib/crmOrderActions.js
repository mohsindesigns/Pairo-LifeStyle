// The write side of the CRM order API: create, patch and delete (soft) an order exactly as the dashboard would, and tell the
// CRM about it through the webhook (origin "crm"). Each function returns { status, body } for the route to send.

import mongoose from "mongoose";
import Order from "@/models/Order";
import Product from "@/models/Product";
import pairoEvents from "@/lib/events";
import { getNextOrderNumber } from "@/lib/orderNumber";
import { resolveAuthoritativePrice } from "@/lib/productPricing";
import {
  ORDER_STATUSES, PAYMENT_STATUSES, CRM_PAYMENT_METHODS, ADDRESS_FIELDS,
  formatCrmOrder, deductOrderStock, restockLines, applyStatusChange, afterStatusSaved,
} from "@/lib/crmOrders";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const fail = (status, error, extra = {}) => ({ status, body: { success: false, error, ...extra } });
const text = (v, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);
const send = (event, order, extra = {}) => pairoEvents.dispatch(event, { order, origin: "crm", ...extra });

// ───────────────────────────── create ─────────────────────────────

async function findProduct(line) {
  const alive = { isDeleted: { $ne: true } };
  if (line.productId !== undefined && line.productId !== null && line.productId !== "") {
    if (!mongoose.isValidObjectId(line.productId)) return { error: "productId is not a valid id" };
    const product = await Product.findOne({ _id: line.productId, ...alive });
    return product ? { product } : { error: `Product not found: ${line.productId}` };
  }
  const sku = text(line.sku, 100);
  if (!sku) return { error: "Each item needs a productId or a sku" };
  const byProduct = await Product.findOne({ sku, ...alive });
  if (byProduct) return { product: byProduct };
  const byVariant = await Product.findOne({ "variantCombinations.sku": sku, ...alive });
  if (byVariant) return { product: byVariant, variant: byVariant.variantCombinations.find((v) => v.sku === sku) };
  return { error: `No product or variant has the sku "${sku}"` };
}

export async function createCrmOrder(body) {
  if (!isObject(body)) return fail(400, "The request body must be JSON.");
  const externalId = text(body.externalId, 100);
  if (!externalId) return fail(400, "externalId is required (your own unique id for this order; it makes retries safe).", { field: "externalId" });
  const idempotencyKey = `crm-${externalId}`;

  const existing = await Order.findOne({ idempotencyKey });
  if (existing) return { status: 200, body: { success: true, duplicate: true, order: formatCrmOrder(existing) } };

  const email = text(body.customer?.email, 200).toLowerCase();
  if (!EMAIL.test(email)) return fail(400, "customer.email must be a valid email address.", { field: "customer.email" });

  const address = isObject(body.shippingAddress) ? body.shippingAddress : {};
  const shippingAddress = {};
  for (const key of ADDRESS_FIELDS) if (text(address[key])) shippingAddress[key] = text(address[key]);
  for (const key of ["fullName", "street", "city", "country"]) {
    if (!shippingAddress[key]) return fail(400, `shippingAddress.${key} is required.`, { field: `shippingAddress.${key}` });
  }
  if (!shippingAddress.phone && text(body.customer?.phone)) shippingAddress.phone = text(body.customer.phone);

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) return fail(400, "items must list 1 to 100 products.", { field: "items" });

  const status = body.status === undefined ? "Confirmed" : body.status;
  if (!ORDER_STATUSES.includes(status) || status === "Cancelled" || status === "Refunded") {
    return fail(400, `Invalid status "${status}". A new order can start as: ${ORDER_STATUSES.filter((s) => s !== "Cancelled" && s !== "Refunded").join(", ")}.`, { field: "status" });
  }
  const shippingCost = body.shippingCost === undefined ? 0 : Number(body.shippingCost);
  if (!Number.isFinite(shippingCost) || shippingCost < 0) return fail(400, "shippingCost must be a number of 0 or more.", { field: "shippingCost" });

  const method = body.payment?.method === undefined ? "Manual/Gift" : body.payment.method;
  const payStatus = body.payment?.status === undefined ? "Paid" : body.payment.status;
  if (!CRM_PAYMENT_METHODS.includes(method)) return fail(400, `Invalid payment.method. Allowed: ${CRM_PAYMENT_METHODS.join(", ")}.`, { field: "payment.method" });
  if (!["Paid", "Pending"].includes(payStatus)) return fail(400, "Invalid payment.status. Allowed: Paid, Pending.", { field: "payment.status" });

  const orderItems = [];
  for (let i = 0; i < body.items.length; i++) {
    const line = body.items[i];
    if (!isObject(line)) return fail(400, `items[${i}] must be an object.`, { field: `items[${i}]` });
    const quantity = line.quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) return fail(400, `items[${i}].quantity must be a whole number from 1 to 1000.`, { field: `items[${i}].quantity` });
    let override = null;
    if (line.priceOverride !== undefined && line.priceOverride !== null) {
      override = Number(line.priceOverride);
      if (!Number.isFinite(override) || override < 0) return fail(400, `items[${i}].priceOverride must be 0 or more.`, { field: `items[${i}].priceOverride` });
    }
    const { product, variant, error } = await findProduct(line);
    if (error) return fail(400, `items[${i}]: ${error}`, { field: `items[${i}]` });
    if (product.status === "Draft") return fail(400, `items[${i}]: "${product.name}" is a draft product and cannot be ordered.`, { field: `items[${i}]` });

    const selectedOptions = isObject(line.selectedOptions) && Object.keys(line.selectedOptions).length ? line.selectedOptions : null;
    const variantTitle = variant?.title || (selectedOptions
      ? (product.attributes || []).map((a) => selectedOptions[a.name]).filter(Boolean).join(" / ") || Object.values(selectedOptions).join(" / ")
      : null);
    const listPrice = variant && variant.price !== undefined && variant.price !== null ? variant.price : resolveAuthoritativePrice(product, { selectedOptions });
    orderItems.push({
      productId: product._id,
      name: product.name,
      slug: product.slug,
      sku: variant?.sku || product.sku,
      image: product.images?.[0] || product.image,
      priceAtPurchase: override !== null ? override : listPrice,
      quantity,
      ...(variantTitle ? { selectedVariant: { title: variantTitle, options: selectedOptions } } : {}),
    });
  }

  try {
    await deductOrderStock({ items: orderItems });
  } catch (err) {
    if (err.code === "INSUFFICIENT_STOCK") return fail(409, err.message, { code: "insufficient_stock" });
    throw err;
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.priceAtPurchase * item.quantity, 0);
  let order;
  try {
    const orderNumber = await getNextOrderNumber();
    order = await Order.create({
      orderNumber,
      idempotencyKey,
      status,
      items: orderItems,
      financials: { subtotal, shippingCost, tax: 0, discountTotal: 0, total: subtotal + shippingCost, currency: "USD" },
      payment: { method, status: payStatus, paidAt: payStatus === "Paid" ? new Date() : null },
      customer: { userId: null, email, isGuest: true },
      shippingAddress,
      customerNote: text(body.note, 1000),
      timeline: [{ status, message: "Order created from CRM", source: "System" }],
    });
  } catch (err) {
    await restockLines(orderItems); // nothing was created: put the stock back
    if (err?.code === 11000) {
      const again = await Order.findOne({ idempotencyKey });
      if (again) return { status: 200, body: { success: true, duplicate: true, order: formatCrmOrder(again) } };
    }
    throw err;
  }

  pairoEvents.dispatch("ORDER_CREATED", { order, origin: "crm", skipEmails: body.sendConfirmation !== true });
  return { status: 201, body: { success: true, duplicate: false, order: formatCrmOrder(order) } };
}

// ───────────────────────────── patch ─────────────────────────────

export async function patchCrmOrder(orderNumber, body) {
  if (!orderNumber) return fail(400, "Missing required field: orderNumber");
  if (!isObject(body)) return fail(400, "The request body must be JSON.");
  const { status, trackingNumber, carrier, trackingUrl, adminNote, paymentStatus, shippingAddress, customerNote, restore, expectedUpdatedAt } = body;

  if (status !== undefined && !ORDER_STATUSES.includes(status)) return fail(400, `Invalid status '${status}'. Must be one of: ${ORDER_STATUSES.join(", ")}`, { field: "status" });
  if (paymentStatus !== undefined && !PAYMENT_STATUSES.includes(paymentStatus)) return fail(400, `Invalid paymentStatus '${paymentStatus}'. Must be one of: ${PAYMENT_STATUSES.join(", ")}`, { field: "paymentStatus" });
  if (shippingAddress !== undefined && !isObject(shippingAddress)) return fail(400, "shippingAddress must be an object.", { field: "shippingAddress" });
  if (expectedUpdatedAt !== undefined && Number.isNaN(new Date(expectedUpdatedAt).getTime())) return fail(400, "expectedUpdatedAt must be an ISO date.", { field: "expectedUpdatedAt" });
  if (trackingUrl !== undefined && trackingUrl !== null && !/^https?:\/\//i.test(String(trackingUrl))) return fail(400, "trackingUrl must start with http:// or https://", { field: "trackingUrl" });

  const order = await Order.findOne({ orderNumber });
  if (!order || (order.isDeleted && restore !== true)) return fail(404, `Order not found with number ${orderNumber}`);

  if (expectedUpdatedAt !== undefined && new Date(expectedUpdatedAt).getTime() !== new Date(order.updatedAt).getTime()) {
    return { status: 409, body: { success: false, error: "conflict", message: "The order changed since you read it. Re-read it and try again.", currentUpdatedAt: order.updatedAt } };
  }

  const changed = [];
  const timeline = [];
  const oldStatus = order.status;
  const oldPayment = order.payment?.status;

  if (restore === true && order.isDeleted) {
    order.isDeleted = false;
    order.deletedAt = null;
    changed.push("restore");
    timeline.push("Order restored from the Trash via CRM");
  }

  if (status !== undefined && status !== oldStatus) {
    const problem = await applyStatusChange(order, oldStatus, status);
    if (problem.error) return fail(409, problem.error, { code: "insufficient_stock" });
    order.status = status;
    changed.push("status");
    timeline.push(`Status changed from '${oldStatus}' to '${status}' via CRM Integration`);
  }

  if (trackingNumber !== undefined || carrier !== undefined || trackingUrl !== undefined) {
    const t = order.tracking || {};
    order.tracking = {
      number: trackingNumber !== undefined ? text(String(trackingNumber ?? ""), 200) || null : t.number || null,
      carrier: carrier !== undefined ? text(String(carrier ?? ""), 100) || null : t.carrier || null,
      url: trackingUrl !== undefined ? trackingUrl || null : t.url || null,
      updatedAt: new Date(),
    };
    changed.push("tracking");
    if (trackingNumber) {
      const msg = `Carrier: ${carrier || "Standard"} | Tracking: ${trackingNumber}${trackingUrl ? ` (${trackingUrl})` : ""}`;
      timeline.push(msg);
      if (!order.adminNotes) order.adminNotes = [];
      order.adminNotes.push(msg);
    }
  }

  if (adminNote) {
    if (!order.adminNotes) order.adminNotes = [];
    order.adminNotes.push(`[CRM Note]: ${adminNote}`);
    timeline.push(`CRM Note: ${adminNote}`);
    changed.push("adminNote");
  }

  if (paymentStatus !== undefined && paymentStatus !== oldPayment) {
    if (!order.payment) order.payment = {};
    order.payment.status = paymentStatus;
    if (paymentStatus === "Paid" && !order.payment.paidAt) order.payment.paidAt = new Date();
    changed.push("paymentStatus");
    timeline.push(`Payment status changed from '${oldPayment || "Pending"}' to '${paymentStatus}' via CRM Integration`);
  }

  if (shippingAddress !== undefined) {
    let any = false;
    if (!order.shippingAddress) order.shippingAddress = {};
    for (const key of ADDRESS_FIELDS) {
      if (typeof shippingAddress[key] === "string" && text(shippingAddress[key]) !== (order.shippingAddress[key] || "")) {
        order.shippingAddress[key] = text(shippingAddress[key]);
        any = true;
      }
    }
    if (any) { changed.push("shippingAddress"); timeline.push("Shipping address updated via CRM Integration"); }
  }

  if (customerNote !== undefined && text(String(customerNote ?? ""), 1000) !== (order.customerNote || "")) {
    order.customerNote = text(String(customerNote ?? ""), 1000);
    changed.push("customerNote");
  }

  for (const msg of timeline) {
    order.timeline.push({ status: order.status, message: msg, timestamp: new Date(), source: "System" });
  }
  if (changed.length) await order.save();

  if (changed.length) {
    const statusChanged = changed.includes("status");
    if (statusChanged) send("ORDER_STATUS_UPDATED", order, { oldStatus, newStatus: order.status });
    if (changed.includes("paymentStatus")) send("ORDER_PAYMENT_UPDATED", order, { oldPaymentStatus: oldPayment, newPaymentStatus: order.payment.status });
    if (changed.some((c) => ["tracking", "shippingAddress", "customerNote", "adminNote"].includes(c))) send("ORDER_UPDATED", order, { fields: changed });
    if (changed.includes("restore")) send("ORDER_RESTORED", order);
    if (statusChanged) await afterStatusSaved(order, oldStatus, order.status);
  }

  return { status: 200, body: { success: true, message: changed.length ? `Order ${orderNumber} successfully updated by CRM.` : `Order ${orderNumber} was already up to date.`, changed, order: formatCrmOrder(order) } };
}

// ───────────────────────────── delete (to the Trash only) ─────────────────────────────

export async function deleteCrmOrder(orderNumber) {
  const order = await Order.findOne({ orderNumber });
  if (!order) return fail(404, `Order not found with number ${orderNumber}`);
  if (order.isDeleted) return { status: 200, body: { success: true, alreadyDeleted: true, order: formatCrmOrder(order) } };
  order.isDeleted = true;
  order.deletedAt = new Date();
  order.timeline.push({ status: order.status, message: "Order moved to the Trash via CRM Integration", timestamp: new Date(), source: "System" });
  await order.save();
  send("ORDER_DELETED", order);
  return { status: 200, body: { success: true, alreadyDeleted: false, message: "Order moved to the Trash. It can be restored with PATCH { restore: true }.", order: formatCrmOrder(order) } };
}
