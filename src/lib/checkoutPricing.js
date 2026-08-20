import Order from "@/models/Order";
import Discount from "@/models/Discount";
import Promotion from "@/models/Promotion";
import Affiliate from "@/models/Affiliate";
import Engine from "@/lib/promotionEngine/Engine";
import { validateLegacyDiscount, calculateEligibleSubtotal } from "@/lib/couponValidator";

const withSession = (query, mongoSession) => mongoSession ? query.session(mongoSession) : query;

export async function computeAuthoritativeCheckout({
  items,
  financials,
  referralCode,
  checkoutEmail,
  orderUserId,
  tenantId,
  mongoSession = null,
  dryRun = false,
  log = null,
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

  const engineResults = await Engine.evaluate(
    { subtotal: financials.subtotal, items },
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
      cartSubtotal: financials.subtotal,
      items,
      userId: orderUserId,
      email: checkoutEmail
    });

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const eligibleSubtotal = await calculateEligibleSubtotal(legacyDiscount, items);
    const amount = legacyDiscount.type === 'percentage'
      ? (eligibleSubtotal * legacyDiscount.value) / 100
      : legacyDiscount.value;

    finalDiscountTotal = Math.min(amount, eligibleSubtotal);

    if (!dryRun) {
      if (legacyDiscount.usageLimit) {
        const updatedDiscount = await Discount.findOneAndUpdate(
          {
            _id: legacyDiscount._id,
            usageCount: { $lt: legacyDiscount.usageLimit }
          },
          { $inc: { usageCount: 1 } },
          { session: mongoSession, new: true }
        );
        if (!updatedDiscount) {
          throw new Error("Promo code usage limit has been reached.");
        }
      } else {
        await Discount.updateOne(
          { _id: legacyDiscount._id },
          { $inc: { usageCount: 1 } },
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
            'analytics.discountDistributed': applied.discountAmount
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
      affiliateDiscountAmount = Math.round((financials.subtotal * (affiliateDiscountValue / 100)) * 100) / 100;
    } else if (affiliateDiscountType === 'Fixed' && affiliateDiscountValue > 0) {
      affiliateDiscountAmount = Math.min(affiliateDiscountValue, financials.subtotal);
    }
  }

  const authoritativeTotal = Math.max(
    0,
    (financials.subtotal || 0) - finalDiscountTotal - affiliateDiscountAmount +
    Number(financials.shippingCost || 0) + Number(financials.tax || 0)
  );

  return {
    customerType,
    finalAppliedPromotions,
    finalDiscountTotal,
    affiliateId,
    affiliateReferralCode,
    activeAffiliate,
    affiliateDiscountType,
    affiliateDiscountValue,
    affiliateDiscountAmount,
    authoritativeTotal
  };
}
