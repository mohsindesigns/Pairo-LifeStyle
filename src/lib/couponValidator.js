import crypto from "crypto";
import Order from "@/models/Order";
import Subscriber from "@/models/Subscriber";
import Customer from "@/models/Customer";
import Product from "@/models/Product";
import { resolveAuthoritativePrice, resolveAuthoritativeCompareAtPrice } from "@/lib/productPricing";

/**
 * Hashes an IP address for privacy-safe storage/comparison in redeemedFingerprints.
 */
export function hashFingerprint(ip) {
  if (!ip) return null;
  return crypto.createHash("sha256").update(String(ip)).digest("hex");
}

/**
 * Resolves the real, DB-verified product document for each cart line item,
 * keyed by whatever identifier (Mongo _id or legacy numeric id) the item
 * carries. Keeps the raw product doc (rather than a flattened price/onSale
 * shape) so callers can resolve variant-specific pricing per line item via
 * resolveAuthoritativePrice/resolveAuthoritativeCompareAtPrice — a bare
 * per-product map can't hold two different prices for two cart lines of the
 * same product with different selected variants.
 */
async function loadDbProductMap(items = []) {
  const cartProductIds = items.map(item => item.id?.toString() || item.productId?.toString() || item._id?.toString());

  const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
  const objectIds = [];
  const numericIds = [];
  for (const id of cartProductIds) {
    if (isValidObjectId(id)) {
      objectIds.push(id);
    } else {
      const num = parseInt(id);
      if (!isNaN(num)) {
        numericIds.push(num);
      }
    }
  }

  const queryOr = [];
  if (objectIds.length > 0) queryOr.push({ _id: { $in: objectIds } });
  if (numericIds.length > 0) queryOr.push({ id: { $in: numericIds } });

  let productsInDb = [];
  if (queryOr.length > 0) {
    productsInDb = await Product.find({ $or: queryOr }).select("_id id categories price compareAtPrice variantCombinations attributes");
  }

  const map = {}; // keyed by both the Mongo _id string AND the legacy numeric id string
  productsInDb.forEach(p => {
    map[p._id.toString()] = p;
    if (p.id !== undefined && p.id !== null) {
      map[p.id.toString()] = p;
    }
  });

  return map;
}

/**
 * Validates a legacy Discount coupon document against the user's cart, subtotal, and user session context.
 *
 * @param {Object} discount - The Discount Mongoose document.
 * @param {Object} options - The context options.
 * @param {number} options.cartSubtotal - The cart subtotal.
 * @param {Array} options.items - Cart items.
 * @param {string} [options.userId] - The user ID if logged in.
 * @param {string} [options.email] - The customer's email address.
 * @param {string} [options.ip] - The requester's IP address, for device-abuse restrictions.
 * @returns {Promise<{ valid: boolean, error?: string }>} Validation result.
 */
