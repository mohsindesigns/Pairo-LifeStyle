import Product from "@/models/Product";
import Category from "@/models/Category";
import Blog from "@/models/Blog";

export async function resolvePageSections(sections) {
  const resolvedSections = await Promise.all(sections.map(async (section) => {
    const config = { ...(section.config || {}) };
    
    try {
      // Resolve Product Grid Data
      if (section.type === 'product_grid') {
        const query = { status: 'Published', tenantId: 'DEFAULT_STORE' };
        if (config.collectionId) {
          query.categories = config.collectionId;
        }
        
        const products = await Product.find(query)
          .sort({ createdAt: -1 })
          .limit(config.limit || 8)
          .lean();
          
        const { getAltTextMap } = await import("@/lib/mediaUsage");
        const allUrls = [];
        products.forEach(p => {
          if (p.images) allUrls.push(...p.images);
          if (p.image) allUrls.push(p.image);
        });
        const altMap = await getAltTextMap(allUrls);
        const enriched = products.map(p => ({ ...p, imageAlts: altMap }));
          
        config.products = JSON.parse(JSON.stringify(enriched));
      }

      // Resolve Banner Feature Data
      if (section.type === 'banner_feature' && config.productId) {
         const mongoose = require('mongoose');
         const query = {};
         if (mongoose.Types.ObjectId.isValid(config.productId)) {
            query._id = config.productId;
         } else {
            query.slug = config.productId;
         }
         const product = await Product.findOne(query).lean();
         if (product) {
            const { getAltTextMap } = await import("@/lib/mediaUsage");
            const altMap = await getAltTextMap([...(product.images || []), product.image]);
            product.imageAlts = altMap;
            config.product = JSON.parse(JSON.stringify(product));
         }
      }

      // Resolve Category Showcase Data
      if (section.type === 'category_showcase') {
        let categories = [];
        if (config.categoryIds?.length > 0) {
          categories = await Category.find({ _id: { $in: config.categoryIds } }).lean();
        } else {
          categories = await Category.find({ status: 'Active' }).limit(3).lean();
        }
        config.categories = JSON.parse(JSON.stringify(categories));
      }

    } catch (err) {
      console.error(`Error resolving data for section ${section.type}:`, err);
    }

    return { ...section.toObject ? section.toObject() : section, config };
  }));

  return resolvedSections;
}
