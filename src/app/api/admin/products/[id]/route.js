import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { can } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { registerRedirect } from "@/lib/redirect-resolver";

// GET single product with relations
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();
  try {
    const product = await Product.findById(id)
      .populate('categories')
      .populate('primaryCategory')
      .populate('collections')
      .populate('relatedProducts')
      .populate('upsellProducts');
      
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT update product with full schema support
export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();
  try {
    const data = await req.json();
    
    const oldProduct = await Product.findById(id).populate('categories').populate('primaryCategory');
    if (!oldProduct) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Auto-generate slug if it's being updated or missing
    let slug = data.slug;
    if (data.name && (!slug || slug === "")) {
      slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    if (!slug) slug = oldProduct.slug || "product";

    // Ensure uniqueness within the tenant without appending suffixes unless a duplicate exists
    let finalSlug = slug;
    let counter = 1;
    const tenantId = oldProduct.tenantId || "DEFAULT_STORE";
    while (await Product.findOne({ slug: finalSlug, tenantId, _id: { $ne: id } })) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }
    data.slug = finalSlug;

    // Register redirect if slug or primary category changed
    const { getProductPrimaryCategorySlug } = await import("@/lib/routes");
    const oldCatSlugRaw = getProductPrimaryCategorySlug(oldProduct);
    const oldCatSlug = oldCatSlugRaw === 'uncategorized' ? 'shop' : oldCatSlugRaw;

    const tempNewProduct = {
      ...oldProduct.toObject(),
      ...data
    };
    const newCatSlugRaw = getProductPrimaryCategorySlug(tempNewProduct);
    const newCatSlug = newCatSlugRaw === 'uncategorized' ? 'shop' : newCatSlugRaw;

    const slugChanged = oldProduct.slug !== finalSlug;
    const categoryChanged = oldCatSlug !== newCatSlug;

    if (slugChanged || categoryChanged) {
      const oldPath = `/${oldCatSlug}/${oldProduct.slug}`;
      const newPath = `/${newCatSlug}/${finalSlug}`;
      await registerRedirect(oldPath, newPath);
      await registerRedirect(`/product/${oldProduct.slug}`, newPath);
      await registerRedirect(`/product/${finalSlug}`, newPath);
    }

    const product = await Product.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
    return NextResponse.json(product);
  } catch (error) {
    console.error("PUT Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE (Move to Trash)
export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();
  try {
    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.isDeleted) {
      // Clean up media usage references
      try {
        const { removeMediaUsage, findMediaByUrl } = await import("@/lib/mediaUsage");
        const productImages = [
          ...(product.images || []),
          product.seo?.ogImage,
          ...(product.variantCombinations || []).map(v => v.image)
        ].filter(Boolean);

        for (const url of productImages) {
          const media = await findMediaByUrl(url);
          if (media) {
            await removeMediaUsage(media._id, 'Product', id);
          }
        }
      } catch (mediaErr) {
        console.error("Failed to clean up media usage references:", mediaErr);
      }

      // Clean related and upsell product references
      await Product.updateMany({ relatedProducts: id }, { $pull: { relatedProducts: id } });
      await Product.updateMany({ upsellProducts: id }, { $pull: { upsellProducts: id } });

      await Product.findByIdAndDelete(id);
      return NextResponse.json({ message: "Product permanently deleted" });
    } else {
      product.isDeleted = true;
      product.status = 'Draft';
      await product.save();
      return NextResponse.json({ message: "Product moved to trash", product });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
