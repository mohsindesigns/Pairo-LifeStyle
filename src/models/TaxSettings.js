import mongoose from 'mongoose';

// ─── Tax Rate Row Sub-Schema ───────────────────────────────────────────────────
// One row of a tax class's rate table — mirrors WooCommerce's tax rate table
// columns (Country / State / Postcode / City / Rate / Name / Priority / Compound
// / Shipping). Location fields are blank = "matches anything" for that field,
// so a single row can be a global catch-all (all fields blank) or as specific
// as one postcode in one state of one country.
const TaxRateRowSchema = new mongoose.Schema({
  country:  { type: String, default: '', uppercase: true, trim: true },  // ISO-2 code, e.g. "US" — blank = any
  state:    { type: String, default: '', uppercase: true, trim: true },  // state/province code — blank = any
  postcode: { type: String, default: '', trim: true },                   // exact, "12*" wildcard, or "12000...12999" range — blank = any
  city:     { type: String, default: '', trim: true },                   // blank = any
  rate:     { type: Number, required: true, min: 0, max: 100 },          // percentage
  name:     { type: String, default: 'Tax', trim: true },                // shown on invoices, e.g. "GST", "VAT"
  priority: { type: Number, default: 1 },                                // rows sharing a priority level combine; separate priorities apply sequentially
  compound: { type: Boolean, default: false },                           // if true, calculated on top of the subtotal + already-applied taxes
  shipping: { type: Boolean, default: true },                            // whether this rate also applies to the shipping cost
}, { _id: true });

// ─── Tax Class Sub-Schema ──────────────────────────────────────────────────────
// A named group of rate rows, e.g. "Standard", "Reduced Rate", "Zero Rate", or
// a custom class an admin creates for a special product category.
const TaxClassSchema = new mongoose.Schema({
  key:       { type: String, required: true, trim: true },   // slug, e.g. "standard", "reduced-rate"
  name:      { type: String, required: true, trim: true },   // display name
  isDefault: { type: Boolean, default: false },               // the class products use when none is explicitly assigned; exactly one class should carry this
  rates:     [TaxRateRowSchema],
}, { _id: false });

// ─── Tax Settings Schema ───────────────────────────────────────────────────────
// One document per tenant (upserted by tenantId).
const TaxSettingsSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, default: 'DEFAULT_STORE', unique: true, index: true },

  // Master switch — if false, no tax is applied anywhere.
  enabled: { type: Boolean, default: false },

  // exclusive: tax added on top of price | inclusive: tax included in the price already
  calculationMethod: {
    type: String,
    enum: ['exclusive', 'inclusive'],
    default: 'exclusive'
  },

  // How fractional tax amounts are handled.
  taxRoundingMode: {
    type: String,
    enum: ['round', 'floor', 'ceil'],
    default: 'round'
  },

  // Optional suffix appended to displayed prices, e.g. "incl. tax" — cosmetic only.
  priceDisplaySuffix: { type: String, default: '' },

  // Tax classes, each with its own rate table. Standard/Reduced Rate/Zero Rate
  // are seeded by default (see route.js); admins can add custom classes too.
  taxClasses: [TaxClassSchema],

}, { timestamps: true });

delete mongoose.models.TaxSettings;
export default mongoose.model('TaxSettings', TaxSettingsSchema);
