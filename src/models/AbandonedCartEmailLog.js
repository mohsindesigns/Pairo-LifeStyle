import mongoose from 'mongoose';

// One row per attempt to send (or deliberately skip) an abandoned-cart recovery email. This is the "complete
// activity" shown in Admin > Orders > Abandoned Carts > Recovery emails: who was emailed, when, with which
// voucher, whether the mail server accepted it, and the exact error when it did not.
const AbandonedCartEmailLogSchema = new mongoose.Schema({
  cartId: { type: mongoose.Schema.Types.ObjectId, ref: 'AbandonedCart', index: true },
  email: { type: String, trim: true, lowercase: true, index: true },
  firstName: { type: String, trim: true },

  // sent    = the mail server (Brevo) accepted the message
  // failed  = the send threw (SMTP error, not configured, rejected...) - it is retried with a back-off
  // skipped = deliberately not sent (the shopper already ordered)
  // gave-up = failed too many times, will not be retried
  status: { type: String, enum: ['sent', 'failed', 'skipped', 'gave-up'], required: true, index: true },
  reason: { type: String, default: '' },
  trigger: { type: String, enum: ['scheduler', 'cron', 'manual'], default: 'scheduler' },
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
  attempt: { type: Number, default: 1 },

  subject: { type: String, default: '' },
  voucherCode: { type: String, default: '' },
  voucherKind: { type: String, enum: ['personal', 'campaign', ''], default: '' },
  discountLabel: { type: String, default: '' },

  cartTotal: { type: Number, default: 0 },
  itemCount: { type: Number, default: 0 },
  itemNames: [{ type: String }],
  idleMinutes: { type: Number, default: null },

  // Mail server response (proof of acceptance, and what to search for in the Brevo logs)
  messageId: { type: String, default: '' },
  smtpResponse: { type: String, default: '' },
  accepted: [{ type: String }],
  rejected: [{ type: String }],
  error: { type: String, default: '' },
}, { timestamps: true });

AbandonedCartEmailLogSchema.index({ createdAt: -1 });
AbandonedCartEmailLogSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.AbandonedCartEmailLog ||
  mongoose.model('AbandonedCartEmailLog', AbandonedCartEmailLogSchema);
