import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  // Core Info
  name: { type: String, required: true },
  slug: { type: String, index: true },
  shortDescription: { type: String },
  description: { type: String }, // Long Description (Rich Text)
  status: { type: String, enum: ['Draft', 'Published'], default: 'Draft' },
  isFeatured: { type: Boolean, default: false },
  category: { type: String }, // Main category string (Legacy)
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }], // Multi-category support
  collections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Collection' }],
  
  // Pricing & Inventory
  price: { type: Number, required: true }, // Regular Price
  compareAtPrice: { type: Number }, // Sale Price
  sku: { type: String },
  stock: { type: Number, default: 0 },
  manageStock: { type: Boolean, default: true },
  lowStockThreshold: { type: Number, default: 2 },
  availabilityStatus: { type: String, enum: ['In Stock', 'Out of Stock', 'On Backorder'], default: 'In Stock' },

  // Media
  images: [{ type: String }], // Array of image URLs/paths
  image: { type: String }, // Legacy Main Image
  
  // Advanced Variant Engine (Product Independent)
  attributes: [{
    name: String, // e.g. "Color", "Material", "Size"
    type: { type: String, enum: ['color', 'size', 'custom'], default: 'custom' },
    values: [{
      label: String, // Display label
      hex: String, // For color swatches
      image: String, // Optional swatch image (pattern/texture)
      value: String, // Actual value (e.g. "S", "M")
      variantImage: String // Image override for this specific selection
    }]
  }],
  variantCombinations: [{
    title: String, // e.g. "Black / M"
    sku: String,
    price: Number,
    stock: Number,
    image: String
  }],

  // Dynamic Sections
  overview: String, // Replacing static Product Overview
  shippingType: { type: String, default: "Express" },
  stats: [{
    label: String,
    value: String,
    icon: String // Lucide icon name
  }],
  narrative: {
    title: { type: String, default: "Craftsmanship Narrative" },
    content: String
  },
  specifications: [{
    label: String,
    value: String
  }],
  faqs: [{
    question: String,
    answer: String
  }],

  // SEO
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

  // Relations
  tags: [String],
  relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  upsellProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

  // Meta
  productType: { type: String, enum: ['simple', 'variable'], default: 'simple' },
  isDeleted: { type: Boolean, default: false },
  rating: { type: Number, default: 0 },
  type: { type: String }, // Legacy type (newArrival, etc)
  id: { type: Number } // Legacy numeric ID
}, { timestamps: true });

// Ensure unique slugs per tenant
ProductSchema.index({ tenantId: 1, slug: 1 }, { unique: true, sparse: true });

delete mongoose.models.Product;
export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
