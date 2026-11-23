import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import mongoose from "mongoose";
import { CommissionEngine } from "@/lib/affiliate/CommissionEngine";
import { reconcilePaymentLinkOrder } from "@/lib/stripeFulfillment";
import { reconcilePromotionUsage, isUsageReleasingTransition, isUsageRestoringTransition } from "@/lib/promotionUsageReconciliation";
import pairoEvents from "@/lib/events";
import { resolveIpLocation } from "@/lib/geoIp";
import { orderLookupQuery } from "@/lib/orderLookup";
import { orderStatusChangeError } from "@/lib/order-status-flow";

export async function GET(req, { params }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);

    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(session.user, "orders.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    let order = await orderLookupQuery(id).populate("affiliateId", "name email affiliateId referralCode");
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Self-heal: if this is a Custom Order with an unpaid Stripe payment link,
    // check Stripe directly in case the checkout.session.completed webhook
    // never arrived. No-op once the order is Paid or has no payment link.
    order = await reconcilePaymentLinkOrder(order, null);

    // Auto-resolve pinpoint IP geolocation if order has an IP address but no stored location yet
    if (order.customer?.ipAddress && order.customer.ipAddress !== "unknown" && (!order.customer?.ipLocation || !order.customer?.ipLocation?.city)) {
      try {
        const location = await resolveIpLocation(order.customer.ipAddress);
        if (location) {
          order.customer.ipLocation = location;
          await Order.updateOne({ _id: order._id }, { $set: { "customer.ipLocation": location } });
        }
      } catch {
        // Non-blocking
      }
    }

    return NextResponse.json({ success: true, order });

  } catch (error) {
    return NextResponse.json({ error: "Fetch error" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);

    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // "orders.update" is the permission roles can actually be given (the role editor offers view / create / update /
    // refund) and what every other order action uses. This route asked for "orders.edit", which no role can hold, so
    // only a Super Admin could change an order's status or add a note.
    if (!can(session.user, "orders.update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { status, adminNotes, timelineMessage } = await req.json();
    const order = await orderLookupQuery(id);

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const oldStatus = order.status;
    
    const transitionError = orderStatusChangeError(oldStatus, status);
    if (transitionError) {
      return NextResponse.json({ error: transitionError }, { status: 409 });
    }

    // 1. If status is changing to Cancelled, revert stock ONLY if it wasn't already cancelled
    if (status === "Cancelled" && oldStatus !== "Cancelled" && order.stockDeducted !== false) {
      order.stockRestockedAt = new Date();
      for (const item of order.items) {
        if (item.selectedVariant?.title && item.selectedVariant.title !== "Standard") {
           await Product.updateOne(
              { _id: item.productId, "variantCombinations.title": item.selectedVariant.title },
              { $inc: { "variantCombinations.$.stock": item.quantity, "stock": item.quantity } }
           );
        } else {
           await Product.updateOne(
              { _id: item.productId },
              { $inc: { stock: item.quantity } }
           );
        }
      }
    }

    // 2. Update Order
    if (status) order.status = status;
    if (adminNotes !== undefined) order.adminNotes = adminNotes;
    
    // 3. Add to Timeline
    if (status && status !== oldStatus) {
      order.timeline.push({
        status: status,
        message: timelineMessage || `Order status updated from ${oldStatus} to ${status}.`,
        source: "Admin",
        adminUser: session.user.id
      });
    } else if (timelineMessage) {
      order.timeline.push({
        status: order.status,
        message: timelineMessage,
        source: "Admin",
        adminUser: session.user.id
      });
    }

    await order.save();

    // Trigger internal event for real-time CRM webhook and listener sync
    if (adminNotes !== undefined) {
      pairoEvents.dispatch("ORDER_UPDATED", { order, origin: "admin", fields: ["adminNote"] });
    }
    if (status && status !== oldStatus) {
      try {
        pairoEvents.dispatch("ORDER_STATUS_UPDATED", {
          order,
          oldStatus,
          newStatus: status,
          origin: "admin",
        });
      } catch (evErr) {
        console.error("[Order Status Event Dispatch Error]", evErr);
      }
    }

    // Release/restore any usage-limit "slots" this order's promo codes consumed
    // when it moves into/out of Cancelled or Refunded.
    if (status && status !== oldStatus) {
      try {
        if (isUsageReleasingTransition(oldStatus, status)) {
          await reconcilePromotionUsage(order, -1);
        } else if (isUsageRestoringTransition(oldStatus, status)) {
          await reconcilePromotionUsage(order, 1);
        }
      } catch (e) {
        console.error("[Order Status Promotion Usage Reconciliation Error]", e);
      }
    }

    // Commission Engine Lifecycle Triggers
    if (status && status !== oldStatus) {
      try {
        if (status === "Delivered") {
          // Find all pending commissions for this order and approve them
          const commissions = await mongoose.model("AffiliateCommission").find({ orderId: order._id, status: "Pending" });
          for (const comm of commissions) {
            await CommissionEngine.approveCommission(comm._id);
          }
        } else if (status === "Cancelled") {
          // Cancel commissions
          await CommissionEngine.cancelCommission(order._id);
        } else if (status === "Refunded") {
          // Reverse commissions
          await CommissionEngine.reverseCommission(order._id, "Refunded");
        }
      } catch (e) {
        console.error("[Order Status Affiliate Trigger Error]", e);
      }
    }

    return NextResponse.json({ success: true, order });

  } catch (error) {
    console.error("Order Update Error:", error);
    return NextResponse.json({ error: "Update failed: " + error.message }, { status: 500 });
  }
}
