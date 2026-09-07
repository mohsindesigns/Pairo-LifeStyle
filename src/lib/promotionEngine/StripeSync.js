import stripe from "@/lib/stripe";

/**
 * Maps a Promotion onto Stripe's coupon model, if it's representable there.
 * Stripe Coupons only support a flat percent_off OR amount_off — there's no
 * equivalent for BOGO, bundles, quantity tiers, free shipping, or
 * product/category-targeted discounts, and automatic (no-code) promotions
 * have nothing for a customer to type into Stripe's promo code field anyway.
 * Returns null when the promotion can't be represented in Stripe.
 */
function getStripeDiscountSpec(promotion) {
  if (!promotion.code) return null;
  if (!Array.isArray(promotion.actions) || promotion.actions.length !== 1) return null;

  const action = promotion.actions[0];
  if (action.target && action.target !== "cart") return null;

  if (action.type === "percentage_discount") {
    const percent = Number(action.value);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return null;
    return { percent_off: percent };
  }

  if (action.type === "fixed_discount") {
    const amount = Number(action.value);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return { amount_off: Math.round(amount * 100), currency: "usd" };
  }

  return null;
}

async function deactivatePromotionCode(stripePromotionCodeId) {
  if (!stripePromotionCodeId) return;
  try {
    await stripe.promotionCodes.update(stripePromotionCodeId, { active: false });
  } catch (e) {
    console.error("[StripeSync] Failed to deactivate promotion code:", e.message);
  }
}

/**
 * Creates, recreates, or (de)activates the Stripe Coupon + PromotionCode pair
 * for a Promotion, and returns the fields to persist back onto it. Never
 * throws — a Stripe failure is reported via stripeSyncStatus/stripeSyncError
 * rather than blocking the promotion from being saved in the app.
 *
 * Stripe Coupons are immutable once created (percent_off/amount_off can't be
 * edited), and a PromotionCode's `code` text can't be renamed either — so any
 * change to the code string or discount value/type recreates both objects
 * fresh, deactivating the old PromotionCode first to free up the code text.
 */
export async function syncPromotionToStripe(promotion) {
  const spec = getStripeDiscountSpec(promotion);
  const isActive = promotion.adminStatus === "Active";

  if (!spec) {
    await deactivatePromotionCode(promotion.stripePromotionCodeId);
    return {
      stripeCouponId: promotion.stripeCouponId || null,
      stripePromotionCodeId: promotion.stripePromotionCodeId || null,
      stripeSyncStatus: "unsupported",
      stripeSyncError: null,
      stripeSyncKey: null,
    };
  }

  const code = promotion.code.toUpperCase().trim();
  const newSyncKey = JSON.stringify({ code, ...spec });

  try {
    if (newSyncKey === promotion.stripeSyncKey && promotion.stripePromotionCodeId) {
      // Nothing about the discount itself changed — just keep active state in sync.
      await stripe.promotionCodes.update(promotion.stripePromotionCodeId, { active: isActive });
      return {
        stripeCouponId: promotion.stripeCouponId,
        stripePromotionCodeId: promotion.stripePromotionCodeId,
        stripeSyncStatus: "synced",
        stripeSyncError: null,
        stripeSyncKey: newSyncKey,
      };
    }

    // Code text or discount shape changed (or this is the first sync) — free up
    // the code text on the old object before creating fresh ones.
    await deactivatePromotionCode(promotion.stripePromotionCodeId);

    const coupon = await stripe.coupons.create({
      ...spec,
      duration: "once",
      name: promotion.title?.slice(0, 40) || code,
      metadata: { promotionId: promotion._id.toString(), tenantId: promotion.tenantId },
    });

    const promotionCodeParams = {
      promotion: { type: "coupon", coupon: coupon.id },
      code,
      active: isActive,
      metadata: { promotionId: promotion._id.toString(), tenantId: promotion.tenantId },
    };
    if (promotion.usageLimits?.maxTotalUses) {
      promotionCodeParams.max_redemptions = promotion.usageLimits.maxTotalUses;
    }
    if (promotion.endDate) {
      promotionCodeParams.expires_at = Math.floor(new Date(promotion.endDate).getTime() / 1000);
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
    console.error("[StripeSync] Failed to sync promotion to Stripe:", e.message);
    return {
      stripeCouponId: promotion.stripeCouponId || null,
      stripePromotionCodeId: promotion.stripePromotionCodeId || null,
      stripeSyncStatus: "error",
      stripeSyncError: e.message,
      stripeSyncKey: promotion.stripeSyncKey || null,
    };
  }
}

/** Deactivates a promotion's Stripe PromotionCode without touching the app record. Used on archive/delete. */
export async function deactivatePromotionStripeCode(promotion) {
  await deactivatePromotionCode(promotion.stripePromotionCodeId);
}
