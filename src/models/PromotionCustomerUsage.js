import mongoose from 'mongoose';

// Backs the atomic per-customer usage cap in checkoutPricing.js. Order documents
// are the source of truth for usage history, but counting them can't be done
// atomically at commit time, so this collection holds a reservation counter
// per (tenantId, promotion, customer) that IS safe to increment atomically.
const PromotionCustomerUsageSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, default: 'DEFAULT_STORE', index: true },
  promotionId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Promotion' },
  customerKey: { type: String, required: true },
  usageCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

PromotionCustomerUsageSchema.index(
  { tenantId: 1, promotionId: 1, customerKey: 1 },
  { unique: true }
);

export default mongoose.models.PromotionCustomerUsage || mongoose.model('PromotionCustomerUsage', PromotionCustomerUsageSchema);
