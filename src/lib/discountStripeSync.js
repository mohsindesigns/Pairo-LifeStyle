import stripe from "@/lib/stripe";

/**
 * Maps a "Coupons" (Discount model) code onto Stripe's coupon model, if it's
 * representable there. Stripe can enforce a flat percent_off/amount_off plus
 * a minimum spend and/or first-purchase-only restriction on its own — but it
 * has no concept of this app's product/category/customer scoping,
 * registered-customer or newsletter-subscriber gating, a capped max discount
 * on a percentage coupon, a minimum cart quantity, excluding sale items, or
 * per-device redemption limiting. A discount using any of those would let a
 * customer get a bigger or less-restricted discount through Stripe Checkout
 * than the app intends, so those are left local-only rather than synced.
 * Returns null when the discount can't be safely represented in Stripe.
 */
function getStripeDiscountSpec(discount) {
  if (!discount.code) return null;
  if (Array.isArray(discount.specificProducts) && discount.specificProducts.length > 0) return null;
  if (Array.isArray(discount.specificCategories) && discount.specificCategories.length > 0) return null;
  if (Array.isArray(discount.specificCustomers) && discount.specificCustomers.length > 0) return null;
  if (discount.userRegistrationRequired) return null;
  if (discount.newsletterSubscribedOnly) return null;
  if (discount.usagePerUserLimit && Number(discount.usagePerUserLimit) !== 1) return null;
  if (discount.maxDiscountAmount) return null;
  if (discount.minQuantity && Number(discount.minQuantity) > 0) return null;
  if (discount.excludeSaleItems) return null;
  if (discount.oneRedemptionPerDevice) return null;

  if (discount.type === "percentage") {
    const percent = Number(discount.value);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return null;
    return { percent_off: percent };
  }

  if (discount.type === "fixed") {
    const amount = Number(discount.value);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return { amount_off: Math.round(amount * 100), currency: "usd" };
  }

  return null;
}

function getStripeRestrictions(discount) {
  const restrictions = {};
  if (discount.minPurchase) {
    restrictions.minimum_amount = Math.round(Number(discount.minPurchase) * 100);
    restrictions.minimum_amount_currency = "usd";
  }
  if (discount.firstOrderOnly) {
    restrictions.first_time_transaction = true;
  }
  return Object.keys(restrictions).length > 0 ? restrictions : undefined;
}

async function deactivatePromotionCode(stripePromotionCodeId) {
  if (!stripePromotionCodeId) return;
  try {
    await stripe.promotionCodes.update(stripePromotionCodeId, { active: false });
  } catch (e) {
    console.error("[DiscountStripeSync] Failed to deactivate promotion code:", e.message);
  }
}

/**
 * Creates, recreates, or (de)activates the Stripe Coupon + PromotionCode pair
 * for a "Coupons" Discount, and returns the fields to persist back onto it.
 * Never throws — a Stripe failure is reported via stripeSyncStatus/stripeSyncError
 * rather than blocking the coupon from being saved in the app. See StripeSync.js
 * (the equivalent for the Promotions engine) for the same pattern.
 */
export async function syncDiscountToStripe(discount) {
  const spec = getStripeDiscountSpec(discount);
  // Stripe has no "not valid until" restriction (only expires_at, which
  // endDate already maps to below) — a future startDate is enforced here by
  // keeping the Stripe-side code inactive until that date has passed. This is
  // only re-evaluated on save, so a scheduled coupon won't flip active in
  // Stripe the instant its start date arrives unless the record is saved again.
  const scheduledStart = discount.startDate ? new Date(discount.startDate) : null;
  const hasStarted = !scheduledStart || scheduledStart <= new Date();
  const isActive = !!discount.isActive && !discount.isDeleted && hasStarted;

  if (!spec) {
    await deactivatePromotionCode(discount.stripePromotionCodeId);
    return {
      stripeCouponId: discount.stripeCouponId || null,
      stripePromotionCodeId: discount.stripePromotionCodeId || null,
      stripeSyncStatus: "unsupported",
      stripeSyncError: null,
      stripeSyncKey: null,
    };
  }

  const code = discount.code.toUpperCase().trim();
  const restrictions = getStripeRestrictions(discount);
  const newSyncKey = JSON.stringify({ code, ...spec, restrictions, maxRedemptions: discount.usageLimit || null, endDate: discount.endDate || null });

  try {
    if (newSyncKey === discount.stripeSyncKey && discount.stripePromotionCodeId) {
      // Nothing about the discount shape itself changed — just keep active state in sync.
      await stripe.promotionCodes.update(discount.stripePromotionCodeId, { active: isActive });
      return {
        stripeCouponId: discount.stripeCouponId,
        stripePromotionCodeId: discount.stripePromotionCodeId,
        stripeSyncStatus: "synced",
        stripeSyncError: null,
        stripeSyncKey: newSyncKey,
      };
    }

    // Code text or discount shape changed (or this is the first sync) — free up
    // the code text on the old object before creating fresh ones. Stripe Coupons
    // are immutable and a PromotionCode's `code` can't be renamed either.
    await deactivatePromotionCode(discount.stripePromotionCodeId);

    const coupon = await stripe.coupons.create({
      ...spec,
      duration: "once",
      name: code,
      metadata: { discountId: discount._id.toString() },
    });

    const promotionCodeParams = {
      promotion: { type: "coupon", coupon: coupon.id },
      code,
      active: isActive,
      metadata: { discountId: discount._id.toString() },
    };
    if (discount.usageLimit) {
      promotionCodeParams.max_redemptions = discount.usageLimit;
    }
    if (discount.endDate) {
      promotionCodeParams.expires_at = Math.floor(new Date(discount.endDate).getTime() / 1000);
    }
    if (restrictions) {
      promotionCodeParams.restrictions = restrictions;
    }

    const promotionCode = await stripe.promotionCodes.create(promotionCodeParams);

    return {
      stripeCouponId: coupon.id,
      stripePromotionCodeId: promotionCode.id,
      stripeSyncStatus: "synced",
      stripeSyncError: null,
      stripeSyncKey: newSyncKey,
    };
  } catch (e) {
    console.error("[DiscountStripeSync] Failed to sync discount to Stripe:", e.message);
    return {
      stripeCouponId: discount.stripeCouponId || null,
      stripePromotionCodeId: discount.stripePromotionCodeId || null,
      stripeSyncStatus: "error",
      stripeSyncError: e.message,
      stripeSyncKey: discount.stripeSyncKey || null,
    };
  }
}

/** Deactivates a discount's Stripe PromotionCode without touching the app record. Used on trash/delete. */
export async function deactivateDiscountStripeCode(discount) {
  await deactivatePromotionCode(discount.stripePromotionCodeId);
}
