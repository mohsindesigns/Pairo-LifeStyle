import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Category from "@/models/Category";
import { can } from "@/lib/rbac";
import { NextResponse } from "next/server";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "products.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "product";
  const trash = searchParams.get("trash") === "true";

  await dbConnect();
  try {
    const query = { isDeleted: trash };
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
    console.log("=== CATEGORY POST REQUEST ===");
    console.log("Received data:", data);
    
    const type = data.type || "product";
    console.log("Determined type to save:", type);
    
    // Route Collision Detection
    const { validateSlug } = await import("@/lib/routes-server");
    const collisionCheck = await validateSlug(data.slug);
    if (!collisionCheck.valid) {
      return NextResponse.json({ error: collisionCheck.error }, { status: 400 });
    }
    
    // Check if a category with this slug already exists (even if deleted) in the SAME type
    const existing = await Category.findOne({ slug: data.slug, type });
    
    let category;
    if (existing) {
       console.log("Found existing category. isDeleted:", existing.isDeleted);
       if (existing.isDeleted) {
          // Restore the deleted category
          existing.isDeleted = false;
          existing.name = data.name; 
          existing.type = type;
          existing.image = data.image || existing.image;
          existing.description = data.description || existing.description;
          existing.content = data.content || existing.content;
          existing.status = data.status || existing.status;
          existing.isFeatured = data.isFeatured || existing.isFeatured;
          if (data.seo) existing.seo = { ...existing.seo, ...data.seo };
          category = await existing.save();
          console.log("Restored category:", category._id, "with type:", category.type);
       } else {
          return NextResponse.json({ error: "A category with this slug already exists." }, { status: 400 });
       }
    } else {
       category = await Category.create({ ...data, type });
       console.log("Created NEW category:", category._id, "with type:", category.type);
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
      await registerRedirect(`/shop/${oldCategory.slug}`, `/${data.slug}`);
      await registerRedirect(`/${oldCategory.slug}`, `/${data.slug}`);

      // Register redirects for all products in this category
      const Product = (await import("@/models/Product")).default;
      const products = await Product.find({ categories: id, isDeleted: { $ne: true } }).lean();
      for (const prod of products) {
        if (prod.slug) {
          await registerRedirect(`/${oldCategory.slug}/${prod.slug}`, `/${data.slug}/${prod.slug}`);
          await registerRedirect(`/product/${prod.slug}`, `/${data.slug}/${prod.slug}`);
        }
      }
    }

    const category = await Category.findByIdAndUpdate(id, data, { new: true });

    // Handle Media Usage Tracking
    if (oldCategory.image !== data.image) {
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

  await dbConnect();
  try {
    const category = await Category.findById(id);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
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
      await category.save();
      return NextResponse.json({ message: "Category moved to trash", category });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
