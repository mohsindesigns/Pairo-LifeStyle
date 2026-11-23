import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { can } from "@/lib/rbac";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!can(session.user, "products.view") && !can(session.user, "products.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug")?.trim().toLowerCase();
    const excludeId = searchParams.get("excludeId");

    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    await dbConnect();

    // Trashed products still hold their slug (the slug index is unique), so they count as taken
    const query = { slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existingProduct = await Product.findOne(query).select("_id").lean();

    return NextResponse.json({ success: true, unique: !existingProduct });
  } catch (error) {
    console.error("Check Slug Error:", error);
    return NextResponse.json({ error: "Failed to verify slug uniqueness" }, { status: 500 });
  }
}
