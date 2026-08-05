import mongoose from 'mongoose';

// ─── Condition Sub-Schema ──────────────────────────────────────────────────────
// A single eligibility rule evaluated against the cart context
const ShippingConditionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['subtotal', 'quantity', 'weight', 'distance', 'customer_group', 'country', 'state', 'city'],
    required: true
  },
  operator: {
    type: String,
    enum: ['>', '<', '>=', '<=', '==', '!='],
    required: true
  },
  // Compared value — numeric for subtotal/quantity/weight, string for geographic conditions
  value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { _id: false });

// ─── Shipping Method Schema ────────────────────────────────────────────────────
const ShippingMethodSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, default: 'DEFAULT_STORE', index: true },
  zoneId:   { type: mongoose.Schema.Types.ObjectId, ref: 'ShippingZone', required: true, index: true },

  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },

  // Provider key — resolved via ProviderRegistry at runtime
  provider: {
    type: String,
    enum: ['FREE_SHIPPING', 'FLAT_RATE', 'LOCAL_PICKUP'],
    required: true,
    index: true
  },

  // Dynamic provider settings — shape varies per provider:
  //   FLAT_RATE:     { cost: Number, currency: String }
  //   FREE_SHIPPING: { minimumOrderAmount: Number, fallbackCost: Number }
  //   LOCAL_PICKUP:  { cost: Number, pickupLocationId: ObjectId }
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Eligibility conditions evaluated against cart before presenting this method
  conditions: [ShippingConditionSchema],

  status:    { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
  sortOrder: { type: Number, default: 0, index: true },

  // Scheduled activation window — null means no restriction
  activeFrom:  { type: Date, default: null },
  activeUntil: { type: Date, default: null }

}, { timestamps: true });

// Compound index: load active methods for a zone in display order
ShippingMethodSchema.index({ zoneId: 1, status: 1, sortOrder: 1 });
ShippingMethodSchema.index({ tenantId: 1, provider: 1 });

delete mongoose.models.ShippingMethod;
export default mongoose.model('ShippingMethod', ShippingMethodSchema);
