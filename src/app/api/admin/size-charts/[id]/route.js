import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import SizeChart from "@/models/SizeChart";
import Category from "@/models/Category";
import Product from "@/models/Product";
import { can } from "@/lib/rbac";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { pickEditableSizeChartFields } from "../helpers";

const badId = (id) => !mongoose.Types.ObjectId.isValid(id);

// GET: Retrieve a single size chart (trashed charts too, flagged isDeleted,
// so the editor can offer "Restore" instead of a dead end).
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  if (badId(id)) return NextResponse.json({ error: "Size chart not found" }, { status: 404 });

  await dbConnect();
  try {
    const sizeChart = await SizeChart.findById(id).select("-trashedRefs").lean();
    if (!sizeChart) {
      return NextResponse.json({ error: "Size chart not found" }, { status: 404 });
    }
    return NextResponse.json(sizeChart);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Update a size chart
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (badId(id)) return NextResponse.json({ error: "Size chart not found" }, { status: 404 });
  const raw = await req.json();

  await dbConnect();
  try {
    const oldChart = await SizeChart.findById(id).lean();
    if (!oldChart) {
      return NextResponse.json({ error: "Size chart not found" }, { status: 404 });
    }

    // Restore from trash: { isDeleted: false }
    if (raw.isDeleted === false) {
      if (!oldChart.isDeleted) return NextResponse.json(oldChart);
      const restored = await restoreSizeChart(oldChart);
      return NextResponse.json(restored);
    }

    if (oldChart.isDeleted) {
      return NextResponse.json({ error: "This size chart is in the Trash. Restore it before editing." }, { status: 409 });
    }

    const data = pickEditableSizeChartFields(raw);
    if (typeof data.label === "string") data.label = data.label.trim();

    // Labels are unique across live AND trashed charts (unique index).
    if (data.label) {
      const existing = await SizeChart.findOne({ _id: { $ne: id }, label: data.label }).select("isDeleted").lean();
      if (existing) {
        return NextResponse.json({
          error: existing.isDeleted
            ? "A size chart in the Trash already uses this label. Restore it or delete it permanently first."
            : "A size chart with this label already exists."
        }, { status: 400 });
      }
    }

    const updatedChart = await SizeChart.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    ).lean();

    // Check if assignment changed
    // Partial payloads (e.g. bulk "Move to Draft" sends only { status }) leave
    // the assignment alone.
    const assignmentChanged =
      data.assignmentType !== undefined &&
      (oldChart.assignmentType !== data.assignmentType ||
        String(oldChart.assignmentTargetId || "") !== String(data.assignmentTargetId || ""));

    if (assignmentChanged) {
      // 1. Clean up old assignment
      if (oldChart.assignmentType === "category" && oldChart.assignmentTargetId) {
        await Category.updateOne(
          { _id: oldChart.assignmentTargetId, sizeChart: id },
          { $set: { sizeChart: null } }
        );
      } else if (oldChart.assignmentType === "product" && oldChart.assignmentTargetId) {
        await Product.updateOne(
          { _id: oldChart.assignmentTargetId, sizeChart: id },
          { $set: { sizeChart: null, sizeChartSource: "category_default" } }
        );
      }

      // 2. Apply new assignment
      if (data.assignmentType === "category" && data.assignmentTargetId) {
        // Clear this size chart from any other categories first
        await Category.updateMany({ sizeChart: id }, { $set: { sizeChart: null } });
        await Category.findByIdAndUpdate(data.assignmentTargetId, { $set: { sizeChart: id } });
      } else if (data.assignmentType === "product" && data.assignmentTargetId) {
        // Clear this size chart from any other products first
        await Product.updateMany(
          { sizeChart: id },
          { $set: { sizeChart: null, sizeChartSource: "category_default" } }
        );
        await Product.findByIdAndUpdate(data.assignmentTargetId, {
          $set: { sizeChart: id, sizeChartSource: "custom" }
        });
      } else if (data.assignmentType === "none") {
        // Clear references
        await Category.updateMany({ sizeChart: id }, { $set: { sizeChart: null } });
        await Product.updateMany(
          { sizeChart: id },
          { $set: { sizeChart: null, sizeChartSource: "category_default" } }
        );
      }
    }

    return NextResponse.json(updatedChart);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: move to trash (default), or ?mode=permanent to delete a chart that is
// already in the trash.
//
// Trash clears the chart from categories/products (so the storefront and order
// emails fall back to "no chart" without any extra checks) and remembers those
// references in trashedRefs so a restore can put them back.
export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (badId(id)) return NextResponse.json({ error: "Size chart not found" }, { status: 404 });
  const mode = new URL(req.url).searchParams.get("mode");

  await dbConnect();
  try {
    const chart = await SizeChart.findById(id).lean();
    if (!chart) return NextResponse.json({ error: "Size chart not found" }, { status: 404 });

    if (mode === "permanent") {
      if (!chart.isDeleted) {
        return NextResponse.json({ error: "Move the size chart to the trash before deleting it permanently." }, { status: 409 });
      }
      await SizeChart.findByIdAndDelete(id);
      // Defensive: nothing should still point at it, but never leave a dangling ref.
      await Category.updateMany({ sizeChart: id }, { $set: { sizeChart: null } });
      await Product.updateMany(
        { sizeChart: id },
        { $set: { sizeChart: null, sizeChartSource: "category_default" } }
      );
      return NextResponse.json({ success: true, message: "Size chart permanently deleted" });
    }

    if (chart.isDeleted) return NextResponse.json({ success: true, message: "Size chart already in trash" });

    const [cats, prods] = await Promise.all([
      Category.find({ sizeChart: id }).select("_id").lean(),
      Product.find({ sizeChart: id }).select("_id sizeChartSource").lean(),
    ]);
    const trashedRefs = [
      ...cats.map((c) => ({ kind: "category", id: c._id, source: null })),
      ...prods.map((p) => ({ kind: "product", id: p._id, source: p.sizeChartSource || null })),
    ];

    await SizeChart.updateOne(
      { _id: id },
      { $set: { isDeleted: true, deletedAt: new Date(), trashedRefs } }
    );

    // Clear references from categories and products
    await Category.updateMany({ sizeChart: id }, { $set: { sizeChart: null } });
    await Product.updateMany(
      { sizeChart: id },
      { $set: { sizeChart: null, sizeChartSource: "category_default" } }
    );

    return NextResponse.json({ success: true, message: "Size chart moved to trash" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Put back the references cleared by the trash, but only where nothing else has
// been assigned in the meantime. If the chart's own assignment target was taken
// by another chart, the restored chart becomes unassigned.
async function restoreSizeChart(chart) {
  const id = chart._id;
  const refs = Array.isArray(chart.trashedRefs) ? chart.trashedRefs : [];
  const catIds = refs.filter((r) => r.kind === "category").map((r) => r.id);
  const prodRefs = refs.filter((r) => r.kind === "product");

  if (catIds.length) {
    await Category.updateMany(
      { _id: { $in: catIds }, $or: [{ sizeChart: null }, { sizeChart: { $exists: false } }] },
      { $set: { sizeChart: id } }
    );
  }
  for (const ref of prodRefs) {
    await Product.updateOne(
      { _id: ref.id, $or: [{ sizeChart: null }, { sizeChart: { $exists: false } }] },
      { $set: { sizeChart: id, sizeChartSource: ref.source || "custom" } }
    );
  }

  const update = { isDeleted: false, deletedAt: null, trashedRefs: [] };
  if (chart.assignmentType === "category" && chart.assignmentTargetId) {
    const ok = await Category.exists({ _id: chart.assignmentTargetId, sizeChart: id });
    if (!ok) Object.assign(update, { assignmentType: "none", assignmentTargetId: null });
  } else if (chart.assignmentType === "product" && chart.assignmentTargetId) {
    const ok = await Product.exists({ _id: chart.assignmentTargetId, sizeChart: id });
    if (!ok) Object.assign(update, { assignmentType: "none", assignmentTargetId: null });
  }

  return SizeChart.findByIdAndUpdate(id, { $set: update }, { new: true }).select("-trashedRefs").lean();
}
