import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import mongoose from "mongoose";
import { can } from "@/lib/rbac";

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "corporate_gifting.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  await dbConnect();
  const product = await Product.findOne({ _id: id, isDeleted: { $ne: true } })
    .select("name slug image images price status corporateGifting")
    .lean();

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  return NextResponse.json({ success: true, product });
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "corporate_gifting.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { enabled, minSelections, items } = body;

  // A present-but-malformed _id must be rejected, not silently replaced with a new one —
  // swapping it in would orphan any existing cart/order reference to that itemId.
  const hasMalformedId = Array.isArray(items) && items.some((i) => i?._id && !mongoose.isValidObjectId(i._id));
  if (hasMalformedId) {
    return NextResponse.json({ error: "One of the submitted items has an invalid id." }, { status: 400 });
  }

  // `items`/`minSelections` are only overwritten when actually present in the request body —
  // a caller that just flips `enabled` (e.g. the "Enable for a product" picker) must not wipe
  // out a previously-configured item catalog or minSelections for a product being re-enabled.
  // Built as dot-notation $set fields (rather than reading the whole corporateGifting object,
  // mutating it, and saving the whole thing back) so two admins editing different parts of the
  // same product's config at nearly the same time (one flips `enabled`, another edits `items`)
  // each only touch their own fields atomically instead of racing to overwrite the other's.
  const setFields = {};
  if (enabled !== undefined) setFields["corporateGifting.enabled"] = !!enabled;
  if (minSelections !== undefined && minSelections !== null) {
    const n = Number(minSelections);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: "minSelections must be a positive number." }, { status: 400 });
    }
    setFields["corporateGifting.minSelections"] = n;
  }
  if (Array.isArray(items)) {
    setFields["corporateGifting.items"] = items
      .filter((i) => i && String(i.name || "").trim())
      .map((i) => ({
        _id: i._id ? i._id : new mongoose.Types.ObjectId(),
        name: String(i.name).trim(),
        image: i.image || "",
        priceDelta: Number(i.priceDelta) || 0,
        active: i.active !== false,
      }));
  }

  await dbConnect();

  // A raw $set on a not-yet-existing `corporateGifting` subdocument path doesn't apply Mongoose
  // schema defaults the way a full document save would, so the very first time a product is
  // configured, fill in sensible defaults for whichever fields this particular call didn't send.
  const existing = await Product.findOne({ _id: id, isDeleted: { $ne: true } }).select("corporateGifting").lean();
  if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (!existing.corporateGifting) {
    if (setFields["corporateGifting.enabled"] === undefined) setFields["corporateGifting.enabled"] = false;
    if (setFields["corporateGifting.minSelections"] === undefined) setFields["corporateGifting.minSelections"] = 3;
    if (setFields["corporateGifting.items"] === undefined) setFields["corporateGifting.items"] = [];
  }

  const product = await Product.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: setFields },
    { new: true }
  );
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  return NextResponse.json({ success: true, product: product.toObject() });
}