export async function validateLegacyDiscount(discount, { cartSubtotal, items = [], userId = null, email = null, ip = null }) {
  // 1. Start Date Check
  if (discount.startDate && new Date() < new Date(discount.startDate)) {
    return { valid: false, error: "This promo code is not active yet." };
  }

  // 2. Expiry Date Check
  if (discount.endDate && new Date() > new Date(discount.endDate)) {
    return { valid: false, error: "Promo code has expired." };
  }

  // 3. Global Usage Limit Check
  if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
    return { valid: false, error: "Promo code usage limit has been reached." };
  }

  // 4. Minimum Order Amount Check
  if (cartSubtotal < discount.minPurchase) {
    return { valid: false, error: `Minimum purchase of $${discount.minPurchase.toFixed(2)} is required for this promo code.` };
  }

  // 5. Minimum Item Quantity Check
  if (discount.minQuantity > 0) {
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    if (totalQuantity < discount.minQuantity) {
      return { valid: false, error: `A minimum of ${discount.minQuantity} item(s) is required for this promo code.` };
    }
  }

  // 6. Account Registration Check (Logged in users only)
  if (discount.userRegistrationRequired && !userId) {
    return { valid: false, error: "You must register or log in to use this coupon." };
  }

  // 7. Specific Customers Check
  if (discount.specificCustomers && discount.specificCustomers.length > 0) {
    const allowedIds = discount.specificCustomers.map(c => c.toString());
    let matched = userId && allowedIds.includes(userId.toString());

    if (!matched && email) {
      const customer = await Customer.findOne({ email: email.toLowerCase().trim() }).select("_id");
      if (customer && allowedIds.includes(customer._id.toString())) {
        matched = true;
      }
    }

    if (!matched) {
      return { valid: false, error: "This coupon is not valid for your account." };
    }
  }

  // 8. One Redemption Per Device/IP Check
  if (discount.oneRedemptionPerDevice) {
    const fingerprint = hashFingerprint(ip);
    if (fingerprint && discount.redeemedFingerprints?.includes(fingerprint)) {
      return { valid: false, error: "This promo code has already been redeemed from this device." };
    }
  }

  // 9. First Order Only Check
  if (discount.firstOrderOnly) {
    const previousOrdersQuery = { status: { $nin: ["Cancelled"] } };
    const orConditions = [];
    if (userId) {
      orConditions.push({ "customer.userId": userId });
    }
    if (email) {
      orConditions.push({ "customer.email": email.toLowerCase().trim() });
    }

    if (orConditions.length > 0) {
      previousOrdersQuery.$or = orConditions;
      const orderCount = await Order.countDocuments(previousOrdersQuery);
      if (orderCount > 0) {
        return { valid: false, error: "This coupon is only valid for your first order." };
      }
    }
  }

  // 10. Newsletter Subscription Check
  if (discount.newsletterSubscribedOnly) {
    let checkEmail = email;
    if (!checkEmail && userId) {
      const user = await Customer.findById(userId);
      if (user) {
        checkEmail = user.email;
      }
    }

    if (checkEmail) {
      const subscriber = await Subscriber.findOne({
        email: checkEmail.toLowerCase().trim(),
        status: "Subscribed"
      });
      if (!subscriber) {
        return { valid: false, error: "This coupon is reserved for newsletter subscribers only." };
      }
    } else if (discount.userRegistrationRequired) {
      // Let it pass guest phase, it will block at checkout when email is captured
    }
  }

  // 11. One Use Per Customer Check (or specific user usage limit)
  if (discount.usagePerUserLimit !== undefined && discount.usagePerUserLimit !== null) {
    const limitPerUser = discount.usagePerUserLimit;
    const userUsageQuery = { "financials.promoCode": discount.code, status: { $nin: ["Cancelled"] } };
    const orConditions = [];
    if (userId) {
      orConditions.push({ "customer.userId": userId });
    }
    if (email) {
      orConditions.push({ "customer.email": email.toLowerCase().trim() });
    }

    if (orConditions.length > 0) {
      userUsageQuery.$or = orConditions;
      const userUsageCount = await Order.countDocuments(userUsageQuery);
      if (userUsageCount >= limitPerUser) {
        return { valid: false, error: "You have already used this promo code the maximum number of times." };
      }
    }
  }

  // 12. Specific Product restriction
  if (discount.specificProducts && discount.specificProducts.length > 0) {
    const dbProductMap = await loadDbProductMap(items);
    const cartProductIds = items.map(item => item.id?.toString() || item.productId?.toString() || item._id?.toString());
    const allowedIds = discount.specificProducts.map(p => p.toString());

    const matched = cartProductIds.some(id => {
      const entry = dbProductMap[id];
      return entry && allowedIds.includes(entry._id.toString());
    });
    if (!matched) {
      return { valid: false, error: "This coupon is only valid for specific products." };
    }
  }

  // 13. Specific Category restriction
  if (discount.specificCategories && discount.specificCategories.length > 0) {
    const dbProductMap = await loadDbProductMap(items);
    const cartProductIds = items.map(item => item.id?.toString() || item.productId?.toString() || item._id?.toString());
    const allowedIds = discount.specificCategories.map(c => c.toString());

    const matched = cartProductIds.some(id => {
      const entry = dbProductMap[id];
      return entry && (entry.categories || []).some(catId => allowedIds.includes(catId.toString()));
    });
    if (!matched) {
      return { valid: false, error: "This coupon is only valid for specific categories." };
    }
  }

  return { valid: true };
}

/**
 * Calculates the subtotal of items eligible for a legacy Discount coupon.
 *
 * Prices are always re-derived from the DB Product record rather than trusting
 * the client-supplied `item.price` — otherwise a forged request could claim any
 * price for a real product and inflate the resulting discount arbitrarily.
 *
 * @param {Object} discount - The Discount Mongoose document.
 * @param {Array} items - Cart items.
 * @returns {Promise<number>} Eligible subtotal.
 */
export async function calculateEligibleSubtotal(discount, items = []) {
  const hasProductRestrictions = discount.specificProducts && discount.specificProducts.length > 0;
  const hasCategoryRestrictions = discount.specificCategories && discount.specificCategories.length > 0;
  const excludeSaleItems = !!discount.excludeSaleItems;

  const dbProductMap = await loadDbProductMap(items);
  const allowedProductIds = hasProductRestrictions ? discount.specificProducts.map(p => p.toString()) : null;
  const allowedCategoryIds = hasCategoryRestrictions ? discount.specificCategories.map(c => c.toString()) : null;

  let eligibleSubtotal = 0;
  for (const item of items) {
    const productId = item.id?.toString() || item.productId?.toString() || item._id?.toString();
    const dbEntry = dbProductMap[productId];
    // Fall back to the client-supplied price only when the product can't be found in the
    // DB (e.g. a since-deleted product still sitting in someone's cart) — a real, existing
    // product's price is always taken from the DB (variant-aware), never from the request body.
    const price = dbEntry ? resolveAuthoritativePrice(dbEntry, item) : item.price;

    let isEligible = true;

    if (hasProductRestrictions) {
      if (!dbEntry || !allowedProductIds.includes(dbEntry._id.toString())) {
        isEligible = false;
      }
    }

    if (hasCategoryRestrictions && isEligible) {
      if (!dbEntry || !(dbEntry.categories || []).some(catId => allowedCategoryIds.includes(catId.toString()))) {
        isEligible = false;
      }
    }

    if (excludeSaleItems && isEligible && dbEntry) {
      const compareAtPrice = resolveAuthoritativeCompareAtPrice(dbEntry, item);
      const onSale = compareAtPrice != null && compareAtPrice > price;
      if (onSale) isEligible = false;
    }

    if (isEligible) {
      eligibleSubtotal += price * item.quantity;
    }
  }

  return eligibleSubtotal;
}

/**
 * Applies a coupon's optional maximum-discount-amount cap (e.g. "20% off, up to $50").
 * Only meaningful for percentage discounts, but safe to call for any discount type.
 */
export function applyDiscountCap(discount, amount) {
  if (discount.maxDiscountAmount != null && discount.maxDiscountAmount >= 0) {
    return Math.min(amount, discount.maxDiscountAmount);
  }
  return amount;
}
