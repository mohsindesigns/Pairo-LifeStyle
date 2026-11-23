import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import AbandonedCart from "@/models/AbandonedCart";
import { can } from "@/lib/rbac";
import { buildAbandonedCartQuery, buildAbandonedCartCountsPipeline, emptyAbandonedCartCounts } from "./listQuery";

// Same rule as trashing/restoring an order (DELETE/PUT /api/admin/orders).
const canManage = (user) => can(user, "orders.update") || can(user, "orders.edit") || can(user, "orders.delete");

async function staffSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { session };
}

export async function GET(req) {
  const { session, error } = await staffSession();
  if (error) return error;
  if (!can(session.user, "orders.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
  const skip = (page - 1) * limit;
  const search = searchParams.get("search") || "";
  const view = searchParams.get("status") || "active";

  const query = buildAbandonedCartQuery({ view, search });

  try {
    const [items, total, countRows] = await Promise.all([
      AbandonedCart.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      AbandonedCart.countDocuments(query),
      AbandonedCart.aggregate(buildAbandonedCartCountsPipeline(search)),
    ]);

    const counts = { ...emptyAbandonedCartCounts(), ...(countRows[0] || {}) };
    delete counts._id;

    return NextResponse.json({
      success: true,
      items,
      counts,
      pagination: { total, pages: Math.max(1, Math.ceil(total / limit)), currentPage: page },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE ?id=<id>                 moves the cart record to the Trash.
 * DELETE ?id=<id>&permanent=true  removes a record that is already in the Trash.
 */
export async function DELETE(req) {
  const { session, error } = await staffSession();
  if (error) return error;
  if (!canManage(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const permanent = searchParams.get("permanent") === "true";
  if (!id || !mongoose.isValidObjectId(id)) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const cart = await AbandonedCart.findById(id).select("isDeleted").lean();
    if (!cart) return NextResponse.json({ error: "Abandoned cart not found" }, { status: 404 });

    if (!permanent) {
      if (!cart.isDeleted) {
        await AbandonedCart.updateOne({ _id: id }, { $set: { isDeleted: true, deletedAt: new Date() } }, { timestamps: false });
      }
      return NextResponse.json({ success: true, message: "Moved to trash" });
    }

    if (!cart.isDeleted) {
      return NextResponse.json({ error: "Move the record to the Trash before deleting it permanently." }, { status: 409 });
    }
    await AbandonedCart.deleteOne({ _id: id });
    return NextResponse.json({ success: true, message: "Deleted permanently" });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Restore from the Trash: PUT { id, isDeleted: false }. */
export async function PUT(req) {
  const { session, error } = await staffSession();
  if (error) return error;
  if (!canManage(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { id, isDeleted } = (await req.json().catch(() => ({}))) || {};
  if (!id || !mongoose.isValidObjectId(id)) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (isDeleted !== false) {
    return NextResponse.json({ error: "Only restoring (isDeleted: false) is supported" }, { status: 400 });
  }

  try {
    const cart = await AbandonedCart.findByIdAndUpdate(
      id,
      { $set: { isDeleted: false, deletedAt: null } },
      { new: true, timestamps: false }
    ).lean();
    if (!cart) return NextResponse.json({ error: "Abandoned cart not found" }, { status: 404 });
    return NextResponse.json({ success: true, item: cart });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
