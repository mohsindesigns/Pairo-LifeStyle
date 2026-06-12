import Product from "@/models/Product";
import Category from "@/models/Category";
import Blog from "@/models/Blog";

export async function resolvePageSections(sections) {
  const resolvedSections = await Promise.all(sections.map(async (section) => {
    const config = { ...(section.config || {}) };
    
    try {
      // Resolve Product Grid Data
      if (section.type === 'product_grid') {
        const query = { isDeleted: false, status: 'Published', tenantId: 'DEFAULT_STORE' };
        if (config.collectionId) {
          const mongoose = require('mongoose');
          let categoryId = config.collectionId;
          if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            // Resolve slug to ObjectId
            const catDoc = await Category.findOne({ slug: categoryId, isDeleted: false });
            if (catDoc) {
              categoryId = catDoc._id;
            } else {
              categoryId = null;
            }
          }
          if (categoryId) {
            query.categories = categoryId;
          } else {
            // Force empty result if category doesn't exist
            query.categories = new mongoose.Types.ObjectId();
          }
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
         const query = { isDeleted: false };
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
          const mongoose = require('mongoose');
          const objectIds = [];
          const slugs = [];
          config.categoryIds.forEach(id => {
            if (mongoose.Types.ObjectId.isValid(id)) {
              objectIds.push(new mongoose.Types.ObjectId(id));
            } else if (id) {
              slugs.push(id);
            }
          });

          categories = await Category.find({
            $or: [
              { _id: { $in: objectIds } },
              { slug: { $in: slugs } }
            ],
            isDeleted: false,
            status: 'Published'
          }).lean();
        }
        // Fallback to active categories if none selected or if all selected are unpublished/deleted
        if (categories.length === 0) {
          categories = await Category.find({ isDeleted: false, status: 'Published' }).limit(3).lean();
        }

        // Enrich categories with imageAlts
        const { getAltTextMap } = await import("@/lib/mediaUsage");
        const categoryUrls = categories.map(c => c.image).filter(Boolean);
        const altMap = await getAltTextMap(categoryUrls);
        const enrichedCategories = categories.map(c => ({
          ...c,
          imageAlts: altMap
        }));

        config.categories = JSON.parse(JSON.stringify(enrichedCategories));
      }

    } catch (err) {
      console.error(`Error resolving data for section ${section.type}:`, err);
    }

    return { ...section.toObject ? section.toObject() : section, config };
  }));

  return resolvedSections;
}
