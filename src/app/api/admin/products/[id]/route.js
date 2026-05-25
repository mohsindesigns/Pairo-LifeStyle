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

  await dbConnect();
  try {
    const product = await Product.findById(params.id)
      .populate('categories')
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

  await dbConnect();
  try {
    const data = await req.json();
    
    const oldProduct = await Product.findById(params.id);
    if (!oldProduct) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Auto-generate slug if it's being updated or missing
    if (data.name && (!data.slug || data.slug === "")) {
      data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }

    // Register redirect if slug changed
    if (data.slug && oldProduct.slug && oldProduct.slug !== data.slug) {
      await registerRedirect(`/product/${oldProduct.slug}`, `/product/${data.slug}`);
    }

    const product = await Product.findByIdAndUpdate(params.id, { $set: data }, { new: true, runValidators: true });
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

  await dbConnect();
  try {
    const product = await Product.findByIdAndUpdate(params.id, { 
      isDeleted: true,
      status: 'Draft' 
    }, { new: true });
    
    return NextResponse.json({ message: "Product moved to trash", product });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
