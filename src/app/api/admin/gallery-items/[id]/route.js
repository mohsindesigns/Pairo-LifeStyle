import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import GalleryItem from "@/models/GalleryItem";
import { can } from "@/lib/rbac";

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "pages.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET(req, { params }) {
  const denied = await guard();
  if (denied) return denied;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return notFound();
  await dbConnect();
  try {
    const item = await GalleryItem.findById(id).populate("linkedProduct", "slug name image").lean();
    if (!item) return notFound();
    return NextResponse.json(item);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — edit fields; { restore: true } brings a trashed item back with its old visibility
export async function PATCH(req, { params }) {
  const denied = await guard();
  if (denied) return denied;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return notFound();
  await dbConnect();
  try {
    const body = await req.json().catch(() => ({}));
    const existing = await GalleryItem.findById(id).lean();
    if (!existing) return notFound();

    if (body.restore === true) {
      if (!existing.isDeleted) return NextResponse.json(existing);
      const item = await GalleryItem.findByIdAndUpdate(id, {
        $set: {
          isDeleted: false,
          deletedAt: null,
          enabled: existing.enabledBeforeTrash === null || existing.enabledBeforeTrash === undefined ? true : existing.enabledBeforeTrash,
          enabledBeforeTrash: null,
        },
      }, { new: true }).populate("linkedProduct", "slug name image").lean();
      return NextResponse.json(item);
    }

    const allowed = ["image", "title", "description", "linkedProduct", "order", "enabled"];
    const update = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }
    if (update.title !== undefined) {
      update.title = String(update.title).trim();
      if (!update.title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (update.image !== undefined && !update.image) return NextResponse.json({ error: "Image is required" }, { status: 400 });
    if (update.description !== undefined) update.description = String(update.description || "").trim();
    if (update.linkedProduct !== undefined) {
      if (update.linkedProduct && !mongoose.isValidObjectId(update.linkedProduct)) {
        return NextResponse.json({ error: "Invalid linked product" }, { status: 400 });
      }
      update.linkedProduct = update.linkedProduct || null;
    }
    if (update.order !== undefined) {
      const n = Number(update.order);
      if (!Number.isFinite(n)) return NextResponse.json({ error: "Display order must be a number" }, { status: 400 });
      update.order = n;
    }
    // A trashed item stays hidden until it is restored
    if (existing.isDeleted && update.enabled !== undefined) {
      update.enabledBeforeTrash = !!update.enabled;
      delete update.enabled;
    }

    const item = await GalleryItem.findByIdAndUpdate(id, { $set: update }, { new: true })
      .populate("linkedProduct", "slug name image")
      .lean();
    if (!item) return notFound();
    return NextResponse.json(item);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — moves to Trash (and hides it); ?permanent=true deletes, only for trashed items
export async function DELETE(req, { params }) {
  const denied = await guard();
  if (denied) return denied;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return notFound();
  const permanent = new URL(req.url).searchParams.get("permanent") === "true";
  await dbConnect();
  try {
    const item = await GalleryItem.findById(id).lean();
    if (!item) return notFound();

    if (permanent) {
      if (!item.isDeleted) {
        return NextResponse.json({ error: "Move the item to Trash before deleting it permanently." }, { status: 400 });
      }
      await GalleryItem.findByIdAndDelete(id);
      return NextResponse.json({ success: true, deleted: true });
    }

    if (item.isDeleted) return NextResponse.json({ success: true, trashed: true });
    await GalleryItem.updateOne({ _id: id }, {
      $set: { isDeleted: true, deletedAt: new Date(), enabledBeforeTrash: item.enabled !== false, enabled: false },
    });
    return NextResponse.json({ success: true, trashed: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
