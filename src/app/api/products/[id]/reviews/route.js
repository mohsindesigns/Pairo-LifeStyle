import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import Review from "@/models/Review";
import Order from "@/models/Order";
import { sanitizeText, sanitizeObject } from "@/lib/sanitize";
import mongoose from "mongoose";

/**
 * Spam Scoring Engine
 * Evaluates suspicious metadata and patterns to auto-flag spam reviews.
 */
function calculateSpamScore(title, comment) {
  let score = 0;
  const text = `${title || ""} ${comment || ""}`;

  // 1. Link Check: links are very spammy
  if (/https?:\/\/[^\s]+/i.test(text)) {
    score += 5;
  }

  // 2. Excessive Caps lock
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 10) {
    const caps = letters.replace(/[^A-Z]/g, "");
    if (caps.length / letters.length > 0.7) {
      score += 3;
    }
  }

  // 3. Repeated Characters (e.g. "soooooooo good!!!!!!!")
  if (/(.)\1{4,}/.test(text)) {
    score += 2;
  }

  // 4. Profanity / Blacklisted words
  const blacklisted = ["spam", "buy", "discount", "cheap", "pills", "viagra", "casino", "free", "url", "click"];
  const words = text.toLowerCase().split(/\s+/);
  const hits = words.filter(w => blacklisted.includes(w));
  if (hits.length > 0) {
    score += hits.length * 2;
  }

  return score;
}

