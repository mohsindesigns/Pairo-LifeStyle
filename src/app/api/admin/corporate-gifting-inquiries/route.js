import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import CorporateGiftingInquiry from "@/models/CorporateGiftingInquiry";
import { can } from "@/lib/rbac";
import {
  NOT_TRASHED, TRASHED, buildListQuery, buildStatusCounts, pageInfo, parsePaging,
  validIds, trashUpdate, restoreUpdate,
} from "@/app/api/admin/submissions/inbox-utils";

const STATUSES = ["New", "Contacted", "Quoted", "In Progress", "Completed", "Cancelled"];
const SEARCH_FIELDS = ["company", "contactName", "email", "phone", "occasion", "country", "city"];

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
      CorporateGiftingInquiry.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      CorporateGiftingInquiry.countDocuments(query),
      CorporateGiftingInquiry.aggregate([
        { $match: NOT_TRASHED },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      CorporateGiftingInquiry.countDocuments(TRASHED),
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
// "delete" is permanent and only touches inquiries already in the Trash.
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
  if (action === "status" && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const ids = validIds(body.ids);
  await dbConnect();
  try {
    let processed = 0;
    if (ids.length) {
      const sel = { _id: { $in: ids } };
      if (action === "delete") {
        processed = (await CorporateGiftingInquiry.deleteMany({ ...sel, ...TRASHED })).deletedCount || 0;
      } else {
        const [filter, set] = action === "status" ? [NOT_TRASHED, { status: body.status }]
          : action === "trash" ? [NOT_TRASHED, trashUpdate()]
          : [TRASHED, restoreUpdate()];
        const r = await CorporateGiftingInquiry.updateMany({ ...sel, ...filter }, { $set: set });
        processed = r.matchedCount ?? 0;
      }
    }
    return NextResponse.json({ success: true, processed, failed: Math.max(0, body.ids.length - processed) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
