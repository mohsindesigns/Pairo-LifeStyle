import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Review from "@/models/Review";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";

export async function PUT(req, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(session.user, "reviews.moderate")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { status, isFeatured, replyComment } = body;

    await dbConnect();

    const review = await Review.findById(id);
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const beforeState = JSON.parse(JSON.stringify(review));

    // Update status
    if (status && ["Pending", "Approved", "Rejected", "Spam"].includes(status)) {
      review.status = status;
    }

    // Update featured state
    if (typeof isFeatured === "boolean") {
      review.isFeatured = isFeatured;
    }

    // Append/update admin reply
    if (typeof replyComment === "string") {
      if (replyComment.trim() === "") {
        // Clear replies
        review.replies = [];
      } else {
        // Replace or add single admin reply
        review.replies = [{
          staffId: session.user.id,
          staffName: session.user.name || "Admin",
          comment: replyComment.trim(),
          createdAt: new Date()
        }];
      }
    }

    await review.save();

    // Trigger re-aggregation for product ratings
    const { aggregateProductRatings } = await import("@/lib/review-aggregator");
    await aggregateProductRatings(review.productId);

    // Audit log
    await logAction(req, session, "MODERATE_REVIEW", "reviews", {
      before: beforeState,
      after: review,
      message: `Moderated review ID: ${review._id} - Status: ${review.status}, Featured: ${review.isFeatured}`
    });

    return NextResponse.json({ success: true, review });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(session.user, "reviews.moderate")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const review = await Review.findById(id);
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const beforeState = JSON.parse(JSON.stringify(review));

    // Soft delete
    review.isDeleted = true;
    await review.save();

    // Trigger re-aggregation for product ratings
    const { aggregateProductRatings } = await import("@/lib/review-aggregator");
    await aggregateProductRatings(review.productId);

    // Audit log
    await logAction(req, session, "DELETE_REVIEW", "reviews", {
      before: beforeState,
      after: review,
      message: `Soft-deleted review ID: ${review._id}`
    });

    return NextResponse.json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
