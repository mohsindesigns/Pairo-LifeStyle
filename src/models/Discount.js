import mongoose from 'mongoose';

const DiscountSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  value: { type: Number, required: true },
  minPurchase: { type: Number, default: 0 },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  usageLimit: { type: Number }, // Total times this code can be used
  usageCount: { type: Number, default: 0 },
  usagePerUserLimit: { type: Number, default: 1 }, // Max times one user can use this
  isActive: { type: Boolean, default: true, index: true },
  isDeleted: { type: Boolean, default: false, index: true },
  
  // Advanced coupon conditions
  firstOrderOnly: { type: Boolean, default: false },
  userRegistrationRequired: { type: Boolean, default: false },
  newsletterSubscribedOnly: { type: Boolean, default: false },
  specificProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  specificCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],

  // Caps the discount amount a percentage coupon can take off (e.g. "20% off, up to $50")
  maxDiscountAmount: { type: Number, default: null },
  // Minimum number of items (total quantity) required in the cart
  minQuantity: { type: Number, default: 0 },
  // Only discounts items that are NOT already marked down (price < compareAtPrice)
  excludeSaleItems: { type: Boolean, default: false },
  // Restricts the coupon to a hand-picked list of customers
  specificCustomers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],
  // Anti-abuse: caps redemption to one per device/IP, tracked via hashed IP fingerprints
  oneRedemptionPerDevice: { type: Boolean, default: false },
  redeemedFingerprints: [{ type: String }],

  // Stripe sync — mirrors Promotion's stripe fields. Only coupons Stripe can
  // fully enforce on its own (simple percent/fixed off, optional minimum
  // spend, optional first-purchase-only) are pushed to Stripe; codes scoped
  // to specific products/categories/customers, registered/newsletter
  // customers, a capped max discount, a minimum quantity, sale-item
  // exclusion, per-device limiting, or a per-user limit above 1 have no
  // Stripe equivalent and are left local-only.
  stripeCouponId: { type: String, default: null },
  stripePromotionCodeId: { type: String, default: null },
  stripeSyncStatus: { type: String, enum: ['synced', 'unsupported', 'error', 'pending'], default: 'pending' },
  stripeSyncError: { type: String, default: null },
  stripeSyncKey: { type: String, default: null }
}, { timestamps: true });

export default mongoose.models.Discount || mongoose.model('Discount', DiscountSchema);
