// Shared logic of the CRM order API (src/app/api/crm/**): how an order is shown to the CRM, and what changing its status
// does on our side (stock, coupon usage, affiliate commissions), kept identical to the admin dashboard's status change.

import mongoose from "mongoose";
import Product from "@/models/Product";
import { CommissionEngine } from "@/lib/affiliate/CommissionEngine";
import { reconcilePromotionUsage, isUsageReleasingTransition, isUsageRestoringTransition } from "@/lib/promotionUsageReconciliation";

export const ORDER_STATUSES = ["Pending", "Confirmed", "Processing", "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Refunded"];
export const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded", "Partially Refunded"];
export const CRM_PAYMENT_METHODS = ["Manual/Gift", "Cash on Delivery", "Card"];
export const ADDRESS_FIELDS = ["fullName", "street", "city", "state", "zip", "country", "phone"];

/** The order as the CRM sees it (list, single, create and patch responses all use this shape). */
export function formatCrmOrder(o) {
  const obj = typeof o.toObject === "function" ? o.toObject() : o;
  return {
    id: obj._id?.toString(),
    orderNumber: obj.orderNumber,
    status: obj.status,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    isDeleted: Boolean(obj.isDeleted),
    deletedAt: obj.deletedAt || null,
    customer: {
      userId: obj.customer?.userId?.toString() || null,
      email: obj.customer?.email || "",
      isGuest: Boolean(obj.customer?.isGuest),
      ipAddress: obj.customer?.ipAddress || "",
    },
    shippingAddress: obj.shippingAddress || {},
    financials: {
      subtotal: obj.financials?.subtotal || 0,
      shippingCost: obj.financials?.shippingCost || 0,
      tax: obj.financials?.tax || 0,
      discountTotal: obj.financials?.discountTotal || 0,
      total: obj.financials?.total || 0,
      currency: obj.financials?.currency || "USD",
      promoCode: obj.financials?.promoCode || null,
      appliedPromotions: obj.financials?.appliedPromotions || [],
    },
    payment: {
      method: obj.payment?.method || "Cash on Delivery",
      status: obj.payment?.status || "Pending",
      provider: obj.payment?.provider || null,
      stripePaymentIntentId: obj.payment?.stripePaymentIntentId || null,
      paidAt: obj.payment?.paidAt || null,
      refundedAmount: obj.payment?.refundedAmount || 0,
    },
    paymentStatus: obj.payment?.status || "Pending",
    tracking: {
      number: obj.tracking?.number || null,
      carrier: obj.tracking?.carrier || null,
      url: obj.tracking?.url || null,
      updatedAt: obj.tracking?.updatedAt || null,
    },
    trackingNumber: obj.tracking?.number || null,
    carrier: obj.tracking?.carrier || null,
    trackingUrl: obj.tracking?.url || null,
    items: (obj.items || []).map((item) => ({
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
    customJacketSnapshot: obj.customJacketSnapshot || null,
    affiliateReferralCode: obj.affiliateReferralCode || null,
    customerNote: obj.customerNote || null,
    adminNotes: obj.adminNotes || [],
    timeline: obj.timeline || [],
  };
}

const variantOf = (item) => (item.selectedVariant?.title && item.selectedVariant.title !== "Standard" ? item.selectedVariant.title : null);

/** Takes each line's quantity out of stock (guarded, so stock never goes below zero). Throws if a line is short. */
export async function deductOrderStock(order) {
  const done = [];
  try {
    for (const item of order.items || []) {
      const qty = Number(item.quantity) || 0;
      if (!item.productId || qty <= 0) continue;
      const product = await Product.findById(item.productId).select("manageStock").lean();
      if (!product?.manageStock) continue;
      const ok = await Product.findOneAndUpdate({ _id: item.productId, stock: { $gte: qty } }, { $inc: { stock: -qty } });
      if (!ok) throw Object.assign(new Error(`Insufficient stock for ${item.name}`), { code: "INSUFFICIENT_STOCK" });
      const variant = variantOf(item);
      if (variant) await Product.updateOne({ _id: item.productId, "variantCombinations.title": variant }, { $inc: { "variantCombinations.$.stock": -qty } });
      done.push(item);
    }
  } catch (err) {
    await restockLines(done); // put back what was already taken
    throw err;
  }
}

export async function restockLines(items) {
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    if (!item.productId || qty <= 0) continue;
    const variant = variantOf(item);
    if (variant) {
      await Product.updateOne({ _id: item.productId, "variantCombinations.title": variant }, { $inc: { "variantCombinations.$.stock": qty, stock: qty } });
    } else {
      await Product.updateOne({ _id: item.productId }, { $inc: { stock: qty } });
    }
  }
}

/**
 * Everything that must happen on our side when an order's status changes, the same as the admin dashboard does:
 * stock is put back once when an order is cancelled (never twice, never for orders that never took stock), coupon usage is
 * released or restored, and affiliate commissions are approved / cancelled / reversed.
 * Returns an { error } object (409) when un-cancelling needs stock that is no longer there, otherwise {}.
 */
export async function applyStatusChange(order, oldStatus, newStatus) {
  if (!newStatus || newStatus === oldStatus) return {};

  const wasInactive = oldStatus === "Cancelled" || oldStatus === "Refunded";
  const takesStock = order.stockDeducted !== false;

  if (newStatus === "Cancelled" && !wasInactive && takesStock && !order.stockRestockedAt) {
    await restockLines(order.items || []);
    order.stockRestockedAt = new Date();
  } else if (wasInactive && newStatus !== "Cancelled" && newStatus !== "Refunded" && order.stockRestockedAt) {
    try {
      await deductOrderStock(order);
    } catch (err) {
      if (err.code === "INSUFFICIENT_STOCK") return { error: `${err.message}: the order cannot be re-activated until stock is available.` };
      throw err;
    }
    order.stockRestockedAt = null;
  }
  return {};
}

/** The side effects that run after the status change is saved (coupon usage, affiliate commissions). Never throws. */
export async function afterStatusSaved(order, oldStatus, newStatus) {
  if (!newStatus || newStatus === oldStatus) return;
  try {
    if (isUsageReleasingTransition(oldStatus, newStatus)) await reconcilePromotionUsage(order, -1);
    else if (isUsageRestoringTransition(oldStatus, newStatus)) await reconcilePromotionUsage(order, 1);
  } catch (e) {
    console.error("[CRM Status Promotion Usage Error]", e);
  }
  try {
    if (newStatus === "Delivered") {
      const commissions = await mongoose.model("AffiliateCommission").find({ orderId: order._id, status: "Pending" });
      for (const comm of commissions) await CommissionEngine.approveCommission(comm._id);
    } else if (newStatus === "Cancelled") {
      await CommissionEngine.cancelCommission(order._id);
    } else if (newStatus === "Refunded") {
      await CommissionEngine.reverseCommission(order._id, "Refunded");
    }
  } catch (e) {
    console.error("[CRM Status Affiliate Error]", e);
  }
}
