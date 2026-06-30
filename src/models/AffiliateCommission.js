import mongoose from 'mongoose';

const AffiliateCommissionSchema = new mongoose.Schema({
  affiliateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Affiliate', required: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  orderNumber: { type: String, required: true, index: true },
  subtotal: { type: Number, required: true }, // Order subtotal at purchase
  commissionAmount: { type: Number, required: true }, // Calculated payout amount
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Cancelled', 'Reversed'], 
    default: 'Pending', 
    index: true 
  },
  payoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'AffiliatePayout', index: true },
  tenantId: { type: String, default: 'default', index: true }, // SaaS multi-tenancy
  
  // Snapshot rules to guarantee historical data integrity
  snapshot: {
    commissionRate: { type: Number, required: true },
    productPrices: [{
      productId: mongoose.Schema.Types.ObjectId,
      name: String,
      price: Number,
      quantity: Number
    }],
    discountTotal: Number,
    shippingCost: Number,
    tax: Number,
    globalSettingsSnapshot: mongoose.Schema.Types.Mixed
  }
}, { timestamps: true });

// Optimize query performance for dashboard aggregations
AffiliateCommissionSchema.index({ affiliateId: 1, status: 1 });

delete mongoose.models.AffiliateCommission;
export default mongoose.models.AffiliateCommission || mongoose.model('AffiliateCommission', AffiliateCommissionSchema);
