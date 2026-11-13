import mongoose from 'mongoose';

// Single document: what hangs on the homepage 3D rack, left to right.
const Rack3dConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  items: {
    type: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      scale: { type: Number, default: 1, min: 0.5, max: 2 }, // relative garment size on the rack
    }],
    default: [],
  },
}, { timestamps: true });

delete mongoose.models.Rack3dConfig;
export default mongoose.models.Rack3dConfig || mongoose.model('Rack3dConfig', Rack3dConfigSchema);
