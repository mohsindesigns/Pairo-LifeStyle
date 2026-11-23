import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";

export const dynamic = "force-dynamic";

export async function GET(req) {
  await dbConnect();
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit")) || 6;
    
    const blogs = await Blog.find({ 
      status: 'Published',
      isDeleted: { $ne: true }
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

    return NextResponse.json(blogs);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
