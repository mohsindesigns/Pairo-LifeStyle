import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import CorporateGiftingInquiry from "@/models/CorporateGiftingInquiry";
import { can } from "@/lib/rbac";

const STATUSES = ["New", "Contacted", "Quoted", "In Progress", "Completed", "Cancelled"];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "submissions.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "20"));
  const search = (searchParams.get("search") || "").trim();
  const status = searchParams.get("status") || "all";

  const query = { isDeleted: false };
  if (status !== "all") query.status = status;
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: "i" };
    query.$or = [{ company: rx }, { contactName: rx }, { email: rx }, { occasion: rx }];
  }

  try {
    const [items, total, counts] = await Promise.all([
      CorporateGiftingInquiry.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      CorporateGiftingInquiry.countDocuments(query),
      CorporateGiftingInquiry.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ])
    ]);

    const statusCounts = { all: counts.reduce((a, c) => a + c.count, 0) };
    for (const s of STATUSES) statusCounts[s] = counts.find((c) => c._id === s)?.count || 0;

    return NextResponse.json({
      items,
      pagination: { total, pages: Math.ceil(total / limit), page, limit },
      counts: statusCounts
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
