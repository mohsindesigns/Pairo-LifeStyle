import mongoose from 'mongoose';

const PromotionSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, default: 'DEFAULT_STORE', index: true }, // Mandatory SaaS Isolation
  title: { type: String, required: true },
  description: String,
  code: { type: String, sparse: true, index: true },
  isAutomatic: { type: Boolean, default: false },
  adminStatus: { 
    type: String, 
    enum: ['Active', 'Paused', 'Draft', 'Archived'], 
    default: 'Draft' 
  },
  priority: { type: Number, default: 0 },
  stackable: { type: Boolean, default: false },
  exclusive: { type: Boolean, default: false },
  
  // Date Ranges
  startDate: Date,
  endDate: Date,

  // Condition AST (Phase 1: Simple object, Phase 2: Recursive)
  conditions: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Action Definitions
  actions: [{
    type: { 
      type: String, 
      enum: ['percentage_discount', 'fixed_discount', 'free_shipping', 'bxgy', 'fixed_product_price', 'quantity_tier', 'bundle'], 
      required: true 
    },
    target: { type: String, enum: ['cart', 'product', 'category', 'collection', 'shipping'], default: 'cart' },
    value: Number,
    targetIds: [String], // Specific products/categories/collections
    bxgyConfig: {
      // Legacy compatibility
      buyX: String,
      getY: String,
      // Advanced BOGO
      buyType: { type: String, enum: ['product', 'category', 'collection', 'all'], default: 'product' },
      buyTargetIds: [String],
      buyQty: { type: Number, default: 1 },
      getType: { type: String, enum: ['product', 'category', 'collection', 'all'], default: 'product' },
      getTargetIds: [String],
      getQty: { type: Number, default: 1 },
      discountType: { type: String, enum: ['percentage', 'fixed', 'free'], default: 'free' },
      discountValue: { type: Number, default: 100 },
      mustBeSameProduct: { type: Boolean, default: false },
      useCheapest: { type: Boolean, default: true }
    },
    quantityTiers: [{
      quantity: Number,
      priceType: { type: String, enum: ['total', 'per_unit', 'percentage', 'fixed_discount'] },
      value: Number
    }],
    bundleConfig: {
      products: [{
        productId: String,
        quantity: { type: Number, default: 1 }
      }],
      priceType: { type: String, enum: ['fixed_price', 'discount_percentage', 'discount_fixed'] },
      value: Number
    }
  }],

  // Usage Limits
  usageLimits: {
    maxTotalUses: { type: Number, default: null },
    currentTotalUses: { type: Number, default: 0 },
    maxUsesPerCustomer: { type: Number, default: 1 }
  },

  // Targeting (Phase 2/3)
  customerSegments: [String],
  
  // Metadata & Analytics
  analytics: {
    timesUsed: { type: Number, default: 0 },
    discountDistributed: { type: Number, default: 0 },
    revenueGenerated: { type: Number, default: 0 }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Composite Index for SaaS Uniqueness (allowing multiple automatic promotions without codes)
PromotionSchema.index(
  { tenantId: 1, code: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { code: { $type: "string" } } 
  }
);

// Dynamic status calculation
PromotionSchema.virtual('status').get(function() {
  const now = new Date();
  if (this.adminStatus !== 'Active') return this.adminStatus;
  if (this.startDate && now < this.startDate) return 'Scheduled';
  if (this.endDate && now > this.endDate) return 'Expired';
  if (this.usageLimits.maxTotalUses && this.usageLimits.currentTotalUses >= this.usageLimits.maxTotalUses) return 'Exhausted';
  return 'Active';
});

export default mongoose.models.Promotion || mongoose.model('Promotion', PromotionSchema);
