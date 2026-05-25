import mongoose from "mongoose";

const SectionSchema = new mongoose.Schema({
  id: { 
    type: String, 
    required: true,
    default: () => Math.random().toString(36).substring(2, 11) 
  },
  type: { 
    type: String, 
    required: true 
  },
  enabled: { 
    type: Boolean, 
    default: true 
  },
  order: { 
    type: Number, 
    default: 0 
  },
  config: { 
    type: mongoose.Schema.Types.Mixed, 
    default: {} 
  },
  overrides: {
    padding: { type: String, default: "py-0" },
    background: { type: String, default: "transparent" },
    customClasses: { type: String, default: "" }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const PageSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  slug: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  description: String,
  status: { 
    type: String, 
    enum: ["Draft", "Published"], 
    default: "Draft" 
  },
  isSystem: { 
    type: Boolean, 
    default: false 
  },
  sections: [SectionSchema],
  seo: {
    title: String,
    description: String,
    keywords: [String],
    focusKeyword: String,
    secondaryKeywords: String,
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
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
  tenantId: { type: String, default: 'DEFAULT_STORE' }
}, { timestamps: true });

// Ensure slugs are indexable
PageSchema.index({ slug: 1, tenantId: 1 }, { unique: true });

delete mongoose.models.Page;
export default mongoose.models.Page || mongoose.model("Page", PageSchema);
