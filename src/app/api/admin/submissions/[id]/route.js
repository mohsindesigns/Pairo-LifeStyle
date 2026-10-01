import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Submission from "@/models/Submission";
import AuditLog from "@/models/AuditLog";
import { can } from "@/lib/rbac";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/submissions/[id]
 * Fetch detailed submission with full history
 */
export async function GET(req, { params }) {
  const { id } = params;
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "submissions.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const item = await Submission.findById(id)
      .populate("assignedTo", "name email")
      .populate("internalNotes.author", "name")
      .lean();
    
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Auto-mark as Read when opened if it was New
    if (item.status === 'New') {
      await Submission.updateOne({ _id: id }, { $set: { status: 'Read', lastViewedAt: new Date() } });
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
  const { id } = params;
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  try {
    const data = await req.json();
    const { action, ...updates } = data;

    // Replying (adding an internal note) and triaging (status/priority/assignment) are
    // distinct permissions — a reply-only role must not be able to reassign or re-prioritize,
    // and vice versa.
    const requiredPermission = action === "ADD_NOTE" ? "submissions.reply" : "submissions.assign";
    if (!can(session.user, requiredPermission)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let updateQuery = {};
    let auditAction = 'UPDATE_SUBMISSION';

    if (action === 'ADD_NOTE') {
      updateQuery = { 
        $push: { 
          internalNotes: { 
            content: updates.note, 
            author: session.user.id 
          } 
        } 
      };
      auditAction = 'ADD_SUBMISSION_NOTE';
    } else {
      updateQuery = { $set: updates };
      if (updates.status) auditAction = `SET_STATUS_${updates.status.toUpperCase()}`;
      if (updates.assignedTo) auditAction = 'ASSIGN_SUBMISSION';
    }

    const item = await Submission.findByIdAndUpdate(id, updateQuery, { new: true });
    
    // Audit Log
    await AuditLog.create({
      staffId: session.user.id,
      action: auditAction,
      resource: 'submissions',
      resourceId: id,
      details: updates
    });

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/submissions/[id]
 * Permanent deletion (requiressubmissions.delete permission)
 */
export async function DELETE(req, { params }) {
  const { id } = params;
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "submissions.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    await Submission.findByIdAndDelete(id);
    
    // Audit Log
    await AuditLog.create({
      staffId: session.user.id,
      action: 'PERMANENT_DELETE',
      resource: 'submissions',
      resourceId: id
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
