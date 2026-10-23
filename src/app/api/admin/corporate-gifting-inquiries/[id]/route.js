import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import dbConnect from "@/lib/db";
import CorporateGiftingInquiry from "@/models/CorporateGiftingInquiry";
import { trashUpdate, restoreUpdate } from "@/app/api/admin/submissions/inbox-utils";

const STATUSES = ["New", "Contacted", "Quoted", "In Progress", "Completed", "Cancelled"];
const PRIORITIES = ["Low", "Medium", "High"];

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "submissions.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await dbConnect();
  const inquiry = await CorporateGiftingInquiry.findById(id).lean();
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(inquiry);
}

// PATCH { status?, priority?, adminNotes? }  or  { isDeleted: false } to restore from the Trash.
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  const restoring = body.isDeleted === false;
  if (!can(session.user, restoring ? "submissions.delete" : "submissions.assign")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();
  try {
    let update = {};
    if (restoring) {
      update = restoreUpdate();
    } else {
      if (body.status !== undefined && !STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      if (body.priority !== undefined && !PRIORITIES.includes(body.priority)) {
        return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
      }
      for (const key of ["status", "priority", "adminNotes"]) {
        if (body[key] !== undefined) update[key] = key === "adminNotes" ? String(body[key] ?? "").slice(0, 10000) : body[key];
      }
      if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    const updated = await CorporateGiftingInquiry.findByIdAndUpdate(
      id, { $set: update }, { new: true, runValidators: true }
    ).lean();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE moves to the Trash; DELETE ?permanent=true removes an inquiry that is already in the Trash.
export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "submissions.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const permanent = new URL(req.url).searchParams.get("permanent") === "true";
  await dbConnect();
  try {
    const existing = await CorporateGiftingInquiry.findById(id).select("isDeleted").lean();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (permanent) {
      if (!existing.isDeleted) {
        return NextResponse.json({ error: "Move the inquiry to the Trash before deleting it permanently." }, { status: 409 });
      }
      await CorporateGiftingInquiry.deleteOne({ _id: id, isDeleted: true });
    } else {
      await CorporateGiftingInquiry.updateOne({ _id: id }, { $set: trashUpdate() });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
