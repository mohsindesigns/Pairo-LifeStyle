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
  redeemedFingerprints: [{ type: String }]
}, { timestamps: true });

export default mongoose.models.Discount || mongoose.model('Discount', DiscountSchema);
