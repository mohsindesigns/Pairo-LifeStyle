import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Review from "@/models/Review";
import crypto from "crypto";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    const { success } = await checkRateLimit(req, { limit: 5, window: 3600, keyPrefix: "REVIEW_REPORT" });
    if (!success) {
      return NextResponse.json({ error: "Too many reports. Please try again later." }, { status: 429 });
    }

    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "unknown";
    const reporterFingerprint = crypto
      .createHash("sha256")
      .update(`${ip}-${userAgent}`)
      .digest("hex");

    await dbConnect();

    const review = await Review.findById(id);
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (review.reporters.includes(reporterFingerprint)) {
      return NextResponse.json({ error: "You have already reported this review" }, { status: 400 });
    }

    review.reporters.push(reporterFingerprint);
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
