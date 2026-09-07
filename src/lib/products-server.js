import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { getAltTextMap } from "@/lib/mediaUsage";

export async function getProductsForShop() {
  await dbConnect();
  
  const products = await Product.find({
    tenantId: 'DEFAULT_STORE',
    status: 'Published',
    isDeleted: { $ne: true }
  })
  .select('name slug price compareAtPrice image images categories primaryCategory rating reviewCount isFeatured type productType status attributes variantCombinations')
  .populate('categories')
  .populate('primaryCategory')
  .sort({ createdAt: -1 })
  .lean();

  const allUrls = [];
  products.forEach(p => {
    if (p.images) allUrls.push(...p.images);
    if (p.image) allUrls.push(p.image);
  });
  
  const altMap = await getAltTextMap(allUrls);
  
  // Serialize Mongoose docs to plain JS objects so they cross Server-to-Client boundary
  return products.map(p => {
    const serialized = {
      ...p,
      _id: p._id ? p._id.toString() : '',
      categories: p.categories?.map(c => {
        if (!c) return null;
        if (typeof c === 'object') {
          return {
            ...c,
            _id: c._id ? c._id.toString() : ''
          };
        }
        return c;
      }).filter(Boolean) || [],
      primaryCategory: p.primaryCategory && typeof p.primaryCategory === 'object' ? {
        ...p.primaryCategory,
        _id: p.primaryCategory._id ? p.primaryCategory._id.toString() : ''
      } : null
    };

    // Clean up variant combination object ids
    if (serialized.variantCombinations && Array.isArray(serialized.variantCombinations)) {
      serialized.variantCombinations = serialized.variantCombinations.map(vc => ({
        ...vc,
        _id: vc._id ? vc._id.toString() : undefined
      }));
    }

    serialized.imageAlts = altMap;
    return serialized;
  });
}
