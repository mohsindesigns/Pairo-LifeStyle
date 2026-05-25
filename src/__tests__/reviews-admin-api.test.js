import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "@/models/Product";
import Review from "@/models/Review";

dotenv.config({ path: ".env.local" });

describe("Reviews Admin API Mongoose Level Lifecycle Verification", () => {
  let tempProduct;
  let tempReview;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Setup mock product
    tempProduct = await Product.create({
      tenantId: "DEFAULT_STORE",
      id: 8888,
      name: "Admin API Lifecycle Test Jacket",
      price: 250,
      rating: 0,
      reviewCount: 0,
      ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    });
  });

  afterAll(async () => {
    if (tempProduct) {
      await Product.deleteOne({ _id: tempProduct._id });
    }
    await mongoose.connection.close();
  });

  it("should create a new review with isDeleted defaults to false", async () => {
    tempReview = await Review.create({
      tenantId: "DEFAULT_STORE",
      productId: tempProduct._id,
      orderId: new mongoose.Types.ObjectId(),
      rating: 5,
      customerName: "Lifecycle Tester",
      customerEmail: "lifecycle@test.com",
      comment: "Superb product!",
      status: "Approved"
    });

    expect(tempReview.isDeleted).toBeFalsy();
    expect(tempReview.status).toBe("Approved");
  });

  it("should soft-delete review by setting isDeleted to true", async () => {
    const fetched = await Review.findById(tempReview._id);
    fetched.isDeleted = true;
    await fetched.save();

    const updated = await Review.findById(tempReview._id).lean();
    expect(updated.isDeleted).toBe(true);
  });

  it("should restore soft-deleted review to Pending status", async () => {
    const fetched = await Review.findById(tempReview._id);
    expect(fetched.isDeleted).toBe(true);

    // Mimic the restore payload logic
    fetched.isDeleted = false;
    fetched.status = "Pending";
    await fetched.save();

    const updated = await Review.findById(tempReview._id).lean();
    expect(updated.isDeleted).toBe(false);
    expect(updated.status).toBe("Pending");
  });

  it("should permanently delete the review if it is already soft-deleted", async () => {
    // 1. Move to trash again
    const fetched = await Review.findById(tempReview._id);
    fetched.isDeleted = true;
    await fetched.save();

    // 2. Perform permanent delete as implemented in individual route's DELETE handler
    const checked = await Review.findById(tempReview._id);
    expect(checked.isDeleted).toBe(true);

    await Review.findByIdAndDelete(tempReview._id);

    const afterDelete = await Review.findById(tempReview._id).lean();
    expect(afterDelete).toBeNull();
  });
});
