import mongoose from 'mongoose';

// A 3D model of one product colour for the homepage 3D rack. Made by the OFFCUT 3D service
// (from the product's photos with a Tripo API key, or from an uploaded .glb), then copied into our own storage.
const Rack3dModelSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  color: { type: String, default: '' },          // colour value label ('' = product without colour options)

  // latest job. waiting = queued here, not yet sent to the 3D service (we keep a few running at a time)
  status: { type: String, enum: ['waiting', 'queued', 'processing', 'ready', 'failed'], default: 'waiting', index: true },
  stage: { type: String, default: '' },
  progress: { type: Number, default: 0 },
  error: { type: String, default: '' },
  jobId: { type: String, default: '' },
  jobAuth: { type: String, enum: ['key', 'token'], default: 'key' }, // identity that made the job: Tripo key | service token

  // what to make it from (kept until the job is sent)
  views: { front: { type: String, default: '' }, back: { type: String, default: '' } },
  quality: { type: String, default: 'detailed' },
  addToRack: { type: Boolean, default: false },  // hang it on the rack as soon as it is ready

  // current files (kept live while a new model is being made)
  rackUrl: { type: String, default: '' },        // light model (~20k triangles) shown on the rack
  detailUrl: { type: String, default: '' },      // close-up model (~50k triangles)
  previewUrl: { type: String, default: '' },
  files: { type: [{ url: String, publicId: String }], default: [] }, // stored files, for clean-up
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Trash (soft delete): a trashed model leaves the rack; Restore brings it back, Delete permanently removes files
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

Rack3dModelSchema.index({ product: 1, color: 1 }, { unique: true });

delete mongoose.models.Rack3dModel;
export default mongoose.models.Rack3dModel || mongoose.model('Rack3dModel', Rack3dModelSchema);
