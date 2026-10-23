import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { can } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { trackMediaUsage, removeMediaUsage, findMediaByUrl } from "@/lib/mediaUsage";
import { copySlugCandidate, restoreStatus, slugify, uniqueSlug } from "@/lib/admin-products-utils";
import { planProductRedirects, applyProductRedirects } from "@/lib/product-redirects";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);

  // "Add new order" needs a product picker. Staff who can create orders but not view
  // products get a reduced, order-building-only projection of live (non-trashed) products.
  if (!can(session.user, "products.view")) {
    if (searchParams.get("forOrder") !== "true" || !can(session.user, "orders.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await dbConnect();
    try {
      const orderId = searchParams.get("id");
      if (orderId) {
        const product = await Product.findOne({ _id: orderId, isDeleted: { $ne: true } })
          .select("name slug price image images attributes variantCombinations stock manageStock productType status")
          .lean();
        if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
        return NextResponse.json(product);
      }
      const products = await Product.find({ isDeleted: { $ne: true } })
        .select("name price image images stock manageStock status")
        .sort({ createdAt: -1 })
        .lean();
      return NextResponse.json(products);
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const id = searchParams.get("id");
  const isDeleted = searchParams.get("isDeleted") === "true";
  const status = searchParams.get("status");

  await dbConnect();
  try {
    // Status counts for the admin list's All / Published / Drafts / Trash links
    if (searchParams.get("counts") === "true") {
      const [all, published, draft, trash] = await Promise.all([
        Product.countDocuments({ isDeleted: { $ne: true } }),
        Product.countDocuments({ isDeleted: { $ne: true }, status: "Published" }),
        Product.countDocuments({ isDeleted: { $ne: true }, status: "Draft" }),
        Product.countDocuments({ isDeleted: true }),
      ]);
      return NextResponse.json({ all, published, draft, trash });
    }

    if (id) {
      const product = await Product.findById(id).lean();
      return NextResponse.json(product);
    }

    // Live lists also include legacy products that have no isDeleted field at all
    let query = isDeleted ? { isDeleted: true } : { isDeleted: { $ne: true } };

    if (status) query.status = status;
    
    const products = await Product.find(query)
      .select('name slug price compareAtPrice status sku stock manageStock lowStockThreshold productType image images categories primaryCategory createdAt updatedAt deletedAt isDeleted')
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const data = await req.json();

    // Duplicate: copy the full stored product server-side (the list only holds a partial
    // projection) and give it a guaranteed-unique "<slug>-copy[-N]" slug.
    if (data.duplicateOf) {
      const source = await Product.findById(data.duplicateOf).lean();
      if (!source) return NextResponse.json({ error: "Product to duplicate not found" }, { status: 404 });
      const { _id, __v, createdAt, updatedAt, statusBeforeTrash, deletedAt, rating, reviewCount, ratingBreakdown, id: legacyId, ...rest } = source;
      let attempt = 1;
      let copySlug = copySlugCandidate(source.slug, attempt);
      // Checked against ALL products (trashed included) — the slug index is unique.
      while (await Product.exists({ slug: copySlug })) {
        attempt++;
        copySlug = copySlugCandidate(source.slug, attempt);
      }
      const copy = await Product.create({
        ...rest,
        name: `${source.name} (Copy)`,
        slug: copySlug,
        slugManuallyEdited: false,
        status: "Draft",
        isDeleted: false,
        deletedAt: null,
      });
      return NextResponse.json(copy, { status: 201 });
    }

    const productData = { ...data };

    // Strip empty-string ObjectId fields — Mongoose cannot cast "" to ObjectId
    if (!productData.primaryCategory) delete productData.primaryCategory;
    if (!productData.sizeChart) delete productData.sizeChart;
    for (const key of ["categories", "collections", "relatedProducts", "upsellProducts"]) {
      if (Array.isArray(productData[key])) productData[key] = productData[key].filter(Boolean);
    }

    // Unique slug (suffix only on a clash). Checked against ALL products: a trashed product
    // still holds its slug in the unique index, so skipping trashed ones made the create fail.
    productData.slug = await uniqueSlug(
      slugify(productData.slug) || slugify(productData.name) || "product",
      (candidate) => Product.exists({ slug: candidate })
    );
    delete productData.isDeleted;
    delete productData.deletedAt;

    const product = await Product.create(productData);

    // Track media usage
    const allImages = [
      ...(data.images || []),
      data.seo?.ogImage,
      ...(data.variantCombinations || []).map(v => v.image)
    ].filter(Boolean);

    for (const url of allImages) {
      const media = await findMediaByUrl(url);
      if (media) {
        await trackMediaUsage(media._id, {
          entityType: 'Product',
          entityId: product._id,
          fieldName: 'multiple',
          label: product.name
        });
      }
    }

    // Sync SizeChart assignment
    if (product.sizeChartSource === "custom" && product.sizeChart) {
      const SizeChart = (await import("@/models/SizeChart")).default;
      await SizeChart.updateMany(
        { assignmentType: "product", assignmentTargetId: product._id },
        { $set: { assignmentType: "none", assignmentTargetId: null } }
      );
      await SizeChart.findByIdAndUpdate(product.sizeChart, {
        $set: { assignmentType: "product", assignmentTargetId: product._id }
      });
    }

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const rawBody = await req.json();
    const { id, _id, __v, createdAt, updatedAt, ...data } = rawBody;

    // Strip empty-string ObjectId fields — Mongoose cannot cast "" to ObjectId
    if (!data.primaryCategory) delete data.primaryCategory;
    // An empty size chart means "none": clear it, but only when the field was actually sent
    // (a partial update that omits it must leave the product's chart alone).
    if ("sizeChart" in data && !data.sizeChart) data.sizeChart = null;
    for (const key of ["categories", "collections", "relatedProducts", "upsellProducts"]) {
      if (Array.isArray(data[key])) data[key] = data[key].filter(Boolean);
    }

    const oldProduct = await Product.findById(id);
    if (!oldProduct) {
      console.error("[Products PUT] Product not found:", id);
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Restoring from trash: put the product back to the status it had before it was
    // trashed (recorded by the trash routes), ignoring any status the caller sent; Draft if unknown.
    const isRestore = oldProduct.isDeleted && data.isDeleted === false;
    if (isRestore) {
      const raw = await Product.findById(id).select("statusBeforeTrash").lean();
      data.status = restoreStatus(raw?.statusBeforeTrash);
      data.deletedAt = null;
    }
    // Trashing goes through DELETE; never let a plain save flip the trash flag on
    if (data.isDeleted === true && !oldProduct.isDeleted) delete data.isDeleted;

    // A sent slug (editor, Quick Edit) is normalised and kept unique across ALL products —
    // the unique index would otherwise reject the save with a raw duplicate-key error.
    if ("slug" in data) {
      const wanted = slugify(data.slug) || slugify(data.name ?? oldProduct.name) || "product";
      data.slug = wanted === oldProduct.slug
        ? wanted
        : await uniqueSlug(wanted, (candidate) => Product.exists({ slug: candidate, _id: { $ne: id } }));
    }

    // Old URLs 301 to the new one when the slug or primary category changes (editor, Quick Edit)
    const redirects = await planProductRedirects(id, data);

    // Use $set so nested objects (seo, narrative, etc.) are properly merged
    const product = await Product.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: false });
    await applyProductRedirects(redirects);
    if (isRestore) {
      // Clear the trash marker (not a schema field, hence strict:false on this one $unset only)
      await Product.updateOne({ _id: id }, { $unset: { statusBeforeTrash: 1 } }, { strict: false });
    }

    // Sync SizeChart assignment if changed. Partial updates (Restore from the Trash, the list's status toggle, Quick Edit)
    // do not send the size-chart fields, and must leave the chart's assignment alone: an absent field is not "cleared".
    const sizeChartSent = "sizeChart" in data || "sizeChartSource" in data;
    const sizeChartChanged = sizeChartSent && (
      ("sizeChart" in data && String(oldProduct.sizeChart || "") !== String(data.sizeChart || "")) ||
      ("sizeChartSource" in data && oldProduct.sizeChartSource !== data.sizeChartSource)
    );

    if (sizeChartChanged) {
      const SizeChart = (await import("@/models/SizeChart")).default;

      // Clean up old size chart direct product assignment
      if (oldProduct.sizeChartSource === "custom" && oldProduct.sizeChart) {
        await SizeChart.updateOne(
          { _id: oldProduct.sizeChart, assignmentTargetId: id },
          { $set: { assignmentType: "none", assignmentTargetId: null } }
        );
      }

      // Set new size chart direct product assignment
      if (data.sizeChartSource === "custom" && data.sizeChart) {
        // Clear other assignments targeting this product first
        await SizeChart.updateMany(
          { assignmentType: "product", assignmentTargetId: id },
          { $set: { assignmentType: "none", assignmentTargetId: null } }
        );
        await SizeChart.findByIdAndUpdate(data.sizeChart, {
          $set: { assignmentType: "product", assignmentTargetId: id }
        });
      }
    }

    // Update media usage tracking
    const oldImages = [
      ...(oldProduct?.images || []),
      oldProduct?.seo?.ogImage,
      ...(oldProduct?.variantCombinations || []).map(v => v.image)
    ].filter(Boolean);

    const newImages = [
      ...(data.images || []),
      data.seo?.ogImage,
      ...(data.variantCombinations || []).map(v => v.image)
    ].filter(Boolean);

    // Remove old usage refs
    for (const url of oldImages) {
      if (!newImages.includes(url)) {
        const media = await findMediaByUrl(url);
        if (media) await removeMediaUsage(media._id, 'Product', id);
      }
    }

    // Add new usage refs
    for (const url of newImages) {
      if (!oldImages.includes(url)) {
        const media = await findMediaByUrl(url);
        if (media) {
          await trackMediaUsage(media._id, {
            entityType: 'Product',
            entityId: id,
            fieldName: 'multiple',
            label: product.name
          });
        }
      }
    }

    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  await dbConnect();
  try {
    const existing = await Product.findById(id).select("status isDeleted").lean();
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (existing.isDeleted) return NextResponse.json({ message: "Product already in trash" });
    // Soft delete, remembering the status so a restore can put it back.
    // statusBeforeTrash is not in the Product schema, hence strict:false.
    const product = await Product.findByIdAndUpdate(
      id,
      { $set: { isDeleted: true, deletedAt: new Date(), statusBeforeTrash: existing.status || "Draft" } },
      { new: true, strict: false }
    );
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
