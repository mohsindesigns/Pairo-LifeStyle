import mongoose from "mongoose";
import Product from "@/models/Product";
import Review from "@/models/Review";
import dbConnect from "@/lib/db";

// In-memory serialization queue per product to prevent race conditions on aggregation
const aggregationQueues = new Map();

/**
 * Serializes aggregation calls for a specific product ID to resolve race conditions
 * and ensure database consistency across concurrent updates.
 * 
 * @param {string} productId 
 * @param {Function} fn 
 */
async function serializeAggregation(productId, fn) {
  const key = productId.toString();
  if (!aggregationQueues.has(key)) {
    aggregationQueues.set(key, Promise.resolve());
  }

  const currentPromise = aggregationQueues.get(key);
  const nextPromise = currentPromise.then(async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[Review Aggregator] Error in serialized aggregation for ${key}:`, err);
    }
  });

  aggregationQueues.set(key, nextPromise);

  // Clean up to prevent memory leaks
  nextPromise.finally(() => {
    if (aggregationQueues.get(key) === nextPromise) {
      aggregationQueues.delete(key);
    }
  });

  return nextPromise;
}

/**
 * Computes the average rating, total review count, and star breakdown
 * for a product, and updates the Product document with cached aggregates.
 * Thread-safe and transaction-supported where available.
 * 
 * @param {string|mongoose.Types.ObjectId} productId 
 */
export async function aggregateProductRatings(productId) {
  if (!productId) return;
  return serializeAggregation(productId, async () => {
    await dbConnect();

    // Determine if transactions are supported
    let session = null;
    try {
      if (mongoose.connection.readyState === 1 && typeof mongoose.connection.client?.startSession === 'function') {
        const tempSession = await mongoose.startSession();
        try {
          tempSession.startTransaction();
          session = tempSession;
        } catch (txError) {
          await tempSession.endSession();
          session = null;
        }
      }
    } catch (e) {
      session = null;
    }

    try {
      const stats = await Review.aggregate([
        {
          $match: {
            productId: new mongoose.Types.ObjectId(productId),
            status: "Approved",
            isDeleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            reviewCount: { $sum: 1 },
            star5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
            star4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
            star3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
            star2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
            star1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } }
          }
        }
      ], session ? { session } : undefined);

      if (stats.length > 0) {
        const s = stats[0];
        await Product.findByIdAndUpdate(productId, {
          rating: Math.round(s.averageRating * 10) / 10, // Round to 1 decimal place
          reviewCount: s.reviewCount,
          ratingBreakdown: {
            5: s.star5,
            4: s.star4,
            3: s.star3,
            2: s.star2,
            1: s.star1
          }
        }, session ? { session } : undefined);
      } else {
        // Reset if no approved reviews left
        await Product.findByIdAndUpdate(productId, {
          rating: 0,
          reviewCount: 0,
          ratingBreakdown: {
            5: 0,
            4: 0,
            3: 0,
            2: 0,
            1: 0
          }
        }, session ? { session } : undefined);
      }

      if (session) {
        await session.commitTransaction();
      }
    } catch (error) {
      if (session) {
        await session.abortTransaction();
      }
      console.error(`Error aggregating ratings for product ${productId}:`, error.message);
      throw error;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  });
}
