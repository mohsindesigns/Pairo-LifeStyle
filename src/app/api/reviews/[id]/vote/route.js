import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Review from "@/models/Review";
import crypto from "crypto";

export async function POST(req, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const body = await req.json();
    const { type } = body; // "helpful" or "unhelpful"

    if (type !== "helpful" && type !== "unhelpful") {
      return NextResponse.json({ error: "Invalid vote type" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for") || req.ip || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Hash user fingerprint to prevent double voting
    const voterFingerprint = crypto
      .createHash("sha256")
      .update(`${ip}-${userAgent}`)
      .digest("hex");

    await dbConnect();

    const review = await Review.findById(id);
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (review.voters.includes(voterFingerprint)) {
      return NextResponse.json({ error: "You have already voted on this review" }, { status: 400 });
    }

    // Add voter hash and increment vote count
    review.voters.push(voterFingerprint);
    if (type === "helpful") {
      review.helpfulVotes += 1;
    } else {
      review.unhelpfulVotes += 1;
    }

    await review.save();

    return NextResponse.json({
      success: true,
      helpfulVotes: review.helpfulVotes,
      unhelpfulVotes: review.unhelpfulVotes
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
