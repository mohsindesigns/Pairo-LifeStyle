import Order from "@/models/Order";
import Discount from "@/models/Discount";
import Promotion from "@/models/Promotion";
import PromotionCustomerUsage from "@/models/PromotionCustomerUsage";
import Affiliate from "@/models/Affiliate";
import Product from "@/models/Product";
import Engine from "@/lib/promotionEngine/Engine";
import { validateLegacyDiscount, calculateEligibleSubtotal, hashFingerprint, applyDiscountCap } from "@/lib/couponValidator";
import { resolveAuthoritativePrice } from "@/lib/productPricing";
import { shippingService } from "@/services/shipping/ShippingService";

const withSession = (query, mongoSession) => mongoSession ? query.session(mongoSession) : query;

// Recomputes the cart subtotal from real DB prices rather than trusting the
// client-submitted financials.subtotal (or per-item price fields) — otherwise a
// forged request can claim any subtotal for a cart of real products, letting
// every downstream calculation (discount math, affiliate cut, final total)
// inherit an arbitrarily low number. Resolves per-variant pricing (not just the
// base product price) since a variant can legitimately cost more or less.
async function resolveAuthoritativeSubtotal({ items, tenantId, mongoSession }) {
  const productIds = items.map(item => item.id || item._id).filter(Boolean);
  const dbProducts = await withSession(Product.find({ _id: { $in: productIds }, tenantId }).select("price variantCombinations attributes"), mongoSession);
  const productById = new Map(dbProducts.map(p => [p._id.toString(), p]));

  return items.reduce((sum, item) => {
    const id = (item.id || item._id)?.toString();
    const product = productById.get(id);
    // Falls back to the client price only for an item that no longer exists in
    // the DB (e.g. deleted after being added to cart) — a real product's price
    // always comes from the DB, never from the request body.
    const price = product ? resolveAuthoritativePrice(product, item) : item.price;
    return sum + price * item.quantity;
  }, 0);
}

// Recomputes the real shipping cost server-side instead of trusting whatever
// the client submitted — otherwise a forged request can claim any shipping
// price (including $0) for a real order. If the zone has no rates at all,
// authoritative cost is 0 (nothing to charge for); if rates exist, the
// client's selected method must still be one of them.
async function resolveAuthoritativeShippingCost({ tenantId, shippingAddress, shippingSnapshot, subtotal, items, mongoSession }) {
  if (!shippingAddress) return 0;

  const result = await shippingService.getRatesForAddress(tenantId, shippingAddress, subtotal, items);
  if (!result.rates || result.rates.length === 0) return 0;

  const matchedRate = result.rates.find(r => String(r.methodId) === String(shippingSnapshot?.methodId));
  if (!matchedRate) {
    throw new Error("Selected shipping method is no longer available for this address. Please refresh and choose a shipping method again.");
  }
  return matchedRate.cost;
}

