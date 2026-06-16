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

    const { getAltTextMap } = await import("@/lib/mediaUsage");

    if (id) {
      const product = await Product.findOne({ ...baseQuery, id: parseInt(id) }).lean();
      if (product) {
        const altMap = await getAltTextMap([...(product.images || []), product.image]);
        product.imageAlts = altMap;
      }
      return Response.json(product);
    }

    let query = { ...baseQuery };
    if (category && category !== 'all') query.category = { $regex: new RegExp(category, 'i') };
    if (type) query.type = type;

    const products = await Product.find(query)
      .select('name slug price compareAtPrice images categories rating reviewsCount isFeatured type status attributes variantCombinations')
      .sort({ createdAt: -1 })
      .lean();
    
    // Fetch and assign alt text maps
    const allUrls = [];
    products.forEach(p => {
      if (p.images) allUrls.push(...p.images);
      if (p.image) allUrls.push(p.image);
    });
    const altMap = await getAltTextMap(allUrls);
    const enrichedProducts = products.map(p => ({
      ...p,
      imageAlts: altMap
    }));

    // Group them like data.json for compatibility but include ALL for the shop
    if (!category && !type && !id) {
      const newArrivals = enrichedProducts.filter(p => p.type === 'newArrival');
      const topSelling = enrichedProducts.filter(p => p.type === 'topSelling');
      return Response.json({ newArrivals, topSelling, all: enrichedProducts });
    }

    return Response.json(enrichedProducts);
  } catch (error) {
    console.error("GET Products Error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
