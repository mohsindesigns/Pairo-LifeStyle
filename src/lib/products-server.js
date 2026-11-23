import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { getAltTextMap } from "@/lib/mediaUsage";

// Product listings only need a category's identity/filter fields, not its page content (HTML, FAQs, SEO).
function slimCat(c) {
  return {
    _id: c._id ? c._id.toString() : '',
    name: c.name,
    slug: c.slug,
    type: c.type,
    status: c.status,
    isDeleted: c.isDeleted,
    showInFilters: c.showInFilters,
  };
}

export async function getProductsForShop() {
  await dbConnect();
  
  const products = await Product.find({
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
          return slimCat(c);
        }
        return c;
      }).filter(Boolean) || [],
      primaryCategory: p.primaryCategory && typeof p.primaryCategory === 'object' ? slimCat(p.primaryCategory) : null
    };

    // Clean up variant combination object ids
    if (serialized.variantCombinations && Array.isArray(serialized.variantCombinations)) {
      serialized.variantCombinations = serialized.variantCombinations.map(vc => ({
        ...vc,
        _id: vc._id ? vc._id.toString() : undefined
      }));
    }

    // Only this product's own image alts. Attaching the full catalog-wide map to every product
    // made /shop and every /collections page grow quadratically (multi-MB, 30-60s loads).
    const imageAlts = {};
    for (const url of [...(p.images || []), p.image]) {
      if (url && altMap[url]) imageAlts[url] = altMap[url];
    }
    serialized.imageAlts = imageAlts;
    return serialized;
  });
}
