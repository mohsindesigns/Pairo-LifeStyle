import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Media from "@/models/Media";
import { deleteFromStorage } from "@/lib/storage";
import { can } from "@/lib/rbac";

// GET /api/admin/media/[id] — Get single media item with usage refs
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "media.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { id } = await params;
  const media = await Media.findById(id).lean();
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, media });
}

// PATCH /api/admin/media/[id] — Update metadata (alt, title, tags, caption)
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "media.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { id } = await params;
  const body = await req.json();

  const allowed = ['title', 'altText', 'caption', 'tags', 'folder'];
  const updates = {};
  allowed.forEach(key => {
    if (body[key] !== undefined) updates[key] = body[key];
  });

  // Handle restore from trash
  if (body.restore) {
    updates.isDeleted = false;
    updates.deletedAt = null;
  }

  const media = await Media.findByIdAndUpdate(id, updates, { new: true });
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, media });
}

// DELETE /api/admin/media/[id] — Soft delete, or permanent if ?permanent=true
export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "media.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const permanent = searchParams.get('permanent') === 'true';

  const media = await Media.findById(id);
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (permanent) {
    // Warn if still in use
    if (media.usageCount > 0) {
      return NextResponse.json({
        error: "Image is still in use",
        usageCount: media.usageCount,
        usageRefs: media.usageRefs,
      }, { status: 409 });
    }
    // Delete from Cloudinary / local filesystem
    if (media.publicId) {
      await deleteFromStorage(media.publicId);
    }
    await Media.findByIdAndDelete(id);
    return NextResponse.json({ success: true, deleted: true });
  }

  // Soft delete
  await Media.findByIdAndUpdate(id, {
    isDeleted: true,
    deletedAt: new Date(),
  });
  return NextResponse.json({ success: true, trashed: true });
}
