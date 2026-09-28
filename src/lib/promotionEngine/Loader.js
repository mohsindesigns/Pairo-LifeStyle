import dbConnect from "../db.js";
import Promotion from "../../models/Promotion.js";
import { cache } from "../cache.js";
import logger, { LogCategory } from "../logger.js";

/**
 * Loads active promotions from the database with a high-performance caching layer.
 */
export default class Loader {
  /**
   * @param {Array} couponCodes - Optional array of strings
   */
  static async loadPromotions(couponCodes = []) {
    const baseKey = `ACTIVE:${[...couponCodes].sort().join(',')}`;
    const cacheKey = await cache.getVersionedKey(baseKey);

    // 1. Try Cache First
    try {
      const cachedData = await cache.get(cacheKey);
      if (cachedData) {
        const promos = JSON.parse(cachedData);
        logger.debug({ category: LogCategory.CACHE_OPERATIONS, count: promos.length }, "Promotion cache HIT");
        return promos;
      }
    } catch (e) {
      logger.error({ category: LogCategory.CACHE_OPERATIONS, error: e.message }, "Redis GET failed. Falling back to DB.");
    }

    // 2. Database Fallback
    await dbConnect();

    const now = new Date();
    // Base Query for Active & Date-Eligible
    const query = {
      adminStatus: 'Active',
      $and: [
        {
          $or: [
            { startDate: { $exists: false } },
            { startDate: null },
            { startDate: { $lte: now } }
          ]
        },
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: null },
            { endDate: { $gte: now } }
          ]
        }
      ]
    };

    // Promotion Type logic
    if (couponCodes.length > 0) {
      query.$or = [
        { code: { $in: couponCodes.map(c => c.toUpperCase()) } },
        { isAutomatic: true }
      ];
    } else {
      query.isAutomatic = true;
    }

    const promotions = await Promotion.find(query).sort({ priority: -1 }).lean();
    
    // 3. Populate Cache (Fail-safe)
    if (promotions.length > 0) {
      await cache.set(cacheKey, JSON.stringify(promotions), 300); // 5 min TTL
    }

    logger.debug({ category: LogCategory.ENGINE_EVAL, count: promotions.length }, "Promotions loaded from MongoDB");
    return promotions;
  }
}
