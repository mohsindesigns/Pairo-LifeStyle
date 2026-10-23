import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import dbConnect from "@/lib/db";
import SizeChartItem from "@/models/SizeChartItem";

// POST: copy an item as "<title> (Copy)", hidden, placed at the end of the list.
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // This module's create/edit/delete all use products.edit (see sibling routes).
  if (!can(session.user, "products.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await dbConnect();
  try {
    const source = await SizeChartItem.findById(id).lean();
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const maxItem = await SizeChartItem.findOne({ isDeleted: { $ne: true } }).sort({ order: -1 }).lean();
    const baseTitle = String(source.title || "Size chart").replace(/\s*\(Copy(?: \d+)?\)$/i, "");
    const copy = await SizeChartItem.create({
      title: `${baseTitle} (Copy)`,
      description: source.description || "",
      image: source.image,
      order: (maxItem?.order ?? -1) + 1,
      enabled: false,
    });
    return NextResponse.json(copy, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
