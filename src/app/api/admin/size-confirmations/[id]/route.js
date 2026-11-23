import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import SizeConfirmation from "@/models/SizeConfirmation";
import Order from "@/models/Order";
import { can } from "@/lib/rbac";
import { trashUpdate, restoreUpdate } from "@/app/api/admin/submissions/inbox-utils";

// GET one confirmation (detail drawer on the Size Confirmations screen).
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await dbConnect();
  const confirmation = await SizeConfirmation.findById(id).lean();
  if (!confirmation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, confirmation });
}

// PATCH { action: "markRead" } | { action: "confirm", size: "Medium" } | { action: "restore" }
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await dbConnect();
  const body = await req.json().catch(() => ({}));
  const confirmation = await SizeConfirmation.findById(id);
  if (!confirmation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.action === "restore") {
    Object.assign(confirmation, restoreUpdate());
  } else if (confirmation.isDeleted) {
    return NextResponse.json({ error: "Restore this size confirmation from the Trash first" }, { status: 409 });
  } else if (body.action === "markRead") {
    confirmation.replies.forEach((r) => { r.read = true; });
    confirmation.unreadReplies = 0;
  } else if (body.action === "confirm") {
    const size = String(body.size || "").trim().slice(0, 120);
    if (!size) return NextResponse.json({ error: "Enter the confirmed size" }, { status: 400 });
    confirmation.confirmedSize = size;
    confirmation.confirmedAt = new Date();
    confirmation.status = "Confirmed";
    confirmation.replies.forEach((r) => { r.read = true; });
    confirmation.unreadReplies = 0;

    await Order.updateOne(
      { _id: confirmation.orderId },
      {
        $push: {
          timeline: {
            status: (await Order.findById(confirmation.orderId).select("status").lean())?.status || "Pending",
            message: `Customer size confirmed: ${size}.`,
            source: "Admin",
          },
        },
      }
    );
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await confirmation.save();
  return NextResponse.json({ success: true, confirmation });
}

// DELETE moves to the Trash; DELETE ?permanent=true removes one that is already in the Trash.
// The order is not touched.
export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const permanent = new URL(req.url).searchParams.get("permanent") === "true";
  await dbConnect();
  const existing = await SizeConfirmation.findById(id).select("isDeleted").lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (permanent) {
    if (!existing.isDeleted) {
      return NextResponse.json({ error: "Move it to the Trash before deleting it permanently." }, { status: 409 });
    }
    await SizeConfirmation.deleteOne({ _id: id, isDeleted: true });
  } else {
    await SizeConfirmation.updateOne({ _id: id }, { $set: trashUpdate() });
  }
  return NextResponse.json({ success: true });
}
