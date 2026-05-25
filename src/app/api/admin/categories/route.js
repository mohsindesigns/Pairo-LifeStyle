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

  await dbConnect();
  try {
    const query = { isDeleted: false };
    if (type === "product") {
       query.$or = [{ type: "product" }, { type: { $exists: false } }];
    } else {
       query.type = type;
    }
    const categories = await Category.find(query).sort({ name: 1 });
    return NextResponse.json(categories);
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

    // Register redirect if slug changed
    if (data.slug && oldCategory.slug && oldCategory.slug !== data.slug) {
      const { registerRedirect } = await import("@/lib/redirect-resolver");
      await registerRedirect(`/shop?category=${oldCategory.slug}`, `/shop?category=${data.slug}`);
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
    const category = await Category.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    
    // Usage tracking is usually kept for soft deletes, but we could remove it if desired.
    // Keeping it for now so "Trash" items still show as "In Use".

    return NextResponse.json(category);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
