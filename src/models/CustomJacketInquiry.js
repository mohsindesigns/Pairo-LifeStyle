import mongoose from 'mongoose';

const CustomJacketInquirySchema = new mongoose.Schema({
  // Personal Information
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  country: { type: String, trim: true },
  city: { type: String, trim: true },

  // Jacket Specifications
  jacketType: { type: String, trim: true },
  gender: { type: String, enum: ['Men', 'Women', 'Unisex', ''], default: '' },
  preferredLeather: { type: String, trim: true },
  preferredColor: { type: String, trim: true },
  size: { type: String, trim: true },
  budget: { type: String, trim: true },
  deadline: { type: String, trim: true }, // Store as string (date or event description)

  // Reference Images (uploaded URLs)
  referenceImages: [{ type: String }],

  // Additional Notes
  additionalNotes: { type: String, trim: true },

  // Inquiry Management
  status: {
    type: String,
    enum: ['New', 'Contacted', 'In Progress', 'Converted', 'Completed', 'Cancelled'],
    default: 'New',
    index: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  adminNotes: { type: String, trim: true },

  // Set once an admin finalizes pricing and converts this inquiry into a real Order
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },

  // Tracking
  ipAddress: { type: String },
  userAgent: { type: String },

  // Soft delete
  isDeleted: { type: Boolean, default: false, index: true },

  tenantId: { type: String, default: 'DEFAULT_STORE', index: true }
}, { timestamps: true });

// Text search index
CustomJacketInquirySchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text',
  phone: 'text',
  jacketType: 'text',
  additionalNotes: 'text'
});

export default mongoose.models.CustomJacketInquiry ||
  mongoose.model('CustomJacketInquiry', CustomJacketInquirySchema);
