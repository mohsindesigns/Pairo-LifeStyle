import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import CustomJacketInquiry from "@/models/CustomJacketInquiry";
import { can } from "@/lib/rbac";
import {
  NOT_TRASHED, TRASHED, buildListQuery, buildStatusCounts, pageInfo, parsePaging,
  validIds, trashUpdate, restoreUpdate,
} from "@/app/api/admin/submissions/inbox-utils";

const STATUSES = ["New", "Contacted", "In Progress", "Converted", "Completed", "Cancelled"];
// Statuses a converted inquiry may not go back to.
const PRE_CONVERSION_STATUSES = ["New", "Contacted", "In Progress"];
const SEARCH_FIELDS = ["firstName", "lastName", "email", "phone", "jacketType", "country", "city"];

// GET ?status=all|<status>|trash &search= &page= &limit=
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "submissions.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePaging(searchParams);
  const query = buildListQuery({
    view: searchParams.get("status") || "all",
    statuses: STATUSES,
    search: searchParams.get("search") || "",
    searchFields: SEARCH_FIELDS,
  });

  try {
    const [items, total, counts, trash] = await Promise.all([
      CustomJacketInquiry.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      CustomJacketInquiry.countDocuments(query),
      CustomJacketInquiry.aggregate([
        { $match: NOT_TRASHED },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      CustomJacketInquiry.countDocuments(TRASHED),
    ]);

    return NextResponse.json({
      items,
      pagination: pageInfo(total, page, limit),
      counts: buildStatusCounts(counts, STATUSES, trash),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST bulk: { action: "status" | "trash" | "restore" | "delete", ids: [], status? }
// - "status" never sets "Converted" (that only happens through Convert to Order) and never moves a
//   converted inquiry back to a pre-conversion status.
// - "trash" is allowed for converted inquiries: the order keeps its own copy of the specs.
// - "delete" is permanent and only touches inquiries already in the Trash.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "Select at least one inquiry" }, { status: 400 });
  }
  const permission = action === "status" ? "submissions.assign"
    : ["trash", "restore", "delete"].includes(action) ? "submissions.delete" : null;
  if (!permission) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  if (!can(session.user, permission)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (action === "status" && (!STATUSES.includes(body.status) || body.status === "Converted")) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const ids = validIds(body.ids);
  await dbConnect();
  try {
    let processed = 0;
    if (ids.length) {
      const sel = { _id: { $in: ids } };
      if (action === "delete") {
        processed = (await CustomJacketInquiry.deleteMany({ ...sel, ...TRASHED })).deletedCount || 0;
      } else if (action === "status") {
        const filter = { ...sel, ...NOT_TRASHED };
        if (PRE_CONVERSION_STATUSES.includes(body.status)) {
          filter.orderId = null;
          filter.status = { $ne: "Converted" };
        }
        processed = (await CustomJacketInquiry.updateMany(filter, { $set: { status: body.status } })).matchedCount ?? 0;
      } else {
        const [filter, set] = action === "trash" ? [NOT_TRASHED, trashUpdate()] : [TRASHED, restoreUpdate()];
        processed = (await CustomJacketInquiry.updateMany({ ...sel, ...filter }, { $set: set })).matchedCount ?? 0;
      }
    }
    return NextResponse.json({ success: true, processed, failed: Math.max(0, body.ids.length - processed) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
