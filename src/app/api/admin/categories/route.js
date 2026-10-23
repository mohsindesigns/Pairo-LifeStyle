import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Category from "@/models/Category";
import { can } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { stripServerManagedFields, slugCandidates } from "./helpers";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type") || "product";
  const trash = searchParams.get("trash") === "true";

  if (!can(session.user, "products.view") && !can(session.user, "blogs.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();
  try {
    if (id) {
      const category = await Category.findById(id).lean();
      if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });
      return NextResponse.json(category);
    }

    // Legacy categories may have no isDeleted field at all; treat them as live.
    const query = { isDeleted: trash ? true : { $ne: true } };
    if (type === "product") {
       query.$or = [{ type: "product" }, { type: { $exists: false } }];
    } else {
       query.type = type;
    }
    const categories = await Category.find(query).sort({ name: 1 }).lean();
    
    // Compute product counts in a single aggregation pipeline to avoid N+1 queries
    const Product = (await import("@/models/Product")).default;
    const categoryCounts = await Product.aggregate([
      { $match: { isDeleted: false, status: 'Published' } },
      { $unwind: '$categories' },
      { $group: { _id: '$categories', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    categoryCounts.forEach(c => {
      if (c._id) {
        countMap[c._id.toString()] = c.count;
      }
    });

    const mappedCategories = categories.map((cat) => {
      if (cat.type === 'product' || !cat.type) {
        return { ...cat, productCount: countMap[cat._id.toString()] || 0 };
      }
      return cat;
    });

    return NextResponse.json(mappedCategories);
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
    
    const type = data.type || "product";
    
    // Route Collision Detection
    const { validateSlug } = await import("@/lib/routes-server");

    // Duplicate flow: pick the first free slug (base, base-2, ...) across live AND
    // trashed categories of this type, so a duplicate never revives a trashed one.
    if (data.uniqueSlug) {
      let freeSlug = null;
      for (const candidate of slugCandidates(data.slug || data.name)) {
        const taken = await Category.exists({ slug: candidate, type });
        if (taken) continue;
        const check = await validateSlug(candidate);
        if (check.valid) { freeSlug = candidate; break; }
      }
      if (!freeSlug) return NextResponse.json({ error: "Could not find a free slug for the copy." }, { status: 400 });
      data.slug = freeSlug;
    }

    const collisionCheck = await validateSlug(data.slug);
    if (!collisionCheck.valid) {
      return NextResponse.json({ error: collisionCheck.error }, { status: 400 });
    }
    
    // Check if a category with this slug already exists (even if deleted) in the SAME type
    const existing = await Category.findOne({ slug: data.slug, type });
    
    let category;
    if (existing) {
       if (existing.isDeleted) {
          // Restore the deleted category
          existing.isDeleted = false;
          existing.deletedAt = null;
          existing.name = data.name; 
          existing.type = type;
          existing.image = data.image || existing.image;
          existing.banner = data.banner || existing.banner;
          existing.showBannerOverlay = data.showBannerOverlay !== undefined ? data.showBannerOverlay : existing.showBannerOverlay;
          existing.description = data.description || existing.description;
          existing.content = data.content || existing.content;
          existing.status = data.status || existing.status;
          existing.isFeatured = data.isFeatured || existing.isFeatured;
          if (data.seo) existing.seo = { ...existing.seo, ...data.seo };
          category = await existing.save();
       } else {
          return NextResponse.json({ error: "A category with this slug already exists." }, { status: 400 });
       }
    } else {
       category = await Category.create({ ...stripServerManagedFields(data), type });
    }

    // Handle Linked Items
    if (data.linkedItems && Array.isArray(data.linkedItems)) {
       const mongoose = require('mongoose');
       const objectIds = data.linkedItems.map(lid => new mongoose.Types.ObjectId(lid));
       
       if (type === 'product' && objectIds.length > 0) {
          const Product = (await import("@/models/Product")).default;
          // Add to newly linked products
          await Product.updateMany(
             { _id: { $in: objectIds } },
             { $addToSet: { categories: category._id } }
          );
       } else if (type === 'blog' && objectIds.length > 0) {
          const Blog = (await import("@/models/Blog")).default;
          // Add to newly linked blogs
          await Blog.updateMany(
             { _id: { $in: objectIds } },
             { $set: { category: category.name } }
          );
       }
    }

    // Sync SizeChart assignment if set
    if (data.sizeChart) {
      const SizeChart = (await import("@/models/SizeChart")).default;
      await SizeChart.updateMany(
        { assignmentType: "category", assignmentTargetId: category._id },
        { $set: { assignmentType: "none", assignmentTargetId: null } }
      );
      await SizeChart.findByIdAndUpdate(data.sizeChart, {
        $set: { assignmentType: "category", assignmentTargetId: category._id }
      });
    }

    return NextResponse.json(category, { status: 201 });
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
    const { id, ...data } = await req.json();
    const mongoose = require('mongoose');
    // Never let a client payload rewrite server-managed bookkeeping.
    delete data._id; delete data.__v; delete data.createdAt; delete data.updatedAt; delete data.productCount;
    // Restore from trash ({ id, isDeleted: false }) clears the trash timestamp;
    // trashing goes through DELETE so it is stamped there.
    if (data.isDeleted === false) data.deletedAt = null;
    else { delete data.isDeleted; delete data.deletedAt; }
    const oldCategory = await Category.findById(id);
    if (!oldCategory) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    // Route Collision Detection
    if (data.slug && oldCategory.slug !== data.slug) {
      const { validateSlug } = await import("@/lib/routes-server");
      const collisionCheck = await validateSlug(data.slug, id);
      if (!collisionCheck.valid) {
        return NextResponse.json({ error: collisionCheck.error }, { status: 400 });
      }
    }

    // Register redirect if slug changed
    if (data.slug && oldCategory.slug && oldCategory.slug !== data.slug) {
      const { registerRedirect } = await import("@/lib/redirect-resolver");
      await registerRedirect(`/shop/${oldCategory.slug}`, `/collections/${data.slug}`);
      await registerRedirect(`/${oldCategory.slug}`, `/collections/${data.slug}`);
      await registerRedirect(`/collections/${oldCategory.slug}`, `/collections/${data.slug}`);
      await registerRedirect(`/product-category/${oldCategory.slug}`, `/collections/${data.slug}`);

      // Register redirects for all products in this category
      const Product = (await import("@/models/Product")).default;
      const products = await Product.find({ categories: id, isDeleted: { $ne: true } }).lean();
      for (const prod of products) {
        if (prod.slug) {
          await registerRedirect(`/${oldCategory.slug}/${prod.slug}`, `/product/${prod.slug}`);
          await registerRedirect(`/collections/${oldCategory.slug}/${prod.slug}`, `/product/${prod.slug}`);
          await registerRedirect(`/product-category/${oldCategory.slug}/${prod.slug}`, `/product/${prod.slug}`);
        }
      }
    }

    const category = await Category.findByIdAndUpdate(id, data, { new: true });

    // Sync SizeChart assignment if changed
    // Partial payloads (e.g. restore from trash: { id, isDeleted: false }) must not
    // clear the size chart / media usage, so only sync fields that were sent.
    if (data.sizeChart !== undefined && String(oldCategory.sizeChart || "") !== String(data.sizeChart || "")) {
      const SizeChart = (await import("@/models/SizeChart")).default;
      
      // Clean up old size chart assignment
      if (oldCategory.sizeChart) {
        await SizeChart.updateOne(
          { _id: oldCategory.sizeChart, assignmentTargetId: id },
          { $set: { assignmentType: "none", assignmentTargetId: null } }
        );
      }
      
      // Set new size chart assignment
      if (data.sizeChart) {
        // Clear other assignments using this chart
        await SizeChart.updateMany(
          { assignmentType: "category", assignmentTargetId: id },
          { $set: { assignmentType: "none", assignmentTargetId: null } }
        );
        await SizeChart.findByIdAndUpdate(data.sizeChart, {
          $set: { assignmentType: "category", assignmentTargetId: id }
        });
      }
    }

    // Handle Media Usage Tracking
    if (data.image !== undefined && oldCategory.image !== data.image) {
      const { trackMediaUsage, removeMediaUsage, findMediaByUrl } = await import("@/lib/mediaUsage");
      
      // Remove old usage
      if (oldCategory.image) {
        const oldMedia = await findMediaByUrl(oldCategory.image);
        if (oldMedia) await removeMediaUsage(oldMedia._id, 'Category', id);
      }

      // Add new usage
      if (data.image) {
        const newMedia = await findMediaByUrl(data.image);
        if (newMedia) {
          await trackMediaUsage(newMedia._id, {
            entityType: 'Category',
            entityId: id,
            fieldName: 'image',
            label: category.name
          });
        }
      }
    }
    
    if (data.banner !== undefined && oldCategory.banner !== data.banner) {
      const { trackMediaUsage, removeMediaUsage, findMediaByUrl } = await import("@/lib/mediaUsage");
      
      if (oldCategory.banner) {
        const oldMedia = await findMediaByUrl(oldCategory.banner);
        if (oldMedia) await removeMediaUsage(oldMedia._id, 'Category', id);
      }

      if (data.banner) {
        const newMedia = await findMediaByUrl(data.banner);
        if (newMedia) {
          await trackMediaUsage(newMedia._id, {
            entityType: 'Category',
            entityId: id,
            fieldName: 'banner',
            label: category.name
          });
        }
      }
    }

    // Handle Linked Items update
    if (data.linkedItems && Array.isArray(data.linkedItems)) {
       const objectIds = data.linkedItems.map(lid => new mongoose.Types.ObjectId(lid));
       const catId = new mongoose.Types.ObjectId(id);

       if (category.type === 'product') {
          const Product = (await import("@/models/Product")).default;
          // Remove from all first
          await Product.updateMany(
             { categories: catId },
             { $pull: { categories: catId } }
          );
          // Add to newly linked
          if (objectIds.length > 0) {
             await Product.updateMany(
                { _id: { $in: objectIds } },
                { $addToSet: { categories: catId } }
             );
          }
       } else if (category.type === 'blog') {
          const Blog = (await import("@/models/Blog")).default;
          // Remove from all first (that have this category name)
          await Blog.updateMany(
             { category: oldCategory.name },
             { $set: { category: "" } }
          );
          // Add to newly linked
          if (objectIds.length > 0) {
             await Blog.updateMany(
                { _id: { $in: objectIds } },
                { $set: { category: category.name } }
             );
          }
       }
    }

    return NextResponse.json(category);
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
  // mode=trash     -> soft delete only (idempotent, never hard-deletes)
  // mode=permanent -> hard delete, only allowed for a category already in the trash
  // (no mode)      -> legacy toggle used by the Trash page: trash, or hard-delete if already trashed
  const mode = searchParams.get("mode");

  await dbConnect();
  try {
    const category = await Category.findById(id);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (mode === "trash" && category.isDeleted) {
      return NextResponse.json({ message: "Category already in trash", category });
    }
    if (mode === "permanent" && !category.isDeleted) {
      return NextResponse.json({ error: "Move the category to trash before deleting it permanently." }, { status: 409 });
    }

    if (category.isDeleted) {
      // Clean up media usage references
      try {
        if (category.image) {
          const { removeMediaUsage, findMediaByUrl } = await import("@/lib/mediaUsage");
          const media = await findMediaByUrl(category.image);
          if (media) {
            await removeMediaUsage(media._id, 'Category', id);
          }
        }
      } catch (mediaErr) {
        console.error("Failed to clean up category media references:", mediaErr);
      }

      // Pull Category ID from all products' categories array
      const Product = (await import("@/models/Product")).default;
      await Product.updateMany(
        { categories: id },
        { $pull: { categories: id } }
      );

      // Permanently delete Category document
      await Category.findByIdAndDelete(id);
      return NextResponse.json({ message: "Category permanently deleted" });
    } else {
      category.isDeleted = true;
      category.deletedAt = new Date();
      await category.save();
      return NextResponse.json({ message: "Category moved to trash", category });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