export async function computeAuthoritativeCheckout({
  items,
  financials,
  referralCode,
  checkoutEmail,
  orderUserId,
  tenantId,
  shippingAddress = null,
  shippingSnapshot = null,
  mongoSession = null,
  dryRun = false,
  log = null,
  ipAddress = null,
}) {
  let customerType = 'guest';
  if (orderUserId) customerType = 'logged_in';

  const checkoutOrConditions = [];
  if (orderUserId) checkoutOrConditions.push({ "customer.userId": orderUserId });
  if (checkoutEmail) checkoutOrConditions.push({ "customer.email": checkoutEmail });

  if (checkoutOrConditions.length > 0) {
    const orderCount = await withSession(Order.countDocuments({
      tenantId,
      $or: checkoutOrConditions,
      status: { $nin: ['Cancelled', 'Refunded'] }
    }), mongoSession);
    customerType = orderCount > 0 ? 'returning' : (orderUserId ? 'logged_in' : 'new');
  }

  const authoritativeSubtotal = await resolveAuthoritativeSubtotal({ items, tenantId, mongoSession });

  const engineResults = await Engine.evaluate(
    { subtotal: authoritativeSubtotal, items },
    {
      couponCodes: financials.promoCode ? [financials.promoCode] : [],
      userId: orderUserId,
      email: checkoutEmail,
      customerType,
      tenantId
    }
  );

  let finalAppliedPromotions = engineResults.appliedPromotions || [];
  let finalDiscountTotal = engineResults.discountTotal || 0;

  // Fast pre-check so an over-limit customer (or a dry run pricing preview) fails
  // early with a friendly error. This plain count is not race-safe on its own —
  // see the atomic reservation increment near the promotion usage write below,
  // which is what actually closes the race for concurrent checkout attempts.
  if (checkoutOrConditions.length > 0) {
    for (const applied of finalAppliedPromotions) {
      if (applied.isLegacy) continue;
      const maxPerCustomer = applied.usageLimits?.maxUsesPerCustomer;
      if (!maxPerCustomer) continue;

      const priorUses = await withSession(Order.countDocuments({
        tenantId,
        $or: checkoutOrConditions,
        status: { $nin: ['Cancelled', 'Refunded'] },
        "financials.appliedPromotions.promotionId": applied.promotionId
      }), mongoSession);

      if (priorUses >= maxPerCustomer) {
        throw new Error(`You've already used the code "${applied.code}" the maximum number of times allowed.`);
      }
    }
  }

  if (finalAppliedPromotions.length === 0 && financials.promoCode) {
    const legacyDiscount = await withSession(Discount.findOne({
      code: financials.promoCode.toUpperCase().trim(),
      isActive: true,
      isDeleted: false
    }), mongoSession);

    if (!legacyDiscount) {
      throw new Error("Promo code is invalid or no longer available.");
    }

    const validation = await validateLegacyDiscount(legacyDiscount, {
      cartSubtotal: authoritativeSubtotal,
      items,
      userId: orderUserId,
      email: checkoutEmail,
      ip: ipAddress
    });

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const eligibleSubtotal = await calculateEligibleSubtotal(legacyDiscount, items);
    const amount = legacyDiscount.type === 'percentage'
      ? (eligibleSubtotal * legacyDiscount.value) / 100
      : legacyDiscount.value;

    finalDiscountTotal = applyDiscountCap(legacyDiscount, Math.min(amount, eligibleSubtotal));

    if (!dryRun) {
      const fingerprintUpdate = (legacyDiscount.oneRedemptionPerDevice && ipAddress)
        ? { $addToSet: { redeemedFingerprints: hashFingerprint(ipAddress) } }
        : {};

      if (legacyDiscount.usageLimit) {
        const updatedDiscount = await Discount.findOneAndUpdate(
          {
            _id: legacyDiscount._id,
            usageCount: { $lt: legacyDiscount.usageLimit }
          },
          { $inc: { usageCount: 1 }, ...fingerprintUpdate },
          { session: mongoSession, new: true }
        );
        if (!updatedDiscount) {
          throw new Error("Promo code usage limit has been reached.");
        }
      } else {
        await Discount.updateOne(
          { _id: legacyDiscount._id },
          { $inc: { usageCount: 1 }, ...fingerprintUpdate },
          { session: mongoSession }
        );
      }
    }

    finalAppliedPromotions = [{
      promotionId: legacyDiscount._id,
      code: legacyDiscount.code,
      title: `Discount Code: ${legacyDiscount.code}`,
      type: legacyDiscount.type,
      value: legacyDiscount.value,
      discountAmount: finalDiscountTotal,
      explanation: `Legacy discount code ${legacyDiscount.code} applied`,
      isLegacy: true
    }];
  }

  if (!dryRun) {
    for (const applied of finalAppliedPromotions) {
      if (applied.isLegacy) continue;

      const maxPerCustomer = applied.usageLimits?.maxUsesPerCustomer;
      if (maxPerCustomer && checkoutOrConditions.length > 0) {
        const customerKey = orderUserId ? `user:${orderUserId}` : `email:${checkoutEmail.toLowerCase().trim()}`;
        const limitError = `You've already used the code "${applied.code}" the maximum number of times allowed.`;
        let usageRes;
        try {
          usageRes = await PromotionCustomerUsage.findOneAndUpdate(
            {
              tenantId,
              promotionId: applied.promotionId,
              customerKey,
              usageCount: { $lt: maxPerCustomer }
            },
            { $inc: { usageCount: 1 } },
            { session: mongoSession, new: true, upsert: true }
          );
        } catch (e) {
          // A usage doc already exists at/over the limit: the { usageCount: $lt } filter
          // misses, so upsert tries to INSERT a duplicate and hits the unique index (E11000).
          // That's the over-limit case — surface the friendly message, not a raw Mongo error.
          if (e?.code === 11000) {
            throw new Error(limitError);
          }
          throw e;
        }

        if (!usageRes) {
          throw new Error(limitError);
        }
      }

      const promoRes = await Promotion.findOneAndUpdate(
        {
          _id: applied.promotionId,
          tenantId,
          adminStatus: 'Active',
          $or: [
            { 'usageLimits.maxTotalUses': null },
            { $expr: { $lt: ['$usageLimits.currentTotalUses', '$usageLimits.maxTotalUses'] } }
          ]
        },
        {
          $inc: {
            'usageLimits.currentTotalUses': 1,
            'analytics.timesUsed': 1,
            'analytics.discountDistributed': applied.discountAmount,
            'analytics.revenueGenerated': authoritativeSubtotal
          }
        },
        { session: mongoSession, new: true }
      );

      if (!promoRes) throw new Error(`Promotion "${applied.title}" is no longer available.`);
    }
  }

  let affiliateId = null;
  let affiliateReferralCode = null;
  let activeAffiliate = null;

  const promoCodeToResolve = (financials.promoCode || "").toUpperCase().trim();
  if (promoCodeToResolve) {
    activeAffiliate = await withSession(Affiliate.findOne({
      $or: [
        { referralCode: promoCodeToResolve },
        { couponCode: promoCodeToResolve }
      ],
      status: 'Active'
    }), mongoSession);
  }

  if (!activeAffiliate) {
    const cookieCodeToResolve = (referralCode || "").toUpperCase().trim();
    if (cookieCodeToResolve) {
      activeAffiliate = await withSession(Affiliate.findOne({
        $or: [
          { referralCode: cookieCodeToResolve },
          { couponCode: cookieCodeToResolve }
        ],
        status: 'Active'
      }), mongoSession);
    }
  }

  if (activeAffiliate) {
    const buyerEmail = (checkoutEmail || "").toLowerCase().trim();
    const affiliateEmail = (activeAffiliate.email || "").toLowerCase().trim();

    if (buyerEmail && buyerEmail === affiliateEmail) {
      log?.warn?.({ buyerEmail }, "Attribution skipped: Self-referral detected.");
      activeAffiliate = null;
    } else {
      affiliateId = activeAffiliate._id;
      affiliateReferralCode = activeAffiliate.referralCode;
    }
  }

  let affiliateDiscountType = 'None';
  let affiliateDiscountValue = 0;
  let affiliateDiscountAmount = 0;

  if (activeAffiliate && affiliateId) {
    affiliateDiscountType = activeAffiliate.customerDiscountType || 'None';
    affiliateDiscountValue = activeAffiliate.customerDiscountValue || 0;

    if (affiliateDiscountType === 'Percentage' && affiliateDiscountValue > 0) {
      affiliateDiscountAmount = Math.round((authoritativeSubtotal * (affiliateDiscountValue / 100)) * 100) / 100;
    } else if (affiliateDiscountType === 'Fixed' && affiliateDiscountValue > 0) {
      affiliateDiscountAmount = Math.min(affiliateDiscountValue, authoritativeSubtotal);
    }
  }

  const authoritativeShippingCost = await resolveAuthoritativeShippingCost({
    tenantId, shippingAddress, shippingSnapshot, subtotal: authoritativeSubtotal, items, mongoSession,
  });

  // Tax is not yet wired into checkout by design (see admin Tax Settings / TaxService) —
  // forced to 0 here rather than trusting a client-submitted financials.tax value.
  const authoritativeTax = 0;

  // The promo discount and the affiliate discount are computed independently, so together
  // they could exceed the subtotal (worst case the same code is both a Promotion and an
  // Affiliate coupon). Cap their combined effect to the subtotal so they can never eat into
  // shipping/tax — only product cost is ever discountable.
  const combinedDiscountCap = Math.max(0, authoritativeSubtotal - finalDiscountTotal);
  affiliateDiscountAmount = Math.min(affiliateDiscountAmount, combinedDiscountCap);

  const authoritativeTotal = Math.max(
    0,
    authoritativeSubtotal - finalDiscountTotal - affiliateDiscountAmount +
    authoritativeShippingCost + authoritativeTax
  );

  return {
    customerType,
    authoritativeSubtotal,
    finalAppliedPromotions,
    finalDiscountTotal,
    affiliateId,
    affiliateReferralCode,
    activeAffiliate,
    affiliateDiscountType,
    affiliateDiscountValue,
    affiliateDiscountAmount,
    authoritativeShippingCost,
    authoritativeTax,
    authoritativeTotal
  };
}
