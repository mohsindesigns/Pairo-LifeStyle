import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import SizeConfirmation from "@/models/SizeConfirmation";
import { can } from "@/lib/rbac";
import { isInboxConfigured } from "@/lib/sizeConfirmationInbox";
import {
  NOT_TRASHED, TRASHED, buildSearchOr, buildStatusCounts, pageInfo, parsePaging,
  validIds, trashUpdate, restoreUpdate,
} from "@/app/api/admin/submissions/inbox-utils";

const STATUSES = ["Awaiting Reply", "Replied", "Confirmed"];
const SEARCH_FIELDS = ["orderNumber", "customerName", "customerEmail", "confirmedSize"];

// List size confirmations (trashed ones are left out unless ?status=trash).
//   ?orderId=   one order's confirmations (order page panel)
//   ?unread=1   only threads with unread customer replies (admin notification bell)
//   ?status=all|Awaiting Reply|Replied|Confirmed|unread|trash  ?search=  ?page=&limit=
// Without ?page the response keeps its original shape (up to 200 rows, no counts).
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "all";
  const query = status === "trash" ? { ...TRASHED } : { ...NOT_TRASHED };

  const orderId = searchParams.get("orderId");
  if (orderId) {
    if (!mongoose.isValidObjectId(orderId)) return NextResponse.json({ error: "Invalid orderId" }, { status: 400 });
    query.orderId = orderId;
  }
  if (searchParams.get("unread") === "1" || status === "unread") query.unreadReplies = { $gt: 0 };
  if (STATUSES.includes(status)) query.status = status;
  const or = buildSearchOr(searchParams.get("search"), SEARCH_FIELDS);
  if (or) query.$or = or;

  const sort = { lastReplyAt: -1, sentAt: -1, _id: -1 };

  if (!searchParams.has("page")) {
    const confirmations = await SizeConfirmation.find(query).sort(sort).limit(200).lean();
    return NextResponse.json({ success: true, inboxConfigured: isInboxConfigured(), confirmations });
  }

  const { page, limit, skip } = parsePaging(searchParams);
  const [confirmations, total, counts, unread, trash] = await Promise.all([
    SizeConfirmation.find(query).sort(sort).skip(skip).limit(limit).lean(),
    SizeConfirmation.countDocuments(query),
    SizeConfirmation.aggregate([
      { $match: NOT_TRASHED },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    SizeConfirmation.countDocuments({ ...NOT_TRASHED, unreadReplies: { $gt: 0 } }),
    SizeConfirmation.countDocuments(TRASHED),
  ]);

  return NextResponse.json({
    success: true,
    inboxConfigured: isInboxConfigured(),
    confirmations,
    pagination: pageInfo(total, page, limit),
    counts: { ...buildStatusCounts(counts, STATUSES, trash), unread },
  });
}

// POST bulk: { action: "markRead" | "trash" | "restore" | "delete", ids: [] }
// "delete" is permanent and only touches confirmations already in the Trash.
// The order itself is never changed (its timeline keeps the "size confirmed" entry).
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "Select at least one size confirmation" }, { status: 400 });
  }
  if (!["markRead", "trash", "restore", "delete"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const ids = validIds(body.ids);
  await dbConnect();
  try {
    let processed = 0;
    if (ids.length) {
      const sel = { _id: { $in: ids } };
      if (action === "delete") {
        processed = (await SizeConfirmation.deleteMany({ ...sel, ...TRASHED })).deletedCount || 0;
      } else if (action === "markRead") {
        const r = await SizeConfirmation.updateMany(
          { ...sel, ...NOT_TRASHED },
          { $set: { unreadReplies: 0, "replies.$[].read": true } }
        );
        processed = r.matchedCount ?? 0;
      } else {
        const [filter, set] = action === "trash" ? [NOT_TRASHED, trashUpdate()] : [TRASHED, restoreUpdate()];
        processed = (await SizeConfirmation.updateMany({ ...sel, ...filter }, { $set: set })).matchedCount ?? 0;
      }
    }
    return NextResponse.json({ success: true, processed, failed: Math.max(0, body.ids.length - processed) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
