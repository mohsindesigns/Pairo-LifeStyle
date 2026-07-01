/**
 * Public Artwork Upload Endpoint
 * Used by the Customize Product form to upload logos/artwork files
 * without requiring admin authentication.
 *
 * Supports: PNG, JPG, JPEG, SVG, PDF, AI, EPS, WebP
 * Max size: 10 MB per file
 */

import { NextResponse } from "next/server";
import { uploadToStorage } from "@/lib/storage";

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
  "application/pdf",
  // AI and EPS come through as these MIME types in browsers
  "application/postscript",
  "application/illustrator",
  // Some browsers send AI/EPS as octet-stream
  "application/octet-stream",
];

const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg", ".pdf", ".ai", ".eps", ".webp"];

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    // Check extension
    const ext = ("." + file.name.split(".").pop()).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `File type "${ext}" is not supported. Allowed: PNG, JPG, SVG, PDF, AI, EPS.` },
        { status: 400 }
      );
    }

    // Check size
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB allowed.` },
        { status: 400 }
      );
    }

    // Read buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to storage (Cloudinary or local fallback)
    const stored = await uploadToStorage(buffer, file.name, "pairo-artwork");

    return NextResponse.json(
      {
        success: true,
        url: stored.url,
        name: file.name,
        publicId: stored.publicId || null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[Artwork Upload Error]", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
