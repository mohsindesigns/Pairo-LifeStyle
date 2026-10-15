import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import SizeConfirmation from "@/models/SizeConfirmation";
import { can } from "@/lib/rbac";
import { isInboxConfigured } from "@/lib/sizeConfirmationInbox";

// List size confirmations. ?orderId= filters to one order; ?unread=1 returns only
// threads with unread customer replies (used by the admin notification bell).
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { searchParams } = new URL(req.url);
  const query = {};

  const orderId = searchParams.get("orderId");
  if (orderId) {
    if (!mongoose.isValidObjectId(orderId)) return NextResponse.json({ error: "Invalid orderId" }, { status: 400 });
    query.orderId = orderId;
  }
  if (searchParams.get("unread") === "1") query.unreadReplies = { $gt: 0 };
  const status = searchParams.get("status");
  if (status) query.status = status;

  const confirmations = await SizeConfirmation.find(query)
    .sort({ lastReplyAt: -1, sentAt: -1 })
    .limit(200)
    .lean();

  return NextResponse.json({
    success: true,
    inboxConfigured: isInboxConfigured(),
    confirmations,
  });
}
