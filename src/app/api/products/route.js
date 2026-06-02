import dbConnect from "@/lib/db";
import Product from "@/models/Product";

export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    // Always filter for Published and not Deleted for public API
    const baseQuery = { 
        tenantId: searchParams.get('tenantId') || 'DEFAULT_STORE',
        status: 'Published', 
        isDeleted: { $ne: true } 
    };

    if (id) {
      const product = await Product.findOne({ ...baseQuery, id: parseInt(id) });
      return Response.json(product);
    }

    let query = { ...baseQuery };
    if (category && category !== 'all') query.category = { $regex: new RegExp(category, 'i') };
    if (type) query.type = type;

    const products = await Product.find(query)
      .select('name slug price compareAtPrice images categories rating reviewsCount isFeatured type status')
      .sort({ createdAt: -1 })
      .lean();
    
    // Group them like data.json for compatibility but include ALL for the shop
    if (!category && !type && !id) {
      const newArrivals = products.filter(p => p.type === 'newArrival');
      const topSelling = products.filter(p => p.type === 'topSelling');
      return Response.json({ newArrivals, topSelling, all: products });
    }

    return Response.json(products);
  } catch (error) {
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
