import mongoose from 'mongoose';

// Bulk / corporate gifting quote request submitted from the "Corporate Gifting" CMS page.
const CorporateGiftingInquirySchema = new mongoose.Schema({
  // Company information
  company: { type: String, required: true, trim: true },
  contactName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  country: { type: String, trim: true },
  city: { type: String, trim: true },

  // Pack details
  occasion: { type: String, trim: true },
  quantity: { type: String, trim: true },
  budget: { type: String, trim: true },
  deliveryDate: { type: String, trim: true },
  items: [{ type: String, trim: true }],

  // Branding & packaging
  branding: { type: String, trim: true },
  packaging: { type: String, trim: true },
  leather: { type: String, trim: true },
  brandColors: { type: String, trim: true },
  greetingCard: { type: Boolean, default: false },
  logos: [{ url: String, name: String }],

  notes: { type: String, trim: true },
  referenceImages: [{ type: String }],

  // Management
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Quoted', 'In Progress', 'Completed', 'Cancelled'],
    default: 'New',
    index: true
  },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  adminNotes: { type: String, trim: true },

  ipAddress: { type: String },
  userAgent: { type: String },
  isDeleted: { type: Boolean, default: false, index: true }
}, { timestamps: true });

export default mongoose.models.CorporateGiftingInquiry ||
  mongoose.model('CorporateGiftingInquiry', CorporateGiftingInquirySchema);
