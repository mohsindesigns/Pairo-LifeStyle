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
  }
}, { timestamps: true });

export default mongoose.models.Staff || mongoose.model('Staff', StaffSchema);
