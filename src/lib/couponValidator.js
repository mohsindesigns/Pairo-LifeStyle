import Order from "@/models/Order";
import Subscriber from "@/models/Subscriber";
import Customer from "@/models/Customer";
import Product from "@/models/Product";
import mongoose from "mongoose";

/**
 * Validates a legacy Discount coupon document against the user's cart, subtotal, and user session context.
 *
 * @param {Object} discount - The Discount Mongoose document.
 * @param {Object} options - The context options.
 * @param {number} options.cartSubtotal - The cart subtotal.
 * @param {Array} options.items - Cart items.
 * @param {string} [options.userId] - The user ID if logged in.
 * @param {string} [options.email] - The customer's email address.
 * @returns {Promise<{ valid: boolean, error?: string }>} Validation result.
 */
export async function validateLegacyDiscount(discount, { cartSubtotal, items = [], userId = null, email = null }) {
  // 1. Expiry Date Check
  if (discount.endDate && new Date() > new Date(discount.endDate)) {
    return { valid: false, error: "Promo code has expired." };
  }

  // 2. Global Usage Limit Check
  if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
    return { valid: false, error: "Promo code usage limit has been reached." };
  }

  // 3. Minimum Order Amount Check
  if (cartSubtotal < discount.minPurchase) {
    return { valid: false, error: `Minimum purchase of $${discount.minPurchase.toFixed(2)} is required for this promo code.` };
  }

  // 4. Account Registration Check (Logged in users only)
  if (discount.userRegistrationRequired && !userId) {
    return { valid: false, error: "You must register or log in to use this coupon." };
  }

  // 5. First Order Only Check
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

  // 6. Newsletter Subscription Check
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

  // 7. One Use Per Customer Check (or specific user usage limit)
  const limitPerUser = discount.usagePerUserLimit || 1;
  if (discount.usagePerUserLimit !== undefined && discount.usagePerUserLimit !== null) {
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

  // 8. Specific Product restriction
  if (discount.specificProducts && discount.specificProducts.length > 0) {
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
    if (objectIds.length > 0) {
      queryOr.push({ _id: { $in: objectIds } });
    }
    if (numericIds.length > 0) {
      queryOr.push({ id: { $in: numericIds } });
    }

    let productsInDb = [];
    if (queryOr.length > 0) {
      productsInDb = await Product.find({ $or: queryOr }).select("_id");
    }

    const dbProductObjectIds = productsInDb.map(p => p._id.toString());
    const allObjectIds = [...new Set([...dbProductObjectIds, ...objectIds])];

    const matched = allObjectIds.some(id => discount.specificProducts.map(p => p.toString()).includes(id));
    if (!matched) {
      return { valid: false, error: "This coupon is only valid for specific products." };
    }
  }

  // 9. Specific Category restriction
  if (discount.specificCategories && discount.specificCategories.length > 0) {
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
    if (objectIds.length > 0) {
      queryOr.push({ _id: { $in: objectIds } });
    }
    if (numericIds.length > 0) {
      queryOr.push({ id: { $in: numericIds } });
    }

    let productsInDb = [];
    if (queryOr.length > 0) {
      productsInDb = await Product.find({ $or: queryOr }).select("categories");
    }

    const dbCategoryIds = productsInDb.flatMap(p => p.categories || []);
    
    const matched = dbCategoryIds.some(catId => 
      discount.specificCategories.map(c => c.toString()).includes(catId.toString())
    );
    if (!matched) {
      return { valid: false, error: "This coupon is only valid for specific categories." };
    }
  }

  return { valid: true };
}

/**
 * Calculates the subtotal of items eligible for a legacy Discount coupon.
 *
 * @param {Object} discount - The Discount Mongoose document.
 * @param {Array} items - Cart items.
 * @returns {Promise<number>} Eligible subtotal.
 */
export async function calculateEligibleSubtotal(discount, items = []) {
  const hasProductRestrictions = discount.specificProducts && discount.specificProducts.length > 0;
  const hasCategoryRestrictions = discount.specificCategories && discount.specificCategories.length > 0;

  if (!hasProductRestrictions && !hasCategoryRestrictions) {
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  }

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
  if (objectIds.length > 0) {
    queryOr.push({ _id: { $in: objectIds } });
  }
  if (numericIds.length > 0) {
    queryOr.push({ id: { $in: numericIds } });
  }

  let productsInDb = [];
  if (queryOr.length > 0) {
    productsInDb = await Product.find({ $or: queryOr }).select("categories id");
  }

  const productCategoryMap = {};
  const productObjectIdMap = {}; // Maps numeric id or ObjectId to its MongoDB _id string
  
  productsInDb.forEach(p => {
    const cats = p.categories ? p.categories.map(c => c.toString()) : [];
    const mongoIdStr = p._id.toString();
    productCategoryMap[mongoIdStr] = cats;
    productObjectIdMap[mongoIdStr] = mongoIdStr;
    if (p.id !== undefined && p.id !== null) {
      productCategoryMap[p.id.toString()] = cats;
      productObjectIdMap[p.id.toString()] = mongoIdStr;
    }
  });

  let eligibleSubtotal = 0;
  for (const item of items) {
    const productId = item.id?.toString() || item.productId?.toString() || item._id?.toString();
    const dbCategories = productCategoryMap[productId] || [];
    const dbProductObjectId = productObjectIdMap[productId] || productId;

    let isEligible = true;

    if (hasProductRestrictions) {
      const isProductMatch = discount.specificProducts.map(p => p.toString()).includes(dbProductObjectId);
      if (!isProductMatch) {
        isEligible = false;
      }
    }

    if (hasCategoryRestrictions && isEligible) {
      const isCategoryMatch = dbCategories.some(catId => 
        discount.specificCategories.map(c => c.toString()).includes(catId)
      );
      if (!isCategoryMatch) {
        isEligible = false;
      }
    }

    if (isEligible) {
      eligibleSubtotal += item.price * item.quantity;
    }
  }

  return eligibleSubtotal;
}
