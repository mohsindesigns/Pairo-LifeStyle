import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  orderNumber: { type: String, required: true, index: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Refunded'],
    default: 'Pending',
    index: true
  },
  
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    slug: String,
    sku: String,
    image: String,
    priceAtPurchase: Number,
    quantity: Number,
    selectedVariant: {
      title: String,
      options: mongoose.Schema.Types.Mixed // e.g., { Size: 'M', Color: 'Black' }
    }
  }],

  financials: {
    subtotal: Number,
    shippingCost: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    total: Number,
    currency: { type: String, default: 'USD' },
    promoCode: String, // Keep for legacy/simple reference
    appliedPromotions: [{
      promotionId: mongoose.Schema.Types.Mixed, // Use Mixed to avoid casting issues between different model versions
      code: String,
      title: String,
      type: { type: String },
      value: mongoose.Schema.Types.Mixed,
      discountAmount: Number,
      explanation: String,
      rulesSnapshot: mongoose.Schema.Types.Mixed
    }]
  },
  
  payment: {
    method: { type: String, default: 'Cash on Delivery' },
    status: { type: String, default: 'Pending' },
    transactionId: String
  },

  customer: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
    email: { type: String, index: true },
    isGuest: { type: Boolean, default: false },
    ipAddress: String
  },

  shippingAddress: {
    fullName: String,
    street: String,
    city: String,
    zip: String,
    country: String,
    phone: String
  },

  idempotencyKey: { type: String, unique: true, sparse: true, index: true },
  customerNote: String,
  adminNotes: [String],
  
  timeline: [{
    status: String,
    message: String,
    timestamp: { type: Date, default: Date.now },
    source: { type: String, enum: ['System', 'Admin', 'Customer'], default: 'System' }
  }]
}, { timestamps: true });

// SaaS Unique Constraints
OrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
OrderSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

// Performance Indexes
OrderSchema.index({ createdAt: -1 });

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);
