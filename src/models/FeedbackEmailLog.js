import mongoose from 'mongoose';

// One row per feedback-request email (or test) so the admin can see exactly what was sent and what failed.
const FeedbackEmailLogSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
  orderNumber: { type: String, default: '' },
  email: { type: String, trim: true, lowercase: true, index: true },
  firstName: { type: String, default: '' },
  status: { type: String, enum: ['sent', 'failed', 'test'], required: true, index: true },
  trigger: { type: String, enum: ['manual', 'test'], default: 'manual' },
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
  messageId: { type: String, default: '' },
  error: { type: String, default: '' },
}, { timestamps: true });

FeedbackEmailLogSchema.index({ createdAt: -1 });

export default mongoose.models.FeedbackEmailLog || mongoose.model('FeedbackEmailLog', FeedbackEmailLogSchema);
