import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import SizeChartItem from "@/models/SizeChartItem";

/**
 * GET /api/size-chart/items
 * Public endpoint — returns all enabled size chart entries sorted by order.
 */
export async function GET() {
  try {
    await dbConnect();

    const items = await SizeChartItem
      .find({ enabled: true })
      .sort({ order: 1, createdAt: -1 })
      .lean();

    return NextResponse.json(items);
  } catch (err) {
    console.error("[SizeChart Items GET Error]", err);
    return NextResponse.json([]);
  }
}
