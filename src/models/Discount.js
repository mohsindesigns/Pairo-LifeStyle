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
  specificCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }]
}, { timestamps: true });

export default mongoose.models.Discount || mongoose.model('Discount', DiscountSchema);
