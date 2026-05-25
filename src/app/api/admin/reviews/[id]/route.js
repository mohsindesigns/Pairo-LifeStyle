import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Review from "@/models/Review";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";

export async function GET(req, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(session.user, "reviews.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const review = await Review.findById(id).populate({
      path: "productId",
      select: "name slug images image price"
    }).lean();

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Fetch audit logs for this specific review to construct moderation timeline
    const AuditLog = (await import("@/models/AuditLog")).default;
    const timeline = await AuditLog.find({
      resource: "reviews",
      $or: [
        { resourceId: id },
        { "details.ids": id },
        { "details.before._id": id }
      ]
    }).populate({
      path: "staffId",
      select: "name email"
    }).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ review, timeline });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
    const { status, isFeatured, replyComment, restore, customerName, customerEmail, rating, title, comment } = body;

    await dbConnect();

    const review = await Review.findById(id);
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const beforeState = JSON.parse(JSON.stringify(review));

    // Update restore state
    if (restore === true) {
      review.isDeleted = false;
      review.status = "Pending";
    }

    // Update status
    if (status && ["Pending", "Approved", "Rejected", "Spam"].includes(status)) {
      review.status = status;
    }

    // Update featured state
    if (typeof isFeatured === "boolean") {
      review.isFeatured = isFeatured;
    }

    // Update author and review details (Quick Edit)
    if (customerName !== undefined) {
      review.customerName = customerName;
    }
    if (customerEmail !== undefined) {
      review.customerEmail = customerEmail;
    }
    if (rating !== undefined) {
      review.rating = parseInt(rating);
    }
    if (title !== undefined) {
      review.title = title;
    }
    if (comment !== undefined) {
      review.comment = comment;
    }

    // Append/update admin reply
    if (typeof replyComment === "string") {
      if (replyComment.trim() === "") {
        review.replies = [];
      } else {
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

    // Audit log (with resourceId parameter)
    await logAction(req, session, "MODERATE_REVIEW", "reviews", {
      before: beforeState,
      after: review,
      message: `Moderated/Edited review ID: ${review._id} - Status: ${review.status}, Featured: ${review.isFeatured}`
    }, review._id);

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

    if (review.isDeleted === true) {
      // Permanent delete
      await Review.findByIdAndDelete(id);

      // Trigger re-aggregation for product ratings
      const { aggregateProductRatings } = await import("@/lib/review-aggregator");
      await aggregateProductRatings(review.productId);

      // Audit log (with resourceId parameter)
      await logAction(req, session, "PERMANENT_DELETE_REVIEW", "reviews", {
        before: beforeState,
        message: `Permanently deleted review ID: ${review._id}`
      }, review._id);

      return NextResponse.json({ success: true, message: "Review permanently deleted successfully" });
    } else {
      // Soft delete
      review.isDeleted = true;
      await review.save();

      // Trigger re-aggregation for product ratings
      const { aggregateProductRatings } = await import("@/lib/review-aggregator");
      await aggregateProductRatings(review.productId);

      // Audit log (with resourceId parameter)
      await logAction(req, session, "DELETE_REVIEW", "reviews", {
        before: beforeState,
        after: review,
        message: `Soft-deleted review ID: ${review._id}`
      }, review._id);

      return NextResponse.json({ success: true, message: "Review moved to trash successfully" });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
