import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import "@/models/Category";
import "@/models/SizeChart";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import { resolveProductSizeChart } from "@/lib/orderSizeCharts";
import { SIZES_CM, SIZES_IN } from "@/lib/sizeChartDefaults";
import { orderLookupQuery } from "@/lib/orderLookup";
import { buildVendorPdf, fetchImageBuffer } from "@/lib/vendorPdf";

export const runtime = "nodejs";

/**
 * Rebuilds the same plain {heading, columns, rows} shape that
 * src/lib/orderSizeCharts.js's (private) toEmailChart() produces, from the
 * shared resolveProductSizeChart() primitive — mirroring the size-confirmation
 * email's chart resolution rather than inventing a new one.
 */
function buildChartForProduct(product) {
  const resolved = resolveProductSizeChart(product);
  if (!resolved) return null;

  if (resolved.type === "reusable") {
    const c = resolved.chart;
    return {
      heading: c.publicHeading || c.label || "Size Chart",
      columns: c.columns || [],
      rows: c.rows || [],
    };
  }

  const g = resolved.sizeGuide || {};
  const cm = g.sizesCm?.length ? g.sizesCm : SIZES_CM;
  const inch = g.sizesIn?.length ? g.sizesIn : SIZES_IN;
  const sizeLabel = (g.sizeName || "").trim() || "Size";
  return {
    heading: "Size Chart",
    columns: [sizeLabel, "US", "EU", "Chest (cm)", "Chest (in)", "Sleeves (cm)", "Sleeves (in)"],
    rows: cm.map((r, i) => [r.size, r.us, r.eu, r.chest, inch[i]?.chest ?? "", r.sleeves, inch[i]?.sleeves ?? ""]),
  };
}

export async function GET(req, { params }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!can(session.user, "orders.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const order = await orderLookupQuery(id).lean();
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const items = order.items || [];
    const productIds = [...new Set(items.filter((it) => it.productId).map((it) => String(it.productId)))];

    let productById = new Map();
    if (productIds.length) {
      const products = await Product.find({ _id: { $in: productIds } })
        .populate({ path: "categories", populate: { path: "sizeChart" } })
        .populate({ path: "primaryCategory", populate: { path: "sizeChart" } })
        .populate("sizeChart")
        .lean();
      productById = new Map(products.map((p) => [String(p._id), p]));
    }

    // Fetch product images and every Corporate Gifting logo in one concurrent batch.
    const lines = await Promise.all(
      items.map(async (item) => {
        const product = item.productId ? productById.get(String(item.productId)) : null;
        const selections = item.corporateGifting?.enabled ? item.corporateGifting.selections || [] : [];
        const [imageBuf, artworkBufs] = await Promise.all([
          fetchImageBuffer(item.image || product?.images?.[0] || product?.image),
          Promise.all(selections.map((sel) => fetchImageBuffer(sel.artwork?.url))),
        ]);
        const sized = !item.madeToMeasure?.enabled && !item.corporateGifting?.enabled;
        return {
          item,
          imageBuf,
          artworkBufs,
          chart: sized && product ? buildChartForProduct(product) : null,
          specs: product?.specifications || [],
        };
      })
    );

    const pdfBuffer = await buildVendorPdf({ order, lines });

    const filename = `order-${order.orderNumber}-vendor.pdf`;
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("[vendor-pdf] generation failed:", error);
    return NextResponse.json({ error: "Failed to generate vendor PDF" }, { status: 500 });
  }
}
