import mongoose from "mongoose";
import Product from "@/models/Product";
import Review from "@/models/Review";
import dbConnect from "@/lib/db";

/**
 * Computes the average rating, total review count, and star breakdown
 * for a product, and updates the Product document with cached aggregates.
 * Should be called whenever a review for the product is approved, rejected,
 * deleted, or updated.
 * 
 * @param {string|mongoose.Types.ObjectId} productId 
 */
export async function aggregateProductRatings(productId) {
  await dbConnect();

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
    ]);

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
      });
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
      });
    }
  } catch (error) {
    console.error(`Error aggregating ratings for product ${productId}:`, error.message);
  }
}
