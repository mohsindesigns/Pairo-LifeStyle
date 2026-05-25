import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Review from "@/models/Review";

export async function POST(req, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    await dbConnect();

    const review = await Review.findById(id);
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    review.reported = true;
    review.reportsCount += 1;

    // If a review gets reported heavily (e.g. 5+ times), auto-revert its status to Pending for re-moderation
    if (review.reportsCount >= 5 && review.status === "Approved") {
      review.status = "Pending";
      
      // We will need to re-aggregate product rating because it's no longer approved
      const { aggregateProductRatings } = await import("@/lib/review-aggregator");
      await review.save();
      await aggregateProductRatings(review.productId);
    } else {
      await review.save();
    }

    return NextResponse.json({
      success: true,
      message: "Review reported successfully"
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
