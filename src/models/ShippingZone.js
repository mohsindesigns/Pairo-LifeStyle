import mongoose from 'mongoose';

// ─── Match Rule Sub-Schema ─────────────────────────────────────────────────────
// Defines a single geographic coverage rule for a zone (e.g. country = "Pakistan")
const MatchRuleSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['country', 'state', 'province', 'city', 'postal_code', 'postal_code_range', 'region', 'custom'],
    required: true
  },
  // Array of matched strings — e.g. ["Pakistan", "PK"] or ["Lahore", "Karachi"]
  values: [{ type: String, trim: true }]
}, { _id: false });

// ─── Shipping Zone Schema ──────────────────────────────────────────────────────
const ShippingZoneSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, default: 'DEFAULT_STORE', index: true },

  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },

  // Admin-controlled display order (drag-and-drop in UI)
  sortOrder: { type: Number, default: 0, index: true },

  // Matching priority — higher value = evaluated first when specificity score is tied
  priority: { type: Number, default: 0, index: true },

  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },

  // Geographic coverage rules — all rules must match (AND logic)
  matchRules: [MatchRuleSchema]

}, { timestamps: true });

// Compound index: active zone query sorted by priority (highest first)
ShippingZoneSchema.index({ tenantId: 1, status: 1, priority: -1 });
// Index for UI listing sorted by display order
ShippingZoneSchema.index({ tenantId: 1, sortOrder: 1 });

delete mongoose.models.ShippingZone;
export default mongoose.model('ShippingZone', ShippingZoneSchema);
