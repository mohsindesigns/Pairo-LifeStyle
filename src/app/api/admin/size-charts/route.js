import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import SizeChart from "@/models/SizeChart";
import Category from "@/models/Category";
import Product from "@/models/Product";
import { can } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { sizeChartViewQuery, pickEditableSizeChartFields } from "./helpers";

// GET: List size charts. ?trash=true lists the trash instead of live charts.
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("trash") === "true" ? "trash" : "all";
    const sizeCharts = await SizeChart.find(sizeChartViewQuery(view))
      .select("-trashedRefs")
      .sort({ createdAt: -1 })
      .lean();

    // Fetch related category and product details for assignments
    const categoryIds = sizeCharts
      .filter((sc) => sc.assignmentType === "category" && sc.assignmentTargetId)
      .map((sc) => sc.assignmentTargetId);
    const productIds = sizeCharts
      .filter((sc) => sc.assignmentType === "product" && sc.assignmentTargetId)
      .map((sc) => sc.assignmentTargetId);

    const [categories, products, activeProducts] = await Promise.all([
      Category.find({ _id: { $in: categoryIds } }).select("name slug isDeleted").lean(),
      Product.find({ _id: { $in: productIds } }).select("name slug isDeleted").lean(),
      Product.find({ isDeleted: { $ne: true } }).select("primaryCategory categories sizeChartSource sizeChart").lean()
    ]);

    const categoryMap = Object.fromEntries(categories.map((c) => [c._id.toString(), c]));
    const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

    // Map through size charts to compute usage counts and assignment info
    const resolvedCharts = sizeCharts.map((sc) => {
      const scIdStr = sc._id.toString();
      let assignedTo = null;
      let usageCount = 0;

      if (sc.assignmentType === "category" && sc.assignmentTargetId) {
        const cat = categoryMap[sc.assignmentTargetId.toString()];
        assignedTo = cat ? { type: "Category", name: cat.name, slug: cat.slug, id: cat._id, trashed: !!cat.isDeleted } : null;

        // Count products inheriting this category default
        const catIdStr = sc.assignmentTargetId.toString();
        usageCount = activeProducts.filter(
          (p) =>
            p.sizeChartSource === "category_default" &&
            (p.primaryCategory?.toString() === catIdStr || p.categories?.some((c) => c.toString() === catIdStr))
        ).length;
      } else if (sc.assignmentType === "product" && sc.assignmentTargetId) {
        const prod = productMap[sc.assignmentTargetId.toString()];
        assignedTo = prod ? { type: "Product", name: prod.name, slug: prod.slug, id: prod._id, trashed: !!prod.isDeleted } : null;

        // Directly assigned to this product
        usageCount = activeProducts.filter(
          (p) => p.sizeChartSource === "custom" && p.sizeChart?.toString() === scIdStr
        ).length;
      } else {
        // Unassigned, but check if any products override using this chart anyway
        usageCount = activeProducts.filter(
          (p) => p.sizeChartSource === "custom" && p.sizeChart?.toString() === scIdStr
        ).length;
      }

      return {
        ...sc,
        assignedTo,
        usageCount
      };
    });

    return NextResponse.json(resolvedCharts);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new size chart
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const data = pickEditableSizeChartFields(await req.json());
    if (typeof data.label === "string") data.label = data.label.trim();
    if (!data.label) return NextResponse.json({ error: "Size chart label is required." }, { status: 400 });

    // Labels are unique across live AND trashed charts (unique index).
    const existing = await SizeChart.findOne({ label: data.label }).select("isDeleted").lean();
    if (existing) {
      return NextResponse.json({
        error: existing.isDeleted
          ? "A size chart in the Trash already uses this label. Restore it or delete it permanently first."
          : "A size chart with this label already exists."
      }, { status: 400 });
    }

    const sizeChart = await SizeChart.create(data);

    const scId = sizeChart._id;

    // Handle assignments
    if (data.assignmentType === "category" && data.assignmentTargetId) {
      // 1. Assign to Category
      await Category.findByIdAndUpdate(data.assignmentTargetId, { $set: { sizeChart: scId } });
    } else if (data.assignmentType === "product" && data.assignmentTargetId) {
      // 2. Assign to Product
      await Product.findByIdAndUpdate(data.assignmentTargetId, {
        $set: { sizeChart: scId, sizeChartSource: "custom" }
      });
    }

    return NextResponse.json(sizeChart);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
