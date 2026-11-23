import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import GalleryItem from "@/models/GalleryItem";
import { can } from "@/lib/rbac";
import { parseReorderIds } from "../helpers";

// PUT /api/admin/gallery-items/reorder { ids: [...] } — saves the given order (0, 1, 2…)
export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "pages.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = parseReorderIds(body, (id) => mongoose.isValidObjectId(id));
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await dbConnect();
  try {
    const res = await GalleryItem.bulkWrite(
      parsed.ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: index } } } }))
    );
    return NextResponse.json({ success: true, matched: res.matchedCount });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
