import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import GalleryItem from "@/models/GalleryItem";
import { can } from "@/lib/rbac";
import { galleryListQuery } from "./helpers";

// GET /api/admin/gallery-items[?view=all|visible|hidden|trash][&counts=true]
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "pages.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const { searchParams } = new URL(req.url);

    if (searchParams.get("counts") === "true") {
      const [all, visible, hidden, trash] = await Promise.all(
        ["all", "visible", "hidden", "trash"].map((v) => GalleryItem.countDocuments(galleryListQuery(v)))
      );
      return NextResponse.json({ all, visible, hidden, trash });
    }

    const items = await GalleryItem
      .find(galleryListQuery(searchParams.get("view") || "all"))
      .populate("linkedProduct", "slug name image")
      .sort({ order: 1, createdAt: -1 })
      .lean();

    return NextResponse.json(items);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "pages.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const body = await req.json();
    const { image, title, description, linkedProduct, order, enabled } = body;

    if (!image) return NextResponse.json({ error: "Image is required" }, { status: 400 });
    if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    // Get max order
    const maxOrderItem = await GalleryItem.findOne().sort({ order: -1 }).lean();
    const parsedOrder = order === undefined || order === "" ? NaN : Number(order);
    const nextOrder = Number.isFinite(parsedOrder) ? parsedOrder : ((maxOrderItem?.order ?? -1) + 1);

    const item = await GalleryItem.create({
      image,
      title: title.trim(),
      description: description?.trim() || "",
      linkedProduct: linkedProduct || null,
      order: nextOrder,
      enabled: enabled !== undefined ? enabled : true
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
