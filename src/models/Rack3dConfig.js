import mongoose from 'mongoose';

// Single document: what hangs on the homepage 3D rack (left to right) and the 3D Rack settings.
// Keys are stored encrypted (see src/lib/rack3d/server.js); env vars are only a fallback.
const Rack3dConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  items: {
    type: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      scale: { type: Number, default: 1, min: 0.5, max: 2 }, // relative garment size on the rack
    }],
    default: [],
  },
  settings: {
    serviceUrl: { type: String, default: '' },        // OFFCUT 3D service address ('' = env / default)
    maxRunning: { type: Number, default: 0 },         // models sent to the service at once (0 = default)
    defaultQuality: { type: String, default: 'detailed' },
    autoHang: { type: Boolean, default: true },       // new models hang on the rack when ready (default in the UI)
  },
  secrets: {
    tripoKey: { type: String, default: '' },          // encrypted Tripo API key
    serviceToken: { type: String, default: '' },      // encrypted 3D service token
  },
}, { timestamps: true });

delete mongoose.models.Rack3dConfig;
export default mongoose.models.Rack3dConfig || mongoose.model('Rack3dConfig', Rack3dConfigSchema);
