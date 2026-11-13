import mongoose from 'mongoose';

// A 3D model of one product colour for the homepage 3D rack. Made by the OFFCUT 3D service
// (from photos with a Tripo API key, or from an uploaded .glb), then copied into our own storage.
const Rack3dModelSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  color: { type: String, default: '' },          // colour value label ('' = product without colours)

  // latest job at the 3D service
  status: { type: String, enum: ['queued', 'processing', 'ready', 'failed'], default: 'queued' },
  stage: { type: String, default: '' },
  progress: { type: Number, default: 0 },
  error: { type: String, default: '' },
  jobId: { type: String, default: '' },
  jobAuth: { type: String, enum: ['key', 'token'], default: 'key' }, // identity that made the job: Tripo key | service token

  // current files (kept live while a new model is being made)
  rackUrl: { type: String, default: '' },        // light model (~20k triangles) shown on the rack
  detailUrl: { type: String, default: '' },      // close-up model (~50k triangles)
  previewUrl: { type: String, default: '' },
  files: { type: [{ url: String, publicId: String }], default: [] }, // stored files, for clean-up
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

Rack3dModelSchema.index({ product: 1, color: 1 }, { unique: true });

delete mongoose.models.Rack3dModel;
export default mongoose.models.Rack3dModel || mongoose.model('Rack3dModel', Rack3dModelSchema);
