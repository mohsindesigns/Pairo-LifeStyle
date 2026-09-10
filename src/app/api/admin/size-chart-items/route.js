import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import dbConnect from "@/lib/db";
import SizeChartItem from "@/models/SizeChartItem";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const items = await SizeChartItem
      .find({ tenantId: "DEFAULT_STORE" })
      .sort({ order: 1, createdAt: -1 })
      .lean();
    return NextResponse.json(items);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const body = await req.json();
    const { title, description, image, order, enabled } = body;

    if (!image) return NextResponse.json({ error: "Image is required" }, { status: 400 });
    if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const maxItem = await SizeChartItem.findOne({ tenantId: "DEFAULT_STORE" }).sort({ order: -1 }).lean();
    const nextOrder = order !== undefined ? order : ((maxItem?.order ?? -1) + 1);

    const item = await SizeChartItem.create({
      title: title.trim(),
      description: description?.trim() || "",
      image,
      order: nextOrder,
      enabled: enabled !== undefined ? enabled : true,
      tenantId: "DEFAULT_STORE"
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
