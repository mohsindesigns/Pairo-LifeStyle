import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { can } from "@/lib/rbac";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "corporate_gifting.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { searchParams } = new URL(req.url);
  const enabledOnly = searchParams.get("enabledOnly") !== "false";
  const search = (searchParams.get("search") || "").trim();

  const query = { isDeleted: { $ne: true } };
  if (enabledOnly) query["corporateGifting.enabled"] = true;
  if (search) query.name = { $regex: search, $options: "i" };

  const products = await Product.find(query)
    .select("name slug image images price status corporateGifting")
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  return NextResponse.json({ success: true, products });
}
