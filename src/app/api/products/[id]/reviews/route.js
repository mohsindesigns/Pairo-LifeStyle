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

    await dbConnect();

    const product = await Product.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(paramId) ? paramId : null },
        { id: parseInt(paramId) || -1 },
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

    const query = {
      productId: product._id,
      status: "Approved",
      isDeleted: { $ne: true }
    };

    const total = await Review.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const reviews = await Review.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages
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
    const { rating, title, comment, customerName, customerEmail, recommend, guestEmail, orderNumber } = body;

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
        { id: parseInt(paramId) || -1 },
        { slug: paramId }
      ]
    }).select("_id name").lean();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 2. Verified Purchase Eligibility Check
    const orderQuery = {
      tenantId: 'DEFAULT_STORE',
      "items.productId": product._id,
      status: { $in: ['Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'] }
    };

    if (session) {
      orderQuery.$or = [
        { "customer.userId": session.user.id },
        { "customer.email": session.user.email?.toLowerCase() }
      ];
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
        error: "Verified Purchase Required. We couldn't verify that this item was purchased under a valid account or guest order." 
      }, { status: 403 });
    }

    // 3. Duplicate Review Prevention per Product per Order
    const existingReview = await Review.findOne({
      productId: product._id,
      orderId: order._id,
      isDeleted: { $ne: true }
    });
    if (existingReview) {
      return NextResponse.json({ error: "A review has already been submitted for this product from this order." }, { status: 400 });
    }

    // 4. Anti-Abuse Rate Limiting
    const ip = req.headers.get("x-forwarded-for") || req.ip || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // 10-minute Cooldown per IP
    const recentReviewByIp = await Review.findOne({
      ipAddress: ip,
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
    });
    if (recentReviewByIp) {
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

    // 6. XSS Sanitization & Creation
    const sanitizedTitle = (title || "").replace(/<\/?[^>]+(>|$)/g, "").trim();
    const sanitizedComment = (comment || "").replace(/<\/?[^>]+(>|$)/g, "").trim();

    const review = await Review.create({
      tenantId: "DEFAULT_STORE",
      productId: product._id,
      customerId: session ? session.user.id : null,
      orderId: order._id,
      rating,
      title: sanitizedTitle,
      comment: sanitizedComment,
      customerName: customerName.trim(),
      customerEmail: session ? session.user.email : guestEmail.toLowerCase().trim(),
      status: isSpam ? "Spam" : "Pending",
      recommend: recommend !== false,
      verifiedPurchase: true,
      ipAddress: ip,
      userAgent
    });

    return NextResponse.json({
      message: isSpam 
        ? "Your review was submitted, but flagged by our spam engine and is in moderation." 
        : "Your review has been submitted successfully and is pending approval.",
      review
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
