import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { escapeJsonLd, resolveSEOMetadata } from "@/lib/seo-resolver";
import Product from "@/models/Product";
import Review from "@/models/Review";
import { aggregateProductRatings } from "@/lib/review-aggregator";

// Load local environment variables
dotenv.config({ path: ".env.local" });

// Advanced profanity masking check
const profanityList = ['fuck', 'shit', 'asshole', 'bitch', 'crap', 'bastard', 'dick'];
const maskProfanity = (text) => {
  if (!text) return "";
  let masked = text;
  profanityList.forEach(word => {
    const regex = new RegExp(`\\b\\w*${word}\\w*\\b`, "gi");
    masked = masked.replace(regex, (match) => "*".repeat(match.length));
  });
  return masked;
};

describe("Reviews Hardening Verification Suite", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it("should escape script tags inside JSON-LD payload to prevent XSS breakout", () => {
    const maliciousPayload = {
      "@context": "https://schema.org",
      "@type": "Review",
      "reviewBody": "</script><script>alert('xss')</script> Bad payload!",
      "name": "Malicious Test"
    };

    const escaped = escapeJsonLd(maliciousPayload);
    expect(escaped).not.toContain("</script>");
    expect(escaped).toContain("\\u002fscript\\u003e");
  });

  it("should mask profanities and their suffixes/compounds correctly", () => {
    const raw = "This is a fucking disaster and it's absolute shit.";
    const masked = maskProfanity(raw);
    expect(masked).toContain("*******"); // fucking -> *******
    expect(masked).toContain("****");    // shit -> ****
    expect(masked).not.toContain("fuck");
    expect(masked).not.toContain("shit");
  });

  it("should aggregate product ratings accurately and concurrently without race conditions", async () => {
    // Create a temporary mock product
    const product = await Product.create({
      tenantId: "DEFAULT_STORE",
      id: 9999,
      name: "Vitest Concurrency Test Jacket",
      slug: "vitest-concurrency-test-jacket-" + Date.now(),
      price: 800,
      rating: 0,
      reviewCount: 0,
      ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    });

    // Create 5 reviews with ratings 1, 2, 3, 4, 5
    const reviewIds = [];
    const reviewPromises = [];
    for (let i = 1; i <= 5; i++) {
      reviewPromises.push(
        Review.create({
          tenantId: "DEFAULT_STORE",
          productId: product._id,
          orderId: new mongoose.Types.ObjectId(),
          rating: i,
          customerName: `Tester ${i}`,
          customerEmail: `tester${i}@vitest.com`,
          status: "Approved"
        }).then(r => {
          reviewIds.push(r._id);
          return r;
        })
      );
    }

    await Promise.all(reviewPromises);

    // Trigger concurrent aggregations
    await Promise.all([
      aggregateProductRatings(product._id),
      aggregateProductRatings(product._id),
      aggregateProductRatings(product._id),
      aggregateProductRatings(product._id),
      aggregateProductRatings(product._id)
    ]);

    // Fetch updated product from DB
    const updatedProduct = await Product.findById(product._id).lean();

    // Verify rating average = (1 + 2 + 3 + 4 + 5) / 5 = 3.0
    expect(updatedProduct.rating).toBe(3);
    expect(updatedProduct.reviewCount).toBe(5);
    expect(updatedProduct.ratingBreakdown[5]).toBe(1);
    expect(updatedProduct.ratingBreakdown[1]).toBe(1);

    // Cleanup test documents
    await Product.deleteOne({ _id: product._id });
    await Review.deleteMany({ _id: { $in: reviewIds } });
  });

  it("should ensure only approved and non-deleted reviews enter SEO structured JSON-LD data", () => {
    const mockProduct = {
      name: "SEO Test Jacket",
      shortDescription: "Sleek shearling",
      price: 1200,
      stock: 10,
      reviewCount: 1,
      rating: 5
    };

    const mockReviews = [
      { customerName: "Approved User", comment: "Great!", rating: 5, status: "Approved", isDeleted: false },
      { customerName: "Pending User", comment: "Is it good?", rating: 4, status: "Pending", isDeleted: false },
      { customerName: "Spam User", comment: "Buy cheap pills!", rating: 1, status: "Spam", isDeleted: false },
      { customerName: "Rejected User", comment: "Bad!", rating: 2, status: "Rejected", isDeleted: false },
      { customerName: "Deleted User", comment: "Old comment", rating: 5, status: "Approved", isDeleted: true }
    ];

    const { structuredData } = resolveSEOMetadata({
      entity: mockProduct,
      type: "product",
      path: "/product/seo-test",
      reviews: mockReviews
    });

    expect(structuredData).toBeDefined();
    const productSchema = structuredData["@graph"] 
      ? structuredData["@graph"].find(x => x["@type"] === "Product")
      : structuredData;
    expect(productSchema.review).toBeDefined();
    
    // Should only contain 1 review (the Approved User)
    expect(productSchema.review.length).toBe(1);
    expect(productSchema.review[0].author.name).toBe("Approved User");
    expect(productSchema.review[0].reviewBody).toBe("Great!");
  });
});
