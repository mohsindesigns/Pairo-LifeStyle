import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Affiliate from "@/models/Affiliate";
import Product from "@/models/Product";
import { NextResponse } from "next/server";

export async function GET(req) {
  await dbConnect();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isAffiliate) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const affiliate = await Affiliate.findById(session.user.id).select("referralCode status").lean();
    if (!affiliate) {
      return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
    }

    if (affiliate.status !== 'Active') {
      return NextResponse.json({ error: "Unauthorized: Account suspended or inactive" }, { status: 403 });
    }

    // Get active products
    const products = await Product.find({
      status: "Published",
      isDeleted: { $ne: true }
    })
      .select("name slug price images description")
      .sort({ createdAt: -1 })
      .lean();

    const host = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host") || "pairolifestyle.com"}`;
    const code = affiliate.referralCode;

    // Map referral link to each product
    const mappedProducts = products.map(prod => ({
      _id: prod._id,
      name: prod.name,
      slug: prod.slug,
      price: prod.price,
      image: prod.images?.[0] || prod.image || "/placeholder.jpg",
      description: prod.description || "",
      referralUrl: `${host}/product/${prod.slug}?ref=${code}`
    }));

    return NextResponse.json({ success: true, products: mappedProducts });

  } catch (error) {
    console.error("[AffiliateProducts API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
