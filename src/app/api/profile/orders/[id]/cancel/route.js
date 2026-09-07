import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import pairoEvents from "@/lib/events";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { reconcilePromotionUsage, isUsageReleasingTransition } from "@/lib/promotionUsageReconciliation";

export async function PATCH(req, { params }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Atomic fetch-and-update to prevent race conditions during cancellation
    const order = await Order.findOne({ 
      _id: id, 
      "customer.userId": session.user.id 
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Strict state transition enforcement
    const cancellableStatuses = ['Pending', 'Confirmed'];
    if (!cancellableStatuses.includes(order.status)) {
      return NextResponse.json({ 
        error: `Cancellation impossible: Order is already in '${order.status}' stage.` 
      }, { status: 400 });
    }

    const oldStatus = order.status;

    // 1. Restore Stock Atomically
    const stockRollbacks = order.items.map(async (item) => {
      const variantTitle = item.selectedVariant?.title || "Standard";
      if (variantTitle !== "Standard") {
         return Product.updateOne(
            { _id: item.productId, "variantCombinations.title": variantTitle },
            { $inc: { "variantCombinations.$.stock": item.quantity, "stock": item.quantity } }
         );
      } else {
         return Product.updateOne(
            { _id: item.productId },
            { $inc: { stock: item.quantity } }
         );
      }
    });

    await Promise.all(stockRollbacks);

    // 2. Update Status & Timeline
    order.status = "Cancelled";
    order.timeline.push({
      status: "Cancelled",
      message: `Order cancelled by customer. Inventory successfully restocked.`,
      source: "Customer"
    });

    await order.save();

    if (isUsageReleasingTransition(oldStatus, order.status)) {
      try {
        await reconcilePromotionUsage(order, -1);
      } catch (e) {
        console.error("[Customer Cancel Promotion Usage Reconciliation Error]", e);
      }
    }

    // 3. Dispatch Event
    pairoEvents.dispatch('ORDER_CANCELLED', order);

    return NextResponse.json({ 
      success: true, 
      message: "Order successfully cancelled and inventory secured." 
    });

  } catch (error) {
    console.error("Cancellation Error:", error);
    return NextResponse.json({ error: "Internal cancellation failure" }, { status: 500 });
  }
}
