import mongoose from 'mongoose';

const SizeChartItemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  image: { type: String, required: true },

  order: { type: Number, default: 0, index: true },
  enabled: { type: Boolean, default: true },

  // Trash (soft delete). A trashed item is also hidden (enabled: false) so the
  // public /size-chart page never shows it; enabledBeforeTrash restores it.
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  enabledBeforeTrash: { type: Boolean, default: null }
}, { timestamps: true });

// Re-register so dev hot reloads pick up schema changes (same as Category/SizeChart).
delete mongoose.models.SizeChartItem;
export default mongoose.models.SizeChartItem ||
  mongoose.model('SizeChartItem', SizeChartItemSchema);
