import mongoose from 'mongoose';
import { encrypt, decrypt } from '../lib/affiliate/encryption.js';

const AffiliateApplicationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, index: true },
  phone: { type: String, required: true },
  dob: { type: Date, required: true },
  
  tenantId: { type: String, default: 'default', index: true }, // SaaS multi-tenancy
  
  address: {
    country: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    zipCode: { type: String, required: true },
    street: { type: String, required: true }
  },
  
  bankingInfo: {
    accountHolder: { type: String, required: true },
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    iban: String,
    swiftCode: String,
    routingNumber: String,
    paypalEmail: String
  },
  
  businessInfo: {
    companyName: String,
    website: String,
    socialLinks: [String]
  },
  
  marketingAnswers: {
    promotionStrategy: { type: String, required: true },
    audienceSize: { type: String, required: true },
    experience: { type: String, required: true }
  },
  
  identityDocuments: [String], // URLs to driver license, passport, national ID scans
  profilePhoto: String, // Profile photo filename (stored in private/kyc/)
  bankVerificationDocument: String, // Bank statement / certificate filename (stored in private/kyc/)
  referralCode: { type: String, unique: true, sparse: true, index: true }, // Applicant's preferred code (editable by admin before approval)
  customerDiscountType: { type: String, enum: ['Percentage', 'Fixed', 'None'], default: 'None' },
  customerDiscountValue: { type: Number, default: 0 },
  status: { type: String, enum: ['Pending', 'Under Review', 'Approved', 'Rejected'], default: 'Pending', index: true },
  rejectionReason: String,
  notes: String, // Internal admin comments
  
  verification: {
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    verifiedAt: Date,
    documentExpiry: Date
  }
}, { 
  timestamps: true,
  versionKey: '__v',
  optimisticConcurrency: true
});

// Pre-save hook to encrypt sensitive fields for applicant privacy protection
AffiliateApplicationSchema.pre('save', function() {
  const isPlaintext = (val) => val && !val.includes(':');

  if (this.bankingInfo) {
    if (this.isModified('bankingInfo.accountNumber') && isPlaintext(this.bankingInfo.accountNumber)) {
      this.bankingInfo.accountNumber = encrypt(this.bankingInfo.accountNumber);
    }
    if (this.isModified('bankingInfo.iban') && isPlaintext(this.bankingInfo.iban)) {
      this.bankingInfo.iban = encrypt(this.bankingInfo.iban);
    }
    if (this.isModified('bankingInfo.swiftCode') && isPlaintext(this.bankingInfo.swiftCode)) {
      this.bankingInfo.swiftCode = encrypt(this.bankingInfo.swiftCode);
    }
    if (this.isModified('bankingInfo.routingNumber') && isPlaintext(this.bankingInfo.routingNumber)) {
      this.bankingInfo.routingNumber = encrypt(this.bankingInfo.routingNumber);
    }
  }
});

// Global helper for plain objects (lean queries)
export function decryptApplication(app) {
  if (!app) return app;
  if (app.bankingInfo) {
    app.bankingInfo.accountNumber = decrypt(app.bankingInfo.accountNumber);
    app.bankingInfo.iban = decrypt(app.bankingInfo.iban);
    app.bankingInfo.swiftCode = decrypt(app.bankingInfo.swiftCode);
    app.bankingInfo.routingNumber = decrypt(app.bankingInfo.routingNumber);
  }
  return app;
}

delete mongoose.models.AffiliateApplication;
export default mongoose.models.AffiliateApplication || mongoose.model('AffiliateApplication', AffiliateApplicationSchema);
