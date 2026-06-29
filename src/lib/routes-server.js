import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import Blog from "@/models/Blog";
import Category from "@/models/Category";
import Product from "@/models/Product";
import { RESERVED_ROUTES } from "./routes";

export async function validateSlug(slug, excludeId = null) {
  if (!slug) {
    return { valid: false, error: "Slug cannot be empty." };
  }
  
  const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-_]+/g, '-');
  
  // 1. Validate against Reserved Route Registry
  if (RESERVED_ROUTES.includes(cleanSlug)) {
    return { valid: false, error: `"${slug}" is a reserved system route.` };
  }
  
  await dbConnect();
  
  // 2. Validate against CMS Page slugs
  const pageQuery = { slug: cleanSlug };
  if (excludeId) pageQuery._id = { $ne: excludeId };
  const pageExists = await Page.findOne(pageQuery).lean();
  if (pageExists) {
    return { valid: false, error: `Slug "${slug}" collides with an existing CMS page.` };
  }
  
  // 3. Validate against Blog slugs/routes
  const blogQuery = { slug: cleanSlug };
  if (excludeId) blogQuery._id = { $ne: excludeId };
  const blogExists = await Blog.findOne(blogQuery).lean();
  if (blogExists) {
    return { valid: false, error: `Slug "${slug}" collides with an existing blog post.` };
  }
  
  // 4. Validate against Category slugs
  const catQuery = { slug: cleanSlug };
  if (excludeId) catQuery._id = { $ne: excludeId };
  const catExists = await Category.findOne(catQuery).lean();
  if (catExists) {
    return { valid: false, error: `Slug "${slug}" is already in use by another category.` };
  }

  // 5. Validate against Product slugs
  const prodQuery = { slug: cleanSlug };
  if (excludeId) prodQuery._id = { $ne: excludeId };
  const productExists = await Product.findOne(prodQuery).lean();
  if (productExists) {
    return { valid: false, error: `Slug "${slug}" is already in use by a product.` };
  }
  
  return { valid: true };
}
