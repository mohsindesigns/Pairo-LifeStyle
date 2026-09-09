import mongoose from "mongoose";

/**
 * Atomic sequence counter for race-safe sequential numbers (e.g. order numbers).
 * `_id` is the sequence name (e.g. "order:DEFAULT_STORE"); `seq` is incremented
 * atomically via findByIdAndUpdate($inc), so concurrent callers never collide.
 */
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 1000 },
});

export default mongoose.models.Counter || mongoose.model("Counter", CounterSchema);
