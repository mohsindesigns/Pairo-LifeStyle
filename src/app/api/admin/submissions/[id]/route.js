import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Submission from "@/models/Submission";
import AuditLog from "@/models/AuditLog";
import { can } from "@/lib/rbac";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

const STATUSES = ["New", "Read", "Replied", "Archived", "Spam"];
const PRIORITIES = ["Low", "Medium", "High"];

/**
 * GET /api/admin/submissions/[id]
 * Fetch detailed submission with full history
 */
export async function GET(req, { params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "submissions.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await dbConnect();
  try {
    const item = await Submission.findById(id)
      .populate("assignedTo", "name email")
      .populate("internalNotes.author", "name")
      .lean();
    
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Auto-mark as Read when opened if it was New (and return the updated status).
    // lastViewedAt in the response is the *previous* view, so the panel can show it.
    const now = new Date();
    if (item.status === 'New' && !item.isDeleted) {
      await Submission.updateOne({ _id: id, status: 'New' }, { $set: { status: 'Read', lastViewedAt: now } });
      item.status = 'Read';
    } else {
      await Submission.updateOne({ _id: id }, { $set: { lastViewedAt: now } });
    }

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/submissions/[id]
 * Update status, priority, assignment, or internal notes
 */
export async function PATCH(req, { params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await dbConnect();
  try {
    const data = await req.json().catch(() => ({}));
    const { action } = data;

    // Replying (adding an internal note) and triaging (status/priority/assignment) are
    // distinct permissions — a reply-only role must not be able to reassign or re-prioritize,
    // and vice versa.
    const requiredPermission = action === "ADD_NOTE" ? "submissions.reply" : "submissions.assign";
    if (!can(session.user, requiredPermission)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let updateQuery = {};
    let auditAction = 'UPDATE_SUBMISSION';

    // Only these fields may be changed here; Trash/Restore go through the bulk endpoint
    // (which checks submissions.delete).
    const updates = {};
    if (data.status !== undefined) {
      if (!STATUSES.includes(data.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      updates.status = data.status;
    }
    if (data.priority !== undefined) {
      if (!PRIORITIES.includes(data.priority)) return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
      updates.priority = data.priority;
    }
    if (data.assignedTo !== undefined) {
      if (data.assignedTo !== null && !mongoose.isValidObjectId(data.assignedTo)) {
        return NextResponse.json({ error: "Invalid assignee" }, { status: 400 });
      }
      updates.assignedTo = data.assignedTo;
    }
    if (Array.isArray(data.tags)) updates.tags = data.tags.map(String).slice(0, 50);
    // Marking as spam / not spam needs the spam permission as well.
    if ((updates.status === 'Spam') && !can(session.user, "submissions.manage_spam")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === 'ADD_NOTE') {
      const note = String(data.note || '').trim();
      if (!note) return NextResponse.json({ error: "Note is empty" }, { status: 400 });
      updateQuery = { 
        $push: { 
          internalNotes: { 
            content: note.slice(0, 5000), 
            author: session.user.id 
          } 
        } 
      };
      auditAction = 'ADD_SUBMISSION_NOTE';
    } else {
      if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      updateQuery = { $set: updates };
      if (updates.status) auditAction = `SET_STATUS_${updates.status.toUpperCase()}`;
      if (updates.assignedTo) auditAction = 'ASSIGN_SUBMISSION';
    }

    const item = await Submission.findByIdAndUpdate(id, updateQuery, { new: true })
      .populate("assignedTo", "name email")
      .populate("internalNotes.author", "name");
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    
    // Audit Log
    await AuditLog.create({
      staffId: session.user.id,
      action: auditAction,
      resource: 'submissions',
      resourceId: id,
      details: action === 'ADD_NOTE' ? { note: true } : updates
    }).catch(() => null);

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/submissions/[id]
 * Permanent deletion (submissions.delete). Only allowed for items already in the Trash.
 */
export async function DELETE(req, { params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "submissions.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await dbConnect();
  try {
    const existing = await Submission.findById(id).select("isDeleted").lean();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!existing.isDeleted) {
      return NextResponse.json({ error: "Move the submission to the Trash before deleting it permanently." }, { status: 409 });
    }
    await Submission.deleteOne({ _id: id, isDeleted: true });
    
    // Audit Log
    await AuditLog.create({
      staffId: session.user.id,
      action: 'PERMANENT_DELETE',
      resource: 'submissions',
      resourceId: id
    }).catch(() => null);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
