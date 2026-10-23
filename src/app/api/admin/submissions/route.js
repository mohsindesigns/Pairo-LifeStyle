import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Submission from "@/models/Submission";
import AuditLog from "@/models/AuditLog";
import { can } from "@/lib/rbac";
import { NextResponse } from "next/server";
import {
  NOT_TRASHED, TRASHED, buildListQuery, buildStatusCounts, pageInfo, parsePaging,
  validIds, trashUpdate, restoreUpdate,
} from "./inbox-utils";

const SUBMISSION_STATUSES = ["New", "Read", "Replied", "Archived", "Spam"];
const SEARCH_FIELDS = ["name", "email", "phone", "subject", "message"];
const SORTABLE = ["createdAt", "updatedAt", "name", "email", "status", "priority"];

/**
 * GET /api/admin/submissions
 * ?status=all|New|Read|Replied|Archived|Spam|trash &search= &page= &limit= &priority= &sortBy= &sortOrder=
 */
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(session.user, "submissions.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePaging(searchParams);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";
  const priority = searchParams.get("priority") || "all";
  const assignedTo = searchParams.get("assignedTo") || "all";
  const sortBy = SORTABLE.includes(searchParams.get("sortBy")) ? searchParams.get("sortBy") : "createdAt";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;

  const query = buildListQuery({ view: status, statuses: SUBMISSION_STATUSES, search, searchFields: SEARCH_FIELDS });
  if (["Low", "Medium", "High"].includes(priority)) query.priority = priority;
  if (assignedTo !== "all" && validIds([assignedTo]).length) query.assignedTo = assignedTo;

  try {
    const [items, total, counts, trash] = await Promise.all([
      Submission.find(query)
        .populate("assignedTo", "name email")
        .sort({ [sortBy]: sortOrder, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Submission.countDocuments(query),
      Submission.aggregate([
        { $match: NOT_TRASHED },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Submission.countDocuments(TRASHED),
    ]);

    return NextResponse.json({
      items,
      pagination: pageInfo(total, page, limit),
      counts: buildStatusCounts(counts, SUBMISSION_STATUSES, trash),
    });

  } catch (error) {
    console.error("[SUBMISSIONS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
}

// action -> [permission, filter extra, $set] ; "delete" is handled separately.
const BULK_ACTIONS = {
  markRead: { permission: "submissions.view", filter: { ...NOT_TRASHED, status: "New" }, set: () => ({ status: "Read", lastViewedAt: new Date() }) },
  markUnread: { permission: "submissions.view", filter: { ...NOT_TRASHED, status: { $in: ["Read"] } }, set: () => ({ status: "New" }) },
  archive: { permission: "submissions.assign", filter: { ...NOT_TRASHED }, set: () => ({ status: "Archived" }) },
  markSpam: { permission: "submissions.manage_spam", filter: { ...NOT_TRASHED }, set: () => ({ status: "Spam" }) },
  notSpam: { permission: "submissions.manage_spam", filter: { ...NOT_TRASHED, status: "Spam" }, set: () => ({ status: "Read" }) },
  trash: { permission: "submissions.delete", filter: { ...NOT_TRASHED }, set: () => trashUpdate() },
  restore: { permission: "submissions.delete", filter: { ...TRASHED }, set: () => restoreUpdate() },
};

/**
 * POST /api/admin/submissions
 * Bulk actions: { action, ids } where action is markRead | markUnread | archive | markSpam |
 * notSpam | trash | restore | delete (permanent, only for items already in the Trash).
 * Responds with { processed, failed } so the UI can report partial results.
 */
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }
    const ids = validIds(body.ids);

    const def = BULK_ACTIONS[action];
    const permission = action === "delete" ? "submissions.delete" : def?.permission;
    if (!permission) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    if (!can(session.user, permission)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let processed = 0;
    if (ids.length > 0) {
      if (action === "delete") {
        const r = await Submission.deleteMany({ _id: { $in: ids }, ...TRASHED });
        processed = r.deletedCount || 0;
      } else {
        const r = await Submission.updateMany({ _id: { $in: ids }, ...def.filter }, { $set: def.set() });
        // An item already in the requested state (e.g. "mark read" on a read one) is not a failure.
        processed = action === "markRead" || action === "markUnread"
          ? await Submission.countDocuments({ _id: { $in: ids }, ...NOT_TRASHED })
          : (r.matchedCount ?? r.modifiedCount ?? 0);
      }
      if (action === "restore") {
        // Older records were trashed by setting status "Trash"; bring them back as "Read".
        await Submission.updateMany({ _id: { $in: ids }, status: "Trash" }, { $set: { status: "Read" } });
      }
    }

    await AuditLog.create({
      staffId: session.user.id,
      action: action === "delete" ? "BULK_PERMANENT_DELETE" : `BULK_${String(action).toUpperCase()}`,
      resource: 'submissions',
      details: { count: processed, ids }
    }).catch(() => null);

    const failed = body.ids.length - processed;
    return NextResponse.json({ success: true, processed, failed: Math.max(0, failed) });

  } catch (error) {
    console.error("[SUBMISSIONS_BULK_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
