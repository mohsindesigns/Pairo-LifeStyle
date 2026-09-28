import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import GalleryItem from "@/models/GalleryItem";

/**
 * GET /api/gallery/items
 * Public endpoint — returns all enabled gallery items, with product slug populated.
 */
export async function GET() {
  try {
    await dbConnect();

    const items = await GalleryItem
      .find({ enabled: true })
      .populate("linkedProduct", "slug name") // Only fetch slug and name from Product
      .sort({ order: 1, createdAt: -1 })
      .lean();

    // Normalize output — resolve product slug
    const normalized = items.map(item => ({
      _id: item._id,
      image: item.image,
      title: item.title,
      description: item.description || "",
      linkedProductId: item.linkedProduct?._id || null,
      linkedProductSlug: item.linkedProduct?.slug || null,
      linkedProductName: item.linkedProduct?.name || null,
      order: item.order
    }));

    return NextResponse.json(normalized);
  } catch (err) {
    console.error("[Gallery Items GET Error]", err);
    return NextResponse.json([]);
  }
}
