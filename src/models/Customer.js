import mongoose from 'mongoose';

const CustomerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, default: null },
  role: { type: String, default: 'user' },
  emailVerified: { type: Boolean, default: false },
  verificationToken: { type: String, default: null },
  verificationTokenExpiry: { type: Date, default: null },
  pendingEmail: { type: String, default: null },
  pendingEmailToken: { type: String, default: null },
  pendingEmailTokenExpiry: { type: Date, default: null },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  cart: [{
    productId: { type: Number },
    quantity: { type: Number, default: 1 },
    selectedSize: { type: String },
    selectedColor: { type: String }
  }],
  orderHistory: [{
    items: Array,
    total: Number,
    date: { type: Date, default: Date.now },
    status: { type: String, default: 'Delivered' }
  }],
  addresses: [{
    fullName: String,
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    isDefault: { type: Boolean, default: false }
  }],
  paymentMethods: [{
    type: { type: String, default: 'Visa' },
    last4: String,
    expiry: String,
    isDefault: { type: Boolean, default: false }
  }],
  preferredCourier: { type: String, default: 'TCS' },
  activityLog: [{
    action: String,
    details: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);
