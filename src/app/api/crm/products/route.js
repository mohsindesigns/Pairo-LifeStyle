import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { crmCorsHeaders, validateCrmAuth, crmUnauthorized, crmJson, crmError } from "@/lib/crmAuth";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: crmCorsHeaders });
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** GET /api/crm/products?search=&sku=&page=&limit=: the catalogue, so the CRM can pick productId / sku for new orders. */
export async function GET(req) {
  try {
    if (!validateCrmAuth(req)) return crmUnauthorized();
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const query = { isDeleted: { $ne: true } };
    const search = (searchParams.get("search") || "").trim().slice(0, 100);
    const sku = (searchParams.get("sku") || "").trim().slice(0, 100);
    if (search) query.name = { $regex: escapeRegex(search), $options: "i" };
    if (sku) query.$or = [{ sku }, { "variantCombinations.sku": sku }];

    const [products, total] = await Promise.all([
      Product.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Product.countDocuments(query),
    ]);
    return crmJson({
      success: true,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      products: products.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        sku: p.sku || null,
        price: p.price,
        stock: p.stock ?? null,
        manageStock: Boolean(p.manageStock),
        status: p.status,
        slug: p.slug,
        variants: (p.variantCombinations || []).map((v) => ({ title: v.title, sku: v.sku || null, price: v.price ?? null, stock: v.stock ?? null })),
      })),
    });
  } catch (err) {
    console.error("CRM Products GET Error:", err);
    return crmError(500, "Internal server error");
  }
}
