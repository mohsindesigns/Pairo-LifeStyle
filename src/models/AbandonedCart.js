import mongoose from 'mongoose';

// Snapshot of a customer's checkout attempt, saved as they fill in the form and before they
// complete (or abandon) the order — so the admin can see exactly who was shopping, what they
// typed, and when, even if they never finish. Upserted by `sessionKey` (the checkout page's
// idempotencyKey) so repeated autosave calls from the same visit update one record instead of
// creating a new one on every keystroke.
const AbandonedCartSchema = new mongoose.Schema({
  sessionKey: { type: String, required: true, unique: true, index: true },

  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    image: String,
    price: Number,
    quantity: Number,
    selectedOptions: mongoose.Schema.Types.Mixed,
    // Made-to-measure / corporate-gifting lines carry measurements or picked items that are not stored here,
    // so they cannot be rebuilt from an emailed recovery link.
    custom: { type: Boolean, default: false },
  }],
  cartSubtotal: { type: Number, default: 0 },
  cartTotal: { type: Number, default: 0 },

  contact: {
    email: String,
    firstName: String,
    lastName: String,
    phone: String,
  },
  shippingAddress: {
    fullName: String,
    street: String,
    city: String,
    state: String,
    county: String,
    zip: String,
    country: String,
    phone: String,
  },

  ipAddress: String,
  // Where the visitor is, resolved from the IP address (same details the order page shows). Looked up once per IP.
  ipLocation: {
    city: String,
    state: String,
    county: String,
    country: String,
    countryCode: String,
    postal: String,
    lat: Number,
    lon: Number,
    mapsUrl: String,
    isp: String,
    timezone: String,
    isLocal: Boolean,
  },
  userAgent: String,

  // Set to 'recovered' the moment this session's idempotencyKey turns into a real Order —
  // cheaper and more reliable than a background job guessing who "gave up".
  status: { type: String, enum: ['active', 'recovered'], default: 'active', index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },

  // Tracks the automatic win-back voucher email (src/lib/abandonedCartService.js), sent once
  // per cart snapshot by the /api/cron/abandoned-carts route once the cart has gone quiet long
  // enough to count as abandoned.
  recoveryEmail: {
    sent: { type: Boolean, default: false },
    sentAt: { type: Date, default: null },
    voucherCode: { type: String, default: null },
    // Delivery tracking: a failed send is retried with a back-off and eventually given up on.
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    nextAttemptAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    messageId: { type: String, default: null },
    gaveUp: { type: Boolean, default: false },
    // Set while a send is in progress. A claim older than a few minutes (the process died mid-send) is treated as free.
    sendingSince: { type: Date, default: null },
  },

  // Second, one-time reminder ~24h after the first email if the shopper still has not ordered
  // (src/lib/abandonedCartService.js). Same claim/lease/back-off scheme as `recoveryEmail`.
  reminderEmail: {
    sent: { type: Boolean, default: false },
    sentAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    nextAttemptAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    messageId: { type: String, default: null },
    gaveUp: { type: Boolean, default: false },
    sendingSince: { type: Date, default: null },
  },

  // SHA-256 hashes of the recovery-link tokens sent by email (see src/lib/abandonedCartRecovery.js). The plain token
  // exists only inside the email. Hidden from normal reads so it can never leak through an admin API response.
  recoveryTokens: {
    type: [{ _id: false, hash: { type: String, required: true }, createdAt: { type: Date, default: Date.now } }],
    default: [],
    select: false,
  },

  // Admin Trash (soft delete). Trashed carts are hidden from the admin list (except the
  // Trash view) and must not receive recovery emails.
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

AbandonedCartSchema.index({ status: 1, updatedAt: -1 });
AbandonedCartSchema.index({ 'recoveryTokens.hash': 1 }, { sparse: true });

// A dev server that hot-reloads this file keeps the model compiled from the old schema,
// which would silently drop the newer Trash fields; recompile it when they are missing.
if (mongoose.models.AbandonedCart && (!mongoose.models.AbandonedCart.schema.path('isDeleted') || !mongoose.models.AbandonedCart.schema.path('recoveryTokens'))) {
  mongoose.deleteModel('AbandonedCart');
}

export default mongoose.models.AbandonedCart || mongoose.model('AbandonedCart', AbandonedCartSchema);
