import mongoose from "mongoose";

const ShadowBanSchema = new mongoose.Schema({
  value: { type: String, required: true, unique: true, index: true }, // Email or IP address
  type: { type: String, enum: ["email", "ip"], required: true },
  reason: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" }
}, { timestamps: true });

delete mongoose.models.ShadowBan;
export default mongoose.models.ShadowBan || mongoose.model("ShadowBan", ShadowBanSchema);