export async function GET(req, { params }) {
  try {
    const resolvedParams = await params;
    const { id: paramId } = resolvedParams;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 5;
    const sortType = searchParams.get("sort") || "newest"; // newest, highest_rated, lowest_rated, most_helpful
    const cursor = searchParams.get("cursor"); // Base64 encoded cursor

    await dbConnect();

    const product = await Product.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(paramId) ? paramId : null },
        { id: /^\d+$/.test(paramId) ? parseInt(paramId) : -1 },
        { slug: paramId }
      ]
    }).select("_id rating reviewCount ratingBreakdown name").lean();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    let sort = { createdAt: -1 };
    if (sortType === "highest_rated") {
      sort = { rating: -1, createdAt: -1 };
    } else if (sortType === "lowest_rated") {
      sort = { rating: 1, createdAt: -1 };
    } else if (sortType === "most_helpful") {
      sort = { helpfulVotes: -1, createdAt: -1 };
    }

    // Base query for approved reviews
    const query = {
      productId: product._id,
      status: "Approved",
      isDeleted: { $ne: true }
    };

    // Calculate total count for statistics
    const total = await Review.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // Apply cursor-based pagination query override if present
    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
        if (sortType === "newest") {
          query.createdAt = { $lt: new Date(decoded.createdAt) };
        } else if (sortType === "highest_rated") {
          query.$or = [
            { rating: { $lt: decoded.rating } },
            { rating: decoded.rating, createdAt: { $lt: new Date(decoded.createdAt) } }
          ];
        } else if (sortType === "lowest_rated") {
          query.$or = [
            { rating: { $gt: decoded.rating } },
            { rating: decoded.rating, createdAt: { $lt: new Date(decoded.createdAt) } }
          ];
        } else if (sortType === "most_helpful") {
          query.$or = [
            { helpfulVotes: { $lt: decoded.helpfulVotes } },
            { helpfulVotes: decoded.helpfulVotes, createdAt: { $lt: new Date(decoded.createdAt) } }
          ];
        }
      } catch (err) {
        console.error("Cursor decoding error:", err);
      }
    }

    const reviewsQuery = Review.find(query).sort(sort);
    if (!cursor) {
      reviewsQuery.skip((page - 1) * limit);
    }

    const reviews = await reviewsQuery.limit(limit).lean();

    let nextCursor = null;
    if (reviews.length === limit) {
      const lastReview = reviews[reviews.length - 1];
      const nextObj = {
        _id: lastReview._id.toString(),
        createdAt: lastReview.createdAt,
        rating: lastReview.rating,
        helpfulVotes: lastReview.helpfulVotes
      };
      nextCursor = Buffer.from(JSON.stringify(nextObj)).toString("base64");
    }

    return NextResponse.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        nextCursor
      },
      stats: {
        rating: product.rating || 0,
        reviewCount: product.reviewCount || 0,
        ratingBreakdown: product.ratingBreakdown || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const body = sanitizeObject(rawBody);
    const resolvedParams = await params;
    const { id: paramId } = resolvedParams;

    const session = await getServerSession(authOptions);
    const { rating, title, comment, customerName, recommend, guestEmail, orderNumber, status: customStatus } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Invalid rating value (must be between 1 and 5)" }, { status: 400 });
    }

    if (!customerName || customerName.trim() === "") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    await dbConnect();

    // 1. Fetch the Product
    const product = await Product.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(paramId) ? paramId : null },
        { id: /^\d+$/.test(paramId) ? parseInt(paramId) : -1 },
        { slug: paramId }
      ]
    }).select("_id name").lean();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const checkEmail = session ? session.user.email?.toLowerCase().trim() : (guestEmail?.toLowerCase().trim() || "guest@example.com");

    const ip = req.headers.get("x-forwarded-for") || req.ip || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // 2. Spam scoring check
    const spamScore = calculateSpamScore(title, comment);
    const isSpam = spamScore >= 5;

    // 3. Profanity Masking & Anti-XSS Sanitization
    const { siteConfig } = await import("@/config/siteConfig");
    const profanityList = siteConfig.reviews?.profanityList || [];
    const maskProfanity = (text) => {
      if (!text) return "";
      let masked = text;
      profanityList.forEach(word => {
        const regex = new RegExp(`\\b\\w*${word}\\w*\\b`, "gi");
        masked = masked.replace(regex, (match) => "*".repeat(match.length));
      });
      return masked;
    };

    const sanitizedTitle = maskProfanity(sanitizeText(title || ""));
    const sanitizedComment = maskProfanity(sanitizeText(comment || ""));

    // 4. Review Creation (allows approved direct status or pending)
    const reviewStatus = customStatus || (isSpam ? "Spam" : "Approved");

    const review = await Review.create({
      tenantId: "DEFAULT_STORE",
      productId: product._id,
      customerId: session ? session.user.id : null,
      orderId: new mongoose.Types.ObjectId(),
      rating,
      title: sanitizedTitle,
      comment: sanitizedComment,
      customerName: sanitizeText(customerName.trim()),
      customerEmail: checkEmail,
      status: reviewStatus,
      recommend: recommend !== false,
      verifiedPurchase: true,
      ipAddress: ip,
      userAgent,
      spamScore
    });

    // Automatically update product aggregated ratings if Approved
    if (reviewStatus === "Approved") {
      try {
        const { aggregateProductRatings } = await import("@/lib/review-aggregator");
        await aggregateProductRatings(product._id);
      } catch (aggErr) {
        console.error("Aggregation error:", aggErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Review created successfully.",
      review
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const rawBody = await req.json().catch(() => ({}));
    const body = sanitizeObject(rawBody);
    const { reviewId, rating, title, comment, recommend, guestEmail, orderNumber } = body;

    if (!reviewId || !mongoose.isValidObjectId(reviewId)) {
      return NextResponse.json({ error: "Invalid review ID" }, { status: 400 });
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Invalid rating value (must be between 1 and 5)" }, { status: 400 });
    }

    await dbConnect();

    const review = await Review.findById(reviewId);
    if (!review || review.isDeleted) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // 1. Verify Ownership if customer
    if (session && session.user.role !== "Admin") {
      const isOwner = review.customerId?.toString() === session.user.id ||
        review.customerEmail?.toLowerCase() === session.user.email?.toLowerCase();
      if (!isOwner) {
        return NextResponse.json({ error: "Unauthorized. You do not own this review." }, { status: 403 });
      }
    }

    // 2. Profanity Masking & Sanitization
    const { siteConfig } = await import("@/config/siteConfig");
    const profanityList = siteConfig.reviews?.profanityList || [];
    const maskProfanity = (text) => {
      if (!text) return "";
      let masked = text;
      profanityList.forEach(word => {
        const regex = new RegExp(`\\b\\w*${word}\\w*\\b`, "gi");
        masked = masked.replace(regex, (match) => "*".repeat(match.length));
      });
      return masked;
    };

    const spamScore = calculateSpamScore(title, comment);
    const sanitizedTitle = maskProfanity(sanitizeText(title || ""));
    const sanitizedComment = maskProfanity(sanitizeText(comment || ""));

    review.rating = rating;
    review.title = sanitizedTitle;
    review.comment = sanitizedComment;
    review.recommend = recommend !== false;
    review.spamScore = spamScore;

    await review.save();

    // Recalculate aggregates
    try {
      const { aggregateProductRatings } = await import("@/lib/review-aggregator");
      await aggregateProductRatings(review.productId);
    } catch (aggErr) {
      console.error("Aggregation error:", aggErr);
    }

    return NextResponse.json({
      success: true,
      message: "Review updated successfully.",
      review
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
