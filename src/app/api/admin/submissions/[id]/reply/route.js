import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Submission from "@/models/Submission";
import AuditLog from "@/models/AuditLog";
import { can } from "@/lib/rbac";
import { sendSubmissionReply } from "@/lib/email";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/submissions/[id]/reply
 * Send an enterprise email reply to a submission
 */
export async function POST(req, { params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  if (!can(session.user, "submissions.reply")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();
  try {
    const { subject, message } = await req.json();
    
    if (!subject || !message) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }

    const submission = await Submission.findById(id);
    if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

    // Send the actual email
    await sendSubmissionReply(submission.email, subject, message, submission.name);

    // Update submission status
    submission.status = 'Replied';
    submission.repliedAt = new Date();
    
    // Add to internal notes as a record
    submission.internalNotes.push({
      content: `REPLY SENT: "${subject}"\n\n${message}`,
      author: session.user.id
    });

    await submission.save();

    // Audit Log
    await AuditLog.create({
      staffId: session.user.id,
      action: 'SEND_REPLY',
      resource: 'submissions',
      resourceId: id,
      details: { subject }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[REPLY_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
