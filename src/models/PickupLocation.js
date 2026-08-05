import mongoose from 'mongoose';

// ─── Operating Hours Sub-Schema ────────────────────────────────────────────────
const OperatingHoursSchema = new mongoose.Schema({
  day:       { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
  openTime:  { type: String, default: '09:00' },  // HH:MM 24h format
  closeTime: { type: String, default: '18:00' },
  closed:    { type: Boolean, default: false }
}, { _id: false });

// ─── Pickup Location Schema ────────────────────────────────────────────────────
const PickupLocationSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, default: 'DEFAULT_STORE', index: true },

  name:         { type: String, required: true, trim: true }, // e.g. "Lahore Flagship Store"
  instructions: { type: String, default: '' },                // shown to customer at checkout

  address: {
    street:  { type: String, default: '' },
    city:    { type: String, default: '' },
    state:   { type: String, default: '' },
    zip:     { type: String, default: '' },
    country: { type: String, default: '' }
  },

  phone: { type: String, default: '' },
  email: { type: String, default: '' },

  // Structured opening hours — used for future display on storefront
  operatingHours: [OperatingHoursSchema],

  status:    { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
  sortOrder: { type: Number, default: 0 }

}, { timestamps: true });

PickupLocationSchema.index({ tenantId: 1, status: 1, sortOrder: 1 });

delete mongoose.models.PickupLocation;
export default mongoose.model('PickupLocation', PickupLocationSchema);
