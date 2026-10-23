import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Review from "@/models/Review";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import mongoose from "mongoose";

const notFound = () => NextResponse.json({ error: "Review not found" }, { status: 404 });

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

    if (!mongoose.isValidObjectId(id)) return notFound();
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

    if (!mongoose.isValidObjectId(id)) return notFound();
    const body = await req.json().catch(() => ({}));
    const { status, isFeatured, replyComment, restore, customerName, customerEmail, rating, title, comment, createdAt } = body;

    await dbConnect();

    const review = await Review.findById(id);
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const beforeState = JSON.parse(JSON.stringify(review));

    // Update restore state
    if (restore === true) {
      review.isDeleted = false;
      review.deletedAt = null;
      review.status = "Pending";
    }

    // Validate edited fields up front so a bad value returns a clear message, not a 500
    if (rating !== undefined) {
      const r = Number(rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        return NextResponse.json({ error: "Rating must be a whole number from 1 to 5." }, { status: 400 });
      }
    }
    if (customerName !== undefined && !String(customerName).trim()) {
      return NextResponse.json({ error: "Author name is required." }, { status: 400 });
    }
    if (customerEmail !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customerEmail).trim())) {
      return NextResponse.json({ error: "Enter a valid author email." }, { status: 400 });
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
      review.customerName = String(customerName).trim();
    }
    if (customerEmail !== undefined) {
      review.customerEmail = String(customerEmail).trim();
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
    if (createdAt !== undefined) {
      const parsedDate = new Date(createdAt);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }
      // Mongoose's auto-generated `createdAt` (from timestamps: true) is immutable by default -
      // a plain assignment is silently dropped on save. overwriteImmutable explicitly allows it.
      review.$set("createdAt", parsedDate, undefined, { overwriteImmutable: true });
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
    if (review.productId) {
      const { aggregateProductRatings } = await import("@/lib/review-aggregator");
      await aggregateProductRatings(review.productId);
    }

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

    if (!mongoose.isValidObjectId(id)) return notFound();
    await dbConnect();

    const review = await Review.findById(id);
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const beforeState = JSON.parse(JSON.stringify(review));

    // ?mode=trash only ever moves a review to the Trash (never deletes), ?mode=permanent only ever deletes one that is
    // already there. Without a mode the older "toggle" behaviour stays for existing callers: a live review is trashed,
    // a trashed one is deleted. The Reviews screen and the Trash page send an explicit mode, so a stale click on
    // "Move to Trash" can no longer destroy a review that someone else already trashed.
    const mode = new URL(req.url).searchParams.get("mode");
    if (mode === "permanent" && !review.isDeleted) {
      return NextResponse.json({ error: "Move the review to the Trash before deleting it permanently." }, { status: 409 });
    }
    if (mode === "trash" && review.isDeleted) {
      return NextResponse.json({ success: true, message: "Review is already in the Trash" });
    }

    if (review.isDeleted === true) {
      // Permanent delete
      await Review.findByIdAndDelete(id);

      // Trigger re-aggregation for product ratings
      if (review.productId) {
        const { aggregateProductRatings } = await import("@/lib/review-aggregator");
        await aggregateProductRatings(review.productId);
      }

      // Audit log (with resourceId parameter)
      await logAction(req, session, "PERMANENT_DELETE_REVIEW", "reviews", {
        before: beforeState,
        message: `Permanently deleted review ID: ${review._id}`
      }, review._id);

      return NextResponse.json({ success: true, message: "Review permanently deleted successfully" });
    } else {
      // Soft delete
      review.isDeleted = true;
      review.deletedAt = new Date();
      await review.save();

      // Trigger re-aggregation for product ratings
      if (review.productId) {
        const { aggregateProductRatings } = await import("@/lib/review-aggregator");
        await aggregateProductRatings(review.productId);
      }

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
