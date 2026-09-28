import mongoose from 'mongoose';

const SizeChartItemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  image: { type: String, required: true },

  order: { type: Number, default: 0, index: true },
  enabled: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.models.SizeChartItem ||
  mongoose.model('SizeChartItem', SizeChartItemSchema);
