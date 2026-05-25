import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Review from "@/models/Review";
import Product from "@/models/Product";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import mongoose from "mongoose";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(session.user, "reviews.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    
    // Filters
    const status = searchParams.get("status"); // Pending, Approved, Rejected, Spam, Featured
    const rating = searchParams.get("rating");
    const productId = searchParams.get("productId");
    const search = searchParams.get("search");

    await dbConnect();

    const query = { isDeleted: { $ne: true } };

    if (status) {
      if (status === "Featured") {
        query.isFeatured = true;
      } else {
        query.status = status;
      }
    }
    if (rating) {
      query.rating = parseInt(rating);
    }
    if (productId && mongoose.isValidObjectId(productId)) {
      query.productId = new mongoose.Types.ObjectId(productId);
    }
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: "i" } },
        { customerEmail: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
        { comment: { $regex: search, $options: "i" } }
      ];
    }

    const total = await Review.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // Fetch reviews and populate Product info
    const reviews = await Review.find(query)
      .populate({
        path: "productId",
        select: "name slug images image price"
      })
      .sort({ createdAt: -1 })
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
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Moderate/Delete action requires reviews.moderate
    if (!can(session.user, "reviews.moderate")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { ids, action } = body; // ids: Array, action: 'approve' | 'reject' | 'spam' | 'delete'

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No review IDs provided" }, { status: 400 });
    }

    if (!["approve", "reject", "spam", "delete"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await dbConnect();

    // Fetch reviews to get productIds before updating (needed for aggregations)
    const reviewsToUpdate = await Review.find({ _id: { $in: ids } }).select("productId").lean();
    const productIdsToReaggregate = [...new Set(reviewsToUpdate.map(r => r.productId.toString()))];

    let updateDoc = {};
    if (action === "approve") {
      updateDoc = { status: "Approved" };
    } else if (action === "reject") {
      updateDoc = { status: "Rejected" };
    } else if (action === "spam") {
      updateDoc = { status: "Spam" };
    } else if (action === "delete") {
      updateDoc = { isDeleted: true };
    }

    const result = await Review.updateMany(
      { _id: { $in: ids } },
      { $set: updateDoc }
    );

    // Trigger aggregations for all affected products
    const { aggregateProductRatings } = await import("@/lib/review-aggregator");
    for (const prodId of productIdsToReaggregate) {
      await aggregateProductRatings(prodId);
    }

    // Log the audit event
    await logAction(req, session, `BULK_${action.toUpperCase()}_REVIEWS`, "reviews", {
      affectedCount: result.modifiedCount,
      ids,
      message: `Bulk ${action} executed on ${result.modifiedCount} reviews`
    });

    return NextResponse.json({
      success: true,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
