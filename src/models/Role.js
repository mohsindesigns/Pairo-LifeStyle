import mongoose from 'mongoose';

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String },
  permissions: {
    type: Map,
    of: [String],
    default: {}
  },
  // Example permissions map structure:
  // {
  //   "products": ["view", "create", "edit", "delete"],
  //   "orders": ["view", "update", "refund"],
  //   "customers": ["view", "edit", "delete"],
  //   "blogs": ["view", "create", "edit", "publish", "delete"],
  //   "staff": ["view", "manage_roles", "create_staff"],
  //   "settings": ["view", "edit"],
  //   "analytics": ["view"],
  //   "media": ["manage"]
  // }
  isSystem: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  // Soft delete ("Trash"). Only custom roles that no staff member uses can be trashed;
  // a trashed role is hidden from role pickers and can't be assigned.
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

// Dev hot reload keeps the previously compiled model (and its old schema) on
// mongoose.models; drop it when it predates the Trash fields so they aren't stripped.
if (process.env.NODE_ENV !== 'production' && mongoose.models.Role && !mongoose.models.Role.schema.path('isDeleted')) {
  mongoose.deleteModel('Role');
}

export default mongoose.models.Role || mongoose.model('Role', RoleSchema);
