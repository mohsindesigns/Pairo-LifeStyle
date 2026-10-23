import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import dbConnect from "@/lib/db";
import CustomJacketInquiry from "@/models/CustomJacketInquiry";
import mongoose from "mongoose";
import { trashUpdate, restoreUpdate } from "@/app/api/admin/submissions/inbox-utils";

const STATUSES = ["New", "Contacted", "In Progress", "Converted", "Completed", "Cancelled"];
const PRIORITIES = ["Low", "Medium", "High"];

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "submissions.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await dbConnect();

  try {
    const inquiry = await CustomJacketInquiry.findById(id).lean();
    if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(inquiry);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  // { isDeleted: false } restores from the Trash (a delete-level action). Anything else is
  // triage (status/priority/notes), not mere viewing — a view-only role must not mutate inquiries.
  const restoring = body.isDeleted === false;
  if (!can(session.user, restoring ? "submissions.delete" : "submissions.assign")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  try {
    if (restoring) {
      const restored = await CustomJacketInquiry.findByIdAndUpdate(id, { $set: restoreUpdate() }, { new: true }).lean();
      if (!restored) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(restored);
    }

    if (body.status !== undefined && !STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (body.priority !== undefined && !PRIORITIES.includes(body.priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    const allowed = ["status", "priority", "adminNotes"];
    const update = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = key === "adminNotes" ? String(body[key] ?? "").slice(0, 10000) : body[key];
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    // Once an inquiry has been converted to an order it must not be moved back to a
    // pre-conversion status (e.g. a stale dialog saving "New" over "Converted").
    const PRE_CONVERSION_STATUSES = ["New", "Contacted", "In Progress"];
    if (update.status !== undefined && PRE_CONVERSION_STATUSES.includes(update.status)) {
      const existing = await CustomJacketInquiry.findById(id).select("status orderId").lean();
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (existing.orderId || existing.status === "Converted") {
        return NextResponse.json(
          { error: "This inquiry has been converted to an order and can't be moved back to an earlier status" },
          { status: 409 }
        );
      }
    }

    const updated = await CustomJacketInquiry.findByIdAndUpdate(
      id, { $set: update }, { new: true }
    ).lean();

    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE moves to the Trash; DELETE ?permanent=true removes an inquiry that is already in the Trash.
// Either is safe for a converted inquiry: its order keeps its own customJacketSnapshot.
export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "submissions.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const permanent = new URL(req.url).searchParams.get("permanent") === "true";
  await dbConnect();

  try {
    const existing = await CustomJacketInquiry.findById(id).select("isDeleted").lean();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (permanent) {
      if (!existing.isDeleted) {
        return NextResponse.json({ error: "Move the inquiry to the Trash before deleting it permanently." }, { status: 409 });
      }
      await CustomJacketInquiry.deleteOne({ _id: id, isDeleted: true });
    } else {
      await CustomJacketInquiry.updateOne({ _id: id }, { $set: trashUpdate() });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
