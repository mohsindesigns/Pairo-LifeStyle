import mongoose from "mongoose";

const SizeChartSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, unique: true, trim: true },
    publicHeading: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    
    // Spreadsheet data structures
    columns: { type: [String], required: true, default: ["Size", "Chest", "Waist", "Sleeve"] },
    rows: { type: [[String]], required: true, default: [] },
    
    // Assignment Rules
    assignmentType: {
      type: String,
      enum: ["none", "category", "product"],
      default: "none"
    },
    // Reference ID to Category or Product
    assignmentTargetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    
    status: { type: String, enum: ["Draft", "Published"], default: "Published" },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Indexes
SizeChartSchema.index({ isDeleted: 1 });
SizeChartSchema.index({ assignmentType: 1, assignmentTargetId: 1 });

delete mongoose.models.SizeChart;
export default mongoose.models.SizeChart || mongoose.model("SizeChart", SizeChartSchema);
