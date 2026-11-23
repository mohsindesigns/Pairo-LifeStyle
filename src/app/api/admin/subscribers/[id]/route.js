import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Subscriber from "@/models/Subscriber";
import { can } from "@/lib/rbac";

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "settings.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();
  try {
    const subscriber = await Subscriber.findByIdAndDelete(id);
    if (!subscriber) return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    return NextResponse.json({ message: "Subscriber deleted" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "settings.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();
  try {
    const body = await req.json().catch(() => ({}));
    // Only these fields may be edited (never email uniqueness-bypassing writes or arbitrary keys).
    const update = {};
    if (body.status !== undefined) update.status = body.status;
    if (body.source !== undefined) update.source = String(body.source).slice(0, 100);
    if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    const updated = await Subscriber.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
    if (!updated) return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
