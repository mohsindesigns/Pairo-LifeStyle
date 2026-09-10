import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import GalleryItem from "@/models/GalleryItem";
import { can } from "@/lib/rbac";

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "pages.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();
  try {
    const item = await GalleryItem.findById(id).populate("linkedProduct", "slug name image").lean();
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(item);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "pages.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();
  try {
    const body = await req.json();
    const allowed = ["image", "title", "description", "linkedProduct", "order", "enabled"];
    const update = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }
    const item = await GalleryItem.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(item);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "pages.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();
  try {
    await GalleryItem.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
