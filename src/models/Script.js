import mongoose from 'mongoose';

const ScriptSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  
  // type: 'custom', 'template_ga4', 'template_gtm', 'template_pixel', etc.
  type: { 
    type: String, 
    enum: ['custom', 'ga4', 'gtm', 'meta_pixel', 'tiktok_pixel', 'hotjar', 'clarity', 'verification'],
    default: 'custom' 
  },
  
  // The actual code or the ID for templates
  code: { type: String }, 
  templateConfig: {
    trackingId: String, // For GA4, GTM, etc.
    pixelId: String,    // For FB, TikTok
    verificationId: String, // For Search Console
    verificationProvider: String // For Google, Pinterest, Bing, Facebook
  },

  // Injection Location
  location: { 
    type: String, 
    enum: ['head', 'body_top', 'body_bottom'], 
    default: 'head' 
  },

  // Route Targeting
  targeting: {
    type: { type: String, enum: ['all', 'specific', 'exclude'], default: 'all' },
    routes: [String] // e.g., ['/checkout', '/products/*']
  },

  // Load Strategy
  loadStrategy: { 
    type: String, 
    enum: ['async', 'defer', 'beforeInteractive', 'afterInteractive', 'lazyOnload'], 
    default: 'afterInteractive' 
  },

  // Status
  isActive: { type: Boolean, default: true },
  priority: { type: Number, default: 10 }, // Lower = higher priority

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  
  version: { type: Number, default: 1 },
  auditLog: [{
    action: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    at: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Ensure indexes
ScriptSchema.index({ slug: 1 });
ScriptSchema.index({ isActive: 1 });
ScriptSchema.index({ location: 1 });

export default mongoose.models.Script || mongoose.model('Script', ScriptSchema);
