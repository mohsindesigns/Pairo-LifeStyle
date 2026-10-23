import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import dbConnect from "@/lib/db";
import SizeChartItem from "@/models/SizeChartItem";

const badId = (id) => !mongoose.Types.ObjectId.isValid(id);

// PATCH: edit fields, or restore from trash with { isDeleted: false }.
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (badId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await dbConnect();
  try {
    const body = await req.json();
    const current = await SizeChartItem.findById(id).lean();
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.isDeleted === false) {
      if (!current.isDeleted) return NextResponse.json(current);
      const restored = await SizeChartItem.findByIdAndUpdate(id, {
        $set: {
          isDeleted: false,
          deletedAt: null,
          enabled: current.enabledBeforeTrash ?? true,
          enabledBeforeTrash: null,
        },
      }, { new: true }).lean();
      return NextResponse.json(restored);
    }

    if (current.isDeleted) {
      return NextResponse.json({ error: "This item is in the Trash. Restore it before editing." }, { status: 409 });
    }

    const allowed = ["title", "description", "image", "order", "enabled"];
    const update = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }
    if (update.title !== undefined && !String(update.title).trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (update.image !== undefined && !update.image) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }
    const item = await SizeChartItem.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean();
    return NextResponse.json(item);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: move to trash (default; the item is also hidden so the public
// /size-chart page drops it), or ?mode=permanent for an item already in the trash.
export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (badId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const mode = new URL(req.url).searchParams.get("mode");
  await dbConnect();
  try {
    const item = await SizeChartItem.findById(id).lean();
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (mode === "permanent") {
      if (!item.isDeleted) {
        return NextResponse.json({ error: "Move the item to the trash before deleting it permanently." }, { status: 409 });
      }
      await SizeChartItem.findByIdAndDelete(id);
      return NextResponse.json({ success: true, message: "Deleted permanently" });
    }

    if (item.isDeleted) return NextResponse.json({ success: true, message: "Already in trash" });
    await SizeChartItem.updateOne({ _id: id }, {
      $set: { isDeleted: true, deletedAt: new Date(), enabledBeforeTrash: item.enabled !== false, enabled: false },
    });
    return NextResponse.json({ success: true, message: "Moved to trash" });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
