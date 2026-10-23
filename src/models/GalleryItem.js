import mongoose from 'mongoose';

const GalleryItemSchema = new mongoose.Schema({
  image: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },

  // Link to a product by ObjectId — resolves URL dynamically from product slug
  linkedProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },

  order: { type: Number, default: 0, index: true },
  enabled: { type: Boolean, default: true },

  // Trash (soft delete). Trashing also hides the item (enabled:false) so the public gallery
  // stops showing it; enabledBeforeTrash lets Restore put the visibility back.
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  enabledBeforeTrash: { type: Boolean, default: null }
}, { timestamps: true });

// Drop a cached model so schema changes apply after hot reloads (same as Blog / Media)
delete mongoose.models.GalleryItem;
export default mongoose.models.GalleryItem ||
  mongoose.model('GalleryItem', GalleryItemSchema);
