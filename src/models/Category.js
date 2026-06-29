import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true },
  image: { type: String },
  banner: { type: String },
  description: { type: String }, // Short description
  content: { type: String }, // Full description
  status: { type: String, enum: ['Draft', 'Published'], default: 'Published' },
  isFeatured: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  seo: {
    title: String,
    description: String,
    keywords: [String],
    focusKeyword: String,
    canonicalUrl: String,
    ogTitle: String,
    ogDescription: String,
    ogImage: String,
    noIndex: { type: Boolean, default: false },
    noFollow: { type: Boolean, default: false },
    twitterTitle: String,
    twitterDescription: String,
    twitterImage: String,
    structuredData: String // JSON-LD
  },
  type: { type: String, enum: ['product', 'blog'], default: 'product' },
  productCount: { type: Number, default: 0 }
}, { timestamps: true });

// Compound index to allow same slug for DIFFERENT types, but unique for SAME type
CategorySchema.index({ slug: 1, type: 1 }, { unique: true });

delete mongoose.models.Category;
export default mongoose.models.Category || mongoose.model('Category', CategorySchema);
