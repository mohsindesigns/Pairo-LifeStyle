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
  heritage: { type: String, default: "" },
  process: { type: String, default: "" },
  style: { type: String, default: "" },
  featuredProductId: { type: String, default: "" },
  featuredProductData: {
    name: String,
    image: String,
    price: String
  },
  showFeaturedProduct: { type: Boolean, default: true },
  showSidebarIndex: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  // Status the post had when it was moved to Trash, so Restore can put it back
  statusBeforeTrash: { type: String, default: null },
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
  },
  publishedAt: { type: Date, default: Date.now },
  faqs: [{
    question: String,
    answer: String
  }]
}, { timestamps: true });

delete mongoose.models.Blog;
export default mongoose.models.Blog || mongoose.model('Blog', BlogSchema);
