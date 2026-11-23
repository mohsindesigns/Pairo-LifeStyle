import mongoose from 'mongoose';

const StaffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  roleId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Role',
    required: true 
  },
  status: { 
    type: String, 
    enum: ['Active', 'Suspended', 'Locked'], 
    default: 'Active' 
  },
  image: { type: String },
  security: {
    lastLogin: { type: Date },
    lastLoginIp: { type: String },
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    passwordChangedAt: { type: Date, default: Date.now }
  },
  // Soft delete ("Trash"). Trashing also sets status to 'Suspended' (remembering the
  // previous status in statusBeforeTrash), so the existing status checks in the auth
  // route block sign-in and end live sessions. Restore puts the previous status back.
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  statusBeforeTrash: { type: String, default: null }
}, { timestamps: true });

// Dev hot reload keeps the previously compiled model (and its old schema) on
// mongoose.models; drop it when it predates the Trash fields so they aren't stripped.
if (process.env.NODE_ENV !== 'production' && mongoose.models.Staff && !mongoose.models.Staff.schema.path('isDeleted')) {
  mongoose.deleteModel('Staff');
}

export default mongoose.models.Staff || mongoose.model('Staff', StaffSchema);
