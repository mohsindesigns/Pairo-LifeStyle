import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import CustomJacketInquiry from "@/models/CustomJacketInquiry";
import { can } from "@/lib/rbac";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "submissions.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";

  const query = { isDeleted: false, tenantId: "DEFAULT_STORE" };
  if (status !== "all") query.status = status;
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { jacketType: { $regex: search, $options: "i" } }
    ];
  }

  try {
    const [items, total] = await Promise.all([
      CustomJacketInquiry.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CustomJacketInquiry.countDocuments(query)
    ]);

    const counts = await CustomJacketInquiry.aggregate([
      { $match: { isDeleted: false, tenantId: "DEFAULT_STORE" } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const statusCounts = {
      all: counts.reduce((a, c) => a + c.count, 0),
      New: counts.find(c => c._id === "New")?.count || 0,
      Contacted: counts.find(c => c._id === "Contacted")?.count || 0,
      "In Progress": counts.find(c => c._id === "In Progress")?.count || 0,
      Completed: counts.find(c => c._id === "Completed")?.count || 0,
      Cancelled: counts.find(c => c._id === "Cancelled")?.count || 0,
    };

    return NextResponse.json({
      items,
      pagination: { total, pages: Math.ceil(total / limit), page, limit },
      counts: statusCounts
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
