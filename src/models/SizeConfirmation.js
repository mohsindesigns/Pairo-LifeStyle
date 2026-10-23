import mongoose from 'mongoose';

const ReplySchema = new mongoose.Schema({
  messageId: { type: String, index: true },
  fromEmail: { type: String, trim: true, lowercase: true },
  fromName: { type: String, trim: true },
  text: { type: String },
  receivedAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
}, { _id: true });

/**
 * One "please confirm your size" email sent from the admin for an order, plus
 * every customer reply that has been matched back to it.
 */
const SizeConfirmationSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  orderNumber: { type: String, required: true, index: true },
  customerName: { type: String, trim: true },
  customerEmail: { type: String, required: true, trim: true, lowercase: true, index: true },

  subject: { type: String, required: true },
  // RFC 5322 Message-ID we stamp on the outgoing mail; replies reference it.
  messageId: { type: String, required: true, unique: true },
  sizeChartImageUrl: { type: String },
  sentBy: { type: String },
  auto: { type: Boolean, default: false }, // sent automatically when the order was received
  chartLabels: [{ type: String }], // size charts included in the email
  sentAt: { type: Date, default: Date.now },

  status: { type: String, enum: ['Awaiting Reply', 'Replied', 'Confirmed'], default: 'Awaiting Reply', index: true },
  confirmedSize: { type: String, trim: true },
  confirmedAt: { type: Date },

  replies: [ReplySchema],
  unreadReplies: { type: Number, default: 0, index: true },
  lastReplyAt: { type: Date },

  // Soft delete (Trash)
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.models.SizeConfirmation || mongoose.model('SizeConfirmation', SizeConfirmationSchema);
