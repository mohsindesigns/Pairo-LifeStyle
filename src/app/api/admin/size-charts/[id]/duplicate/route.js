import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import SizeChart from "@/models/SizeChart";
import { can } from "@/lib/rbac";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { copyLabelCandidates, pickCopyLabel, buildSizeChartCopy } from "../../helpers";

// POST: copy a size chart as an unassigned Draft named "<label> (Copy)".
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Size chart not found" }, { status: 404 });

  await dbConnect();
  try {
    const source = await SizeChart.findById(id).lean();
    if (!source) return NextResponse.json({ error: "Size chart not found" }, { status: 404 });

    // Labels are unique across live and trashed charts, so check both.
    const candidates = copyLabelCandidates(source.label);
    const taken = await SizeChart.find({ label: { $in: candidates } }).select("label").lean();
    const label = pickCopyLabel(source.label, taken.map((t) => t.label));
    if (!label) return NextResponse.json({ error: "Could not find a free name for the copy." }, { status: 400 });

    const copy = await SizeChart.create(buildSizeChartCopy(source, label));
    return NextResponse.json(copy, { status: 201 });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: "A size chart with that name was just created. Try again." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
