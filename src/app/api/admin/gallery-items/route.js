import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import GalleryItem from "@/models/GalleryItem";
import { can } from "@/lib/rbac";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "pages.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const items = await GalleryItem
      .find({ tenantId: "DEFAULT_STORE" })
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
    const maxOrderItem = await GalleryItem.findOne({ tenantId: "DEFAULT_STORE" }).sort({ order: -1 }).lean();
    const nextOrder = order !== undefined ? order : ((maxOrderItem?.order ?? -1) + 1);

    const item = await GalleryItem.create({
      image,
      title: title.trim(),
      description: description?.trim() || "",
      linkedProduct: linkedProduct || null,
      order: nextOrder,
      enabled: enabled !== undefined ? enabled : true,
      tenantId: "DEFAULT_STORE"
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
