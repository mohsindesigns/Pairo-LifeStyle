import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Review from "@/models/Review";
import Product from "@/models/Product";

// Public feed for the floating Reviews sidebar: every approved, verified-purchase review across all products.
// Only fields that are safe to show publicly are returned (no email, IP or internal ids).
export const revalidate = 300;

export async function GET() {
  try {
    await dbConnect();
    const reviews = await Review.find({
      status: "Approved",
      verifiedPurchase: true,
      isDeleted: { $ne: true },
      shadowBanned: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(300)
      .select("rating title comment customerName createdAt productId media")
      .lean();

    const ids = [...new Set(reviews.map((r) => String(r.productId)))];
    const products = await Product.find({ _id: { $in: ids }, isDeleted: { $ne: true } }).select("name").lean();
    const names = new Map(products.map((p) => [String(p._id), p.name]));

    return NextResponse.json({
      reviews: reviews.map((r) => ({
        id: String(r._id),
        name: r.customerName,
        rating: r.rating,
        title: r.title || "",
        text: r.comment || "",
        date: r.createdAt,
        product: names.get(String(r.productId)) || "",
        image: (r.media || []).find((m) => m.type === "image")?.url || "",
      })),
    });
  } catch (e) {
    console.error("[reviews/verified]", e);
    return NextResponse.json({ reviews: [] });
  }
}
