import mongoose from "mongoose";

const ReplySchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
  staffName: { type: String, required: true },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ReviewSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, default: "DEFAULT_STORE", index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5, index: true },
  title: { type: String },
  comment: { type: String },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true, index: true },
  status: { 
    type: String, 
    enum: ["Pending", "Approved", "Rejected", "Spam"], 
    default: "Pending", 
    index: true 
  },
  verifiedPurchase: { type: Boolean, default: true, index: true },
  helpfulVotes: { type: Number, default: 0 },
  unhelpfulVotes: { type: Number, default: 0 },
  voters: [{ type: String }], // IP + UserAgent hashes to prevent duplicate voting
  reported: { type: Boolean, default: false, index: true },
  reportsCount: { type: Number, default: 0 },
  replies: [ReplySchema],
  isFeatured: { type: Boolean, default: false, index: true },
  media: [{
    url: String,
    type: { type: String, enum: ["image", "video"] }
  }],
  recommend: { type: Boolean, default: true },
  ipAddress: { type: String },
  userAgent: { type: String },
  spamScore: { type: Number, default: 0 },
  fingerprint: { type: String, index: true },
  shadowBanned: { type: Boolean, default: false, index: true },
  isDeleted: { type: Boolean, default: false, index: true } // Soft delete support
}, { timestamps: true });

// Compound unique index: prevent duplicate reviews for the same product in the same order
ReviewSchema.index({ productId: 1, orderId: 1 }, { unique: true });

// Index for email duplicate checking
ReviewSchema.index({ customerEmail: 1, productId: 1 });

// Performance index for fetching reviews for a product (approved, sorted by helpfulness or date)
ReviewSchema.index({ productId: 1, status: 1, isDeleted: 1, helpfulVotes: -1, createdAt: -1 });

delete mongoose.models.Review;
export default mongoose.models.Review || mongoose.model("Review", ReviewSchema);
