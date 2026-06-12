import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { can } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { trackMediaUsage, removeMediaUsage, findMediaByUrl } from "@/lib/mediaUsage";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const isDeleted = searchParams.get("isDeleted") === "true";
  const status = searchParams.get("status");

  await dbConnect();
  try {
    if (id) {
      const product = await Product.findById(id).lean();
      return NextResponse.json(product);
    }

    const tenantId = searchParams.get('tenantId');
    
    let query = { isDeleted };
    if (tenantId) query.tenantId = tenantId;
    
    if (status) query.status = status;
    
    const products = await Product.find(query)
      .select('name slug price status sku stock manageStock images categories createdAt isDeleted')
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
    
    // Inject tenantId (Mandatory for SaaS Hardening)
    const productData = {
        ...data,
        tenantId: data.tenantId || "DEFAULT_STORE"
    };

    // Generate slug cleanly
    let slug = productData.slug;
    if (!slug && productData.name) {
      slug = productData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    if (!slug) slug = "product";
    
    // Ensure uniqueness within the tenant without appending suffixes unless a duplicate exists
    let finalSlug = slug;
    let counter = 1;
    const tenantId = productData.tenantId || "DEFAULT_STORE";
    while (await Product.findOne({ slug: finalSlug, tenantId })) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }
    productData.slug = finalSlug;

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
    const { id, tenantId, _id, __v, createdAt, updatedAt, ...data } = rawBody;
    
    console.log("[Products PUT] Updating product:", id, "with seo:", data.seo);
    
    // Find by _id only (tenantId may not be present on legacy products)
    const oldProduct = await Product.findById(id);
    if (!oldProduct) {
      console.error("[Products PUT] Product not found:", id);
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Use $set so nested objects (seo, narrative, etc.) are properly merged
    const product = await Product.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: false });
    console.log("[Products PUT] Saved seo:", product?.seo);

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
  const tenantId = searchParams.get("tenantId") || "DEFAULT_STORE";

  await dbConnect();
  try {
    // Scoped Soft delete
    const product = await Product.findOneAndUpdate({ _id: id, tenantId }, { isDeleted: true }, { new: true });
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
