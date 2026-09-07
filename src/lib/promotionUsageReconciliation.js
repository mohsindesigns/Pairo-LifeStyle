import Promotion from "@/models/Promotion";
import Discount from "@/models/Discount";
import PromotionCustomerUsage from "@/models/PromotionCustomerUsage";

const RELEASED_STATUSES = ['Cancelled', 'Refunded'];

export function isUsageReleasingTransition(oldStatus, newStatus) {
  return RELEASED_STATUSES.includes(newStatus) && !RELEASED_STATUSES.includes(oldStatus);
}

export function isUsageRestoringTransition(oldStatus, newStatus) {
  return !RELEASED_STATUSES.includes(newStatus) && RELEASED_STATUSES.includes(oldStatus);
}

/**
 * Releases (delta = -1) or restores (delta = +1) the usage-limit "slots" an
 * order's applied promotions consumed. Every usage-limit COUNT check elsewhere
 * in the app already excludes Cancelled/Refunded orders (status: { $nin:
 * [...] }) — this keeps the incremented COUNTER fields (Promotion.usageLimits,
 * Discount.usageCount, PromotionCustomerUsage) consistent with that, so a
 * cancelled or refunded order doesn't permanently burn a "once per customer"
 * or "N total uses" slot the customer never actually got to keep.
 */
export async function reconcilePromotionUsage(order, delta) {
  const applied = order.financials?.appliedPromotions || [];
  if (applied.length === 0) return;

  const tenantId = order.tenantId;
  const customerKey = order.customer?.userId
    ? `user:${order.customer.userId}`
    : order.customer?.email
      ? `email:${order.customer.email.toLowerCase().trim()}`
      : null;

  for (const entry of applied) {
    if (!entry.promotionId) continue;

    // Try the enterprise Promotion collection first; appliedPromotions doesn't
    // persist which system generated an entry, so an ID lookup against both
    // collections is how legacy vs. enterprise is distinguished after the fact.
    const promotion = await Promotion.findOneAndUpdate(
      { _id: entry.promotionId, tenantId },
      {
        $inc: {
          'usageLimits.currentTotalUses': delta,
          'analytics.timesUsed': delta,
          'analytics.discountDistributed': delta * (entry.discountAmount || 0),
          'analytics.revenueGenerated': delta * (order.financials?.subtotal || 0)
        }
      }
    );

    if (promotion) {
      if (customerKey) {
        await PromotionCustomerUsage.updateOne(
          { tenantId, promotionId: entry.promotionId, customerKey },
          { $inc: { usageCount: delta } }
        );
      }
      continue;
    }

    await Discount.updateOne(
      { _id: entry.promotionId },
      { $inc: { usageCount: delta } }
    );
  }
}
