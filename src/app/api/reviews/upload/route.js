import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { uploadToStorage } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rateLimit";
import { sniffReviewMedia, MAX_REVIEW_VIDEO_BYTES, MAX_REVIEW_IMAGE_BYTES } from "@/lib/reviewMedia";

/**
 * Public upload for the photo / video a customer attaches to a product review.
 * One file per request. The file is stored, but it only ever appears on the site once an admin has approved the review
 * it is attached to.
 */
export async function POST(req) {
  try {
    const rate = await checkRateLimit(req, { limit: 6, window: 600, keyPrefix: "REVIEW_UPLOAD" });
    if (!rate.success) {
      return NextResponse.json({ error: "You are uploading too fast. Please wait a few minutes and try again." }, { status: 429 });
    }

    const formData = await req.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (file.size > MAX_REVIEW_VIDEO_BYTES) {
      return NextResponse.json({ error: `The file is too large (${(file.size / 1048576).toFixed(1)} MB). Videos can be up to 20 MB, photos up to 5 MB.` }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = sniffReviewMedia(buffer); // what the file REALLY is, whatever its name says
    if (!kind) {
      return NextResponse.json({ error: "Please choose a video (MP4, MOV or WebM) or a photo (JPG, PNG or WebP)." }, { status: 400 });
    }
    if (kind.type === "image" && buffer.length > MAX_REVIEW_IMAGE_BYTES) {
      return NextResponse.json({ error: "Photos can be up to 5 MB." }, { status: 413 });
    }

    // Our own file name: the customer's file name is never used on the server.
    const stored = await uploadToStorage(buffer, `review-${randomBytes(6).toString("hex")}.${kind.ext}`, "pairo-reviews");
    return NextResponse.json({ success: true, url: stored.url, type: kind.type }, { status: 201 });
  } catch (err) {
    console.error("[Review Upload Error]", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
