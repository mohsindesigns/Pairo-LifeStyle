import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import Review from "@/models/Review";
import Order from "@/models/Order";
import mongoose from "mongoose";

/**
 * Spam Scoring Engine
 * Evaluates suspicious metadata and patterns to auto-flag spam reviews.
 */
function calculateSpamScore(title, comment, ipCount) {
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

  // 4. Repeated IP address count in last 24h
  if (ipCount > 5) {
    score += 4;
  }

  // 5. Profanity / Blacklisted words
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
        // Cursor structure: { _id, createdAt, rating, helpfulVotes }
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

    // Fetch reviews
    const reviewsQuery = Review.find(query).sort(sort);
    
    // If cursor pagination is used, we do not skip, we just limit
    if (!cursor) {
      reviewsQuery.skip((page - 1) * limit);
    }
    
    const reviews = await reviewsQuery.limit(limit).lean();

    // Generate next cursor
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
    const resolvedParams = await params;
    const { id: paramId } = resolvedParams;

    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { rating, title, comment, customerName, recommend, guestEmail, orderNumber } = body;

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

    // 2. Verified Purchase Eligibility Check (Strictly Delivered, Completed, or Paid)
    const orderQuery = {
      tenantId: 'DEFAULT_STORE',
      "items.productId": product._id,
      status: { $nin: ['Cancelled', 'Refunded'] },
      $and: [
        {
          $or: [
            { status: 'Delivered' },
            { status: 'Completed' },
            { "payment.status": 'Paid' }
          ]
        }
      ]
    };

    if (session) {
      orderQuery.$and.push({
        $or: [
          { "customer.userId": session.user.id },
          { "customer.email": session.user.email?.toLowerCase() }
        ]
      });
    } else {
      // Guest Verification
      if (!guestEmail || !orderNumber) {
        return NextResponse.json({ error: "Order verification details (Email + Order Number) are required to verify your purchase." }, { status: 400 });
      }
      orderQuery["customer.email"] = guestEmail.toLowerCase().trim();
      orderQuery.orderNumber = orderNumber.trim();
    }

    const order = await Order.findOne(orderQuery).lean();
    if (!order) {
      return NextResponse.json({ 
        error: "Verified Purchase Required. Reviews are only allowed for delivered or paid purchases." 
      }, { status: 403 });
    }

    const checkEmail = session ? session.user.email?.toLowerCase().trim() : guestEmail.toLowerCase().trim();

    // 3. Duplicate Review Prevention
    const { siteConfig } = await import("@/config/siteConfig");
    const limitByEmail = siteConfig.reviews?.limitByEmail !== false;

    if (limitByEmail) {
      const existingEmailReview = await Review.findOne({
        productId: product._id,
        customerEmail: checkEmail,
        isDeleted: { $ne: true }
      });
      if (existingEmailReview) {
        return NextResponse.json({ error: "You have already submitted a review for this product." }, { status: 400 });
      }
    } else {
      const existingReview = await Review.findOne({
        productId: product._id,
        orderId: order._id,
        isDeleted: { $ne: true }
      });
      if (existingReview) {
        return NextResponse.json({ error: "A review has already been submitted for this product from this order." }, { status: 400 });
      }
    }

    // 4. Anti-Abuse Rate Limiting
    const ip = req.headers.get("x-forwarded-for") || req.ip || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const crypto = await import("crypto");
    const fingerprint = crypto.createHash("sha256").update(ip + userAgent).digest("hex");

    const cooldownPeriod = 10 * 60 * 1000; // 10-minute Cooldown
    const recentReview = await Review.findOne({
      $or: [
        { ipAddress: ip },
        { customerEmail: checkEmail },
        { fingerprint: fingerprint }
      ],
      createdAt: { $gte: new Date(Date.now() - cooldownPeriod) }
    });
    if (recentReview) {
      return NextResponse.json({ error: "You are submitting reviews too frequently. Please wait a few minutes." }, { status: 429 });
    }

    // IP Submission count in last 24h
    const ipCount24h = await Review.countDocuments({
      ipAddress: ip,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    // 5. Spam scoring engine checks
    const spamScore = calculateSpamScore(title, comment, ipCount24h);
    const isSpam = spamScore >= 5;

    // 6. Silent Shadow-Banning check
    const ShadowBan = (await import("@/models/ShadowBan")).default;
    const shadowBanDoc = await ShadowBan.findOne({
      value: { $in: [checkEmail, ip] }
    });
    const isShadowBanned = !!shadowBanDoc;

    // 7. Profanity Masking
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

    const sanitizedTitle = maskProfanity((title || "").replace(/<\/?[^>]+(>|$)/g, "").trim());
    const sanitizedComment = maskProfanity((comment || "").replace(/<\/?[^>]+(>|$)/g, "").trim());

    // 8. Review Creation (Shadow-banned reviews silently enter Spam status)
    const reviewStatus = (isShadowBanned || isSpam) ? "Spam" : "Pending";

    const review = await Review.create({
      tenantId: "DEFAULT_STORE",
      productId: product._id,
      customerId: session ? session.user.id : null,
      orderId: order._id,
      rating,
      title: sanitizedTitle,
      comment: sanitizedComment,
      customerName: customerName.trim(),
      customerEmail: checkEmail,
      status: reviewStatus,
      recommend: recommend !== false,
      verifiedPurchase: true,
      ipAddress: ip,
      userAgent,
      spamScore,
      fingerprint,
      shadowBanned: isShadowBanned
    });

    return NextResponse.json({
      message: (isSpam || isShadowBanned)
        ? "Your review has been submitted successfully and is pending approval." // Silent return
        : "Your review has been submitted successfully and is pending approval.",
      review
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const resolvedParams = await params;
    const { id: paramId } = resolvedParams;

    const session = await getServerSession(authOptions);
    const body = await req.json();
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

    // 1. Verify Ownership
    if (session) {
      const isOwner = review.customerId?.toString() === session.user.id || 
                      review.customerEmail?.toLowerCase() === session.user.email?.toLowerCase();
      if (!isOwner) {
        return NextResponse.json({ error: "Unauthorized. You do not own this review." }, { status: 403 });
      }
    } else {
      if (!guestEmail || !orderNumber) {
        return NextResponse.json({ error: "Order details are required to verify ownership." }, { status: 400 });
      }
      
      const order = await Order.findOne({
        orderNumber: orderNumber.trim(),
        "customer.email": guestEmail.toLowerCase().trim()
      }).lean();

      if (!order || order._id.toString() !== review.orderId.toString()) {
        return NextResponse.json({ error: "Unauthorized. Guest checkout details do not match." }, { status: 403 });
      }
    }

    // 2. Check Editing Window
    const { siteConfig } = await import("@/config/siteConfig");
    const editingWindowDays = siteConfig.reviews?.editingWindowDays || 30;
    const diffDays = (Date.now() - new Date(review.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > editingWindowDays) {
      return NextResponse.json({ error: `The editing window of ${editingWindowDays} days has expired for this review.` }, { status: 400 });
    }

    // 3. Profanity Masking
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

    const ip = req.headers.get("x-forwarded-for") || req.ip || "127.0.0.1";
    const ipCount24h = await Review.countDocuments({
      ipAddress: ip,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    const spamScore = calculateSpamScore(title, comment, ipCount24h);
    const isSpam = spamScore >= 5;

    const sanitizedTitle = maskProfanity((title || "").replace(/<\/?[^>]+(>|$)/g, "").trim());
    const sanitizedComment = maskProfanity((comment || "").replace(/<\/?[^>]+(>|$)/g, "").trim());

    const wasApproved = review.status === "Approved";

    // Update review content and reset status to Pending
    review.rating = rating;
    review.title = sanitizedTitle;
    review.comment = sanitizedComment;
    review.recommend = recommend !== false;
    review.status = isSpam ? "Spam" : "Pending";
    review.spamScore = spamScore;

    await review.save();

    // 4. Recalculate aggregates if status was Approved (now Pending/Spam)
    if (wasApproved) {
      const { aggregateProductRatings } = await import("@/lib/review-aggregator");
      await aggregateProductRatings(review.productId);
    }

    return NextResponse.json({
      message: isSpam 
        ? "Review edited successfully, but flagged by our filters and is pending moderation."
        : "Review edited successfully and is pending moderation approval.",
      review
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
