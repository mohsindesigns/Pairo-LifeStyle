import mongoose from "mongoose";

const QuestionReplySchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
  staffName: { type: String, required: true },
  answer: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ProductQuestionSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true, index: true },
  question: { type: String, required: true },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Hidden"],
    default: "Pending",
    index: true
  },
  replies: [QuestionReplySchema],
  isDeleted: { type: Boolean, default: false, index: true }
}, { timestamps: true });

// Performance index for fetching product questions (approved, sorted by date)
ProductQuestionSchema.index({ productId: 1, status: 1, isDeleted: 1, createdAt: -1 });

delete mongoose.models.ProductQuestion;
export default mongoose.models.ProductQuestion || mongoose.model("ProductQuestion", ProductQuestionSchema);
