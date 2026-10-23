import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import dbConnect from "@/lib/db";
import CustomJacketInquiry from "@/models/CustomJacketInquiry";

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "submissions.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
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
  // Updating status/priority/notes is a triage action, not mere viewing — a view-only role
  // must not be able to mutate inquiries.
  if (!can(session.user, "submissions.assign")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();

  try {
    const body = await req.json();
    const allowed = ["status", "priority", "adminNotes"];
    const update = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

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

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "submissions.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();

  try {
    await CustomJacketInquiry.findByIdAndUpdate(id, { $set: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
