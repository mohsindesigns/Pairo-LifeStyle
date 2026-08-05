import mongoose from 'mongoose';

// ─── Per-Region Tax Rule Sub-Schema ───────────────────────────────────────────
// Future: override default rate for specific geographic regions
const TaxRuleSchema = new mongoose.Schema({
  name:     { type: String, required: true },        // e.g. "Punjab GST"
  region:   { type: String, required: true },        // e.g. "Punjab", "KHI", "US-CA"
  rateType: { type: String, enum: ['country', 'state', 'city'], default: 'state' },
  rate:     { type: Number, required: true, min: 0, max: 100 }, // percentage
  priority: { type: Number, default: 0 }             // higher priority overrides lower
}, { _id: false });

// ─── Zone-based Tax Rule Sub-Schema ───────────────────────────────────────────
// Links a tax rate directly to a Shipping Zone — takes precedence over region rules
const ZonalTaxRuleSchema = new mongoose.Schema({
  zoneId:   { type: String, required: true },  // ShippingZone._id (stored as string)
  zoneName: { type: String, required: true },  // Denormalized for display
  rate:     { type: Number, required: true, min: 0, max: 100 }, // percentage
  enabled:  { type: Boolean, default: true }
}, { _id: false });

// ─── Tax Settings Schema ───────────────────────────────────────────────────────
// One document per tenant (upserted by tenantId)
const TaxSettingsSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, default: 'DEFAULT_STORE', unique: true, index: true },

  // Master switch — if false, no tax is applied anywhere
  enabled: { type: Boolean, default: false },

  // Tax identification label shown on invoices and checkout
  taxLabel: { type: String, default: 'Tax' }, // e.g. "GST", "VAT", "Sales Tax"

  // Base rate applied when no per-region rule matches
  defaultTaxRate: { type: Number, default: 0, min: 0, max: 100 }, // percentage

  // exclusive: tax added on top of price | inclusive: tax included in price
  calculationMethod: {
    type: String,
    enum: ['exclusive', 'inclusive'],
    default: 'exclusive'
  },

  // How fractional tax amounts are handled
  taxRoundingMode: {
    type: String,
    enum: ['round', 'floor', 'ceil'],
    default: 'round'
  },

  // Whether shipping cost is also taxed
  applyToShipping: { type: Boolean, default: false },

  // Per-region rate overrides — evaluated in priority order
  taxRules: [TaxRuleSchema],

  // Per-zone tax rate overrides — tied to ShippingZone documents
  // Takes highest priority when the customer's address matches a zone
  zonalRules: [ZonalTaxRuleSchema]

}, { timestamps: true });

delete mongoose.models.TaxSettings;
export default mongoose.model('TaxSettings', TaxSettingsSchema);
