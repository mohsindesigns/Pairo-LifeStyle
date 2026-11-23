import mongoose from "mongoose";

const ProcessStepSchema = new mongoose.Schema({
  id: { type: String, default: () => Math.random().toString(36).substring(2, 11) },
  image: { type: String, required: true },
  heading: { type: String, required: true },
  subheading: { type: String },
  description: { type: String },
  order: { type: Number, default: 0 }
});

// Steps moved to the trash: kept (possibly half-finished) until restored or deleted permanently.
const TrashedProcessStepSchema = new mongoose.Schema({
  id: { type: String },
  image: { type: String, default: "" },
  heading: { type: String, default: "" },
  subheading: { type: String },
  description: { type: String },
  order: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null }
});

const ProductProcessSchema = new mongoose.Schema({
  key: { type: String, default: "global", unique: true },
  title: { type: String, required: true, default: "Our Product Process" },
  subtitle: { type: String, default: "How we craft premium shearling garments" },
  steps: [ProcessStepSchema],
  // select:false keeps trashed steps out of the public process APIs (they read the doc as-is);
  // the admin API asks for them explicitly with .select("+trashedSteps").
  trashedSteps: { type: [TrashedProcessStepSchema], default: [], select: false }
}, { timestamps: true });

delete mongoose.models.ProductProcess;
export default mongoose.models.ProductProcess || mongoose.model("ProductProcess", ProductProcessSchema);
