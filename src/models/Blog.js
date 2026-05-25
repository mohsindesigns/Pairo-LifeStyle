import mongoose from 'mongoose';

const BlogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  excerpt: String,
  content: String,
  image: String,
  category: String,
  author: { type: String, default: "Pairo Studio" },
  status: { type: String, enum: ['Draft', 'Published'], default: 'Draft' },
  isFeatured: { type: Boolean, default: false },
  tags: [String],
  tenantId: { type: String, required: true, default: "DEFAULT_STORE" },
  heritage: { type: String, default: "" },
  process: { type: String, default: "" },
  style: { type: String, default: "" },
  featuredProductId: { type: String, default: "" },
  featuredProductData: {
    name: String,
    image: String,
    price: String
  },
  isDeleted: { type: Boolean, default: false },
  seo: {
    title: String,
    description: String,
    keywords: [String],
    focusKeyword: String,
    canonicalUrl: String,
    noIndex: { type: Boolean, default: false },
    noFollow: { type: Boolean, default: false },
    ogTitle: String,
    ogDescription: String,
    ogImage: String,
    twitterTitle: String,
    twitterDescription: String,
    twitterImage: String,
    structuredData: String // JSON-LD
  }
}, { timestamps: true });

delete mongoose.models.Blog;
export default mongoose.models.Blog || mongoose.model('Blog', BlogSchema);
