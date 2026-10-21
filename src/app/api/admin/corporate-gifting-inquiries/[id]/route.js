import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import dbConnect from "@/lib/db";
import CorporateGiftingInquiry from "@/models/CorporateGiftingInquiry";

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "submissions.assign")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();
  try {
    const body = await req.json();
    const update = {};
    for (const key of ["status", "priority", "adminNotes"]) {
      if (body[key] !== undefined) update[key] = body[key];
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

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "submissions.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();
  try {
    await CorporateGiftingInquiry.findByIdAndUpdate(id, { $set: { isDeleted: true } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
