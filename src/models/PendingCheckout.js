import mongoose from 'mongoose';

const PendingCheckoutSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, default: 'DEFAULT_STORE' },
  idempotencyKey: { type: String, required: true },
  status: { type: String, enum: ['pending', 'consumed', 'expired'], default: 'pending' },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  stripePaymentIntentId: { type: String, index: true },
  consumedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  failureReason: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

PendingCheckoutSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
PendingCheckoutSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export default mongoose.models.PendingCheckout || mongoose.model('PendingCheckout', PendingCheckoutSchema);
