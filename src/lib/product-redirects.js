import mongoose from "mongoose";
import Category from "@/models/Category";
import Product from "@/models/Product";
import { registerRedirect } from "@/lib/redirect-resolver";
import { getProductPrimaryCategorySlug } from "@/lib/routes";

const categorySlugFor = (product) => {
  const raw = getProductPrimaryCategorySlug(product);
  return raw === "uncategorized" ? "shop" : raw;
};

const idOf = (v) => (v && typeof v === "object" && v._id ? v._id : v);

// Category ids (or populated docs) → category docs, so the URL's category segment can be worked out.
async function populateCategories(ids) {
  const list = (Array.isArray(ids) ? ids : [ids]).map(idOf).filter((id) => id && mongoose.isValidObjectId(id));
  if (!list.length) return [];
  return Category.find({ _id: { $in: list } }).select("slug status isDeleted").lean();
}

/**
 * When a product's slug or primary category changes, every old URL of the product should 301
 * to its new canonical URL, so existing links and search results keep working.
 * Call BEFORE saving (it reads the stored product) and pass the result to
 * applyProductRedirects AFTER the save succeeds, so a failed save leaves no redirects behind.
 * Returns a list of [oldPath, newPath] pairs (empty when nothing URL-related changed).
 */
export async function planProductRedirects(productId, updates) {
  if (!updates || !("slug" in updates || "categories" in updates || "primaryCategory" in updates)) return [];
  const before = await Product.findById(productId).populate("categories").populate("primaryCategory").lean();
  if (!before?.slug) return [];

  const after = { ...before, slug: updates.slug ?? before.slug };
  if ("categories" in updates) after.categories = await populateCategories(updates.categories);
  if ("primaryCategory" in updates) {
    const [primary] = await populateCategories(updates.primaryCategory);
    after.primaryCategory = primary || null;
  }

  const oldCatSlug = categorySlugFor(before);
  const slugChanged = before.slug !== after.slug;
  const categoryChanged = oldCatSlug !== categorySlugFor(after);
  if (!slugChanged && !categoryChanged) return [];

  const newPath = `/product/${after.slug}`;
  return [
    `/${oldCatSlug}/${before.slug}`,
    `/product/${before.slug}`,
    `/product-category/${oldCatSlug}/${before.slug}`,
    `/collections/${oldCatSlug}/${before.slug}`,
  ].map((oldPath) => [oldPath, newPath]);
}

export async function applyProductRedirects(pairs) {
  for (const [oldPath, newPath] of pairs || []) {
    await registerRedirect(oldPath, newPath);
  }
}
