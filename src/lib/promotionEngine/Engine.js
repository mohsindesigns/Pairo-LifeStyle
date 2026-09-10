import Loader from './Loader.js';
import ConditionEvaluator from './ConditionEvaluator.js';
import ActionExecutor from './ActionExecutor.js';
import ConflictResolver from './ConflictResolver.js';
import dbConnect from '../db.js';
import Product from '../../models/Product.js';
import { resolveAuthoritativePrice } from '../productPricing.js';

/**
 * The main entry point for the Promotion Engine.
 * Orchestrates the loading, evaluation, and execution of promotions.
 */
export default class Engine {
  // Must comfortably cover dbConnect + Product.find + (optional Redis) + Promotion.find under
  // real network/DB latency. 50ms tripped on nearly every request — the race rejected and the
  // engine silently returned ZERO discounts, so valid coupons randomly failed and automatic
  // promotions vanished non-deterministically. This is the root cause of "coupons don't apply".
  static EVAL_TIMEOUT_MS = 4000;

  /**
   * Main entry point for evaluation.
   * Wraps evaluation in a safety timeout to prevent Event Loop blocking.
   */
  static async evaluate(cart, context = {}) {
    const { tenantId = 'DEFAULT_STORE' } = context;
    
    const evalPromise = this._internalEvaluate(cart, context);
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('EVAL_TIMEOUT')), this.EVAL_TIMEOUT_MS)
    );

    try {
        return await Promise.race([evalPromise, timeoutPromise]);
    } catch (err) {
        if (err.message === 'EVAL_TIMEOUT') {
            console.error(`[Engine:Critical] Evaluation timeout exceeded for tenant ${tenantId}. Returning subtotal.`);
            return {
                subtotal: cart.subtotal,
                discountTotal: 0,
                total: cart.subtotal,
                appliedPromotions: [],
                rejectedCodeMatches: [],
                items: cart.items.map(item => ({ ...item, discountAmount: 0, finalPrice: item.price }))
            };
        }
        throw err;
    }
  }

  static async _internalEvaluate(cart, context = {}) {
    const { couponCodes = [], tenantId = 'DEFAULT_STORE' } = context;
    console.log(`[Engine:Main] Starting evaluation for cart: { subtotal: ${cart.subtotal}, itemsCount: ${cart.items?.length || 0} }`);

    // 0. Enrich Cart Phase (SaaS price and target loading safety)
    const productIds = cart.items?.map(item => item.productId?.toString() || item.id?.toString() || item._id?.toString()).filter(Boolean) || [];
    let productsMap = new Map();
    if (productIds.length > 0) {
      try {
        await dbConnect();
        const products = await Product.find({ _id: { $in: productIds } }).lean();
        productsMap = new Map(products.map(p => [p._id.toString(), p]));
      } catch (err) {
        console.error("[Engine:Main] Error loading products for enrichment:", err);
      }
    }

    const enrichedItems = cart.items?.map(item => {
      const dbProduct = productsMap.get(item.productId?.toString() || item.id?.toString() || item._id?.toString());
      const basePrice = dbProduct ? resolveAuthoritativePrice(dbProduct, item) : item.price;
      return {
        ...item,
        price: basePrice,
        categories: dbProduct ? (dbProduct.categories || []).filter(Boolean).map(c => c.toString()) : (item.categories || []),
        collections: dbProduct ? (dbProduct.collections || []).filter(Boolean).map(c => c.toString()) : (item.collections || [])
      };
    }) || [];

    const enrichedCart = {
      ...cart,
      subtotal: enrichedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      items: enrichedItems
    };

    // 1. Loader Phase
    let promotions = [];
    if (context.activePromotions) {
      promotions = context.activePromotions;
      console.log(`[Engine:Loader] Using ${promotions.length} provided promotions (Simulation Mode)`);
    } else {
      promotions = await Loader.loadPromotions(context.couponCodes || [], tenantId);
      console.log(`[Engine:Main] Loaded ${promotions.length} potential promotions from DB (Tenant: ${tenantId})`);
    }
    
    // 2. Collection Phase (Evaluation & Execution Math)
    const eligiblePromotions = [];
    // Promotions that match a requested coupon code by name but fail their conditions — kept
    // so callers can tell "this code doesn't exist" from "this code exists but your cart
    // doesn't qualify yet" instead of collapsing both into a generic not-found error.
    const rejectedCodeMatches = [];
    const requestedCodes = (couponCodes || []).map(c => c.toUpperCase());
    const evaluationCache = new Map(); // Memoization cache for this evaluation cycle

    for (const promo of promotions) {
      let evaluation;
      const promoKey = (promo._id || promo.title || Math.random()).toString();

      if (evaluationCache.has(promoKey)) {
        console.log(`[Engine:Main] Memoization HIT for: ${promo.title}`);
        evaluation = evaluationCache.get(promoKey);
      } else {
        evaluation = ConditionEvaluator.evaluate(promo, enrichedCart, context);
        evaluationCache.set(promoKey, evaluation);
      }

      if (evaluation.isEligible) {
        const execution = ActionExecutor.execute(promo, enrichedCart);
        eligiblePromotions.push({
          promotion: promo,
          evaluation,
          execution
        });
      } else if (promo.code && requestedCodes.includes(promo.code.toUpperCase())) {
        rejectedCodeMatches.push({ code: promo.code, explanation: evaluation.explanation });
      }
    }

    // 3. Resolution Phase (Exclusivity, Stacking, Priority)
    const resolvedPromotions = ConflictResolver.resolve(eligiblePromotions);

    // 4. Finalization Phase (Construct Results)
    const results = {
      appliedPromotions: [],
      rejectedCodeMatches,
      discountTotal: 0,
      freeShipping: false,
      cartTotal: enrichedCart.subtotal,
      breakdown: [] // Detailed explanation for UI
    };

    for (const { promotion, evaluation, execution } of resolvedPromotions) {
      results.appliedPromotions.push({
        promotionId: promotion._id,
        code: promotion.code,
        title: promotion.title,
        type: promotion.actions[0]?.type || 'discount',
        value: promotion.actions[0]?.value,
        discountAmount: execution.discountAmount,
        explanation: evaluation.explanation,
        stackable: promotion.stackable,
        exclusive: promotion.exclusive,
        isAutomatic: promotion.isAutomatic,
        usageLimits: promotion.usageLimits || {},
        rulesSnapshot: {
          conditions: promotion.conditions,
          actions: promotion.actions
        }
      });

      results.discountTotal += execution.discountAmount;
      if (execution.isFreeShipping) results.freeShipping = true;
    }

    // Each promo's discount is individually capped to subtotal, but the SUM of stacked
    // promotions can still exceed it — cap the combined total too, or checkout's
    // `subtotal - discountTotal + shipping` can go negative enough to wipe out shipping/tax.
    results.discountTotal = Math.min(parseFloat(results.discountTotal.toFixed(2)), enrichedCart.subtotal);
    results.cartTotal = Math.max(0, enrichedCart.subtotal - results.discountTotal);
    
    console.log(`[Engine:Main] Evaluation complete. Total Discount: $${results.discountTotal}`);
    return results;
  }
}
