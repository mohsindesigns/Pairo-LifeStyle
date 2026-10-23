import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import GalleryItem from "@/models/GalleryItem";
import { can } from "@/lib/rbac";
import { buildGalleryDuplicate } from "../../helpers";

// POST /api/admin/gallery-items/[id]/duplicate — hidden "(Copy)" placed right after the source.
// Same permission as creating a gallery item (pages.edit).
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "pages.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await dbConnect();
  try {
    const source = await GalleryItem.findById(id).lean();
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = buildGalleryDuplicate(source);
    // Make room right after the source so the copy sits next to it
    await GalleryItem.updateMany({ _id: { $ne: source._id }, order: { $gte: data.order } }, { $inc: { order: 1 } });
    const copy = await GalleryItem.create(data);
    return NextResponse.json(copy, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Failed to duplicate" }, { status: 500 });
  }
}
