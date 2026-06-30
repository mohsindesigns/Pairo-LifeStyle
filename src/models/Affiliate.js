import mongoose from 'mongoose';
import { encrypt, decrypt } from '../lib/affiliate/encryption.js';

const AffiliateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  affiliateId: { type: String, required: true, unique: true, index: true },
  referralCode: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['Active', 'Suspended'], default: 'Active', index: true },
  commissionRate: { type: Number, default: 5 }, // Default commission percentage
  balance: { type: Number, default: 0 }, // Available to pay
  lifetimeEarnings: { type: Number, default: 0 }, // Cumulative commissions approved
  couponCode: { type: String, unique: true, sparse: true, index: true }, // Optional direct coupon code
  
  tenantId: { type: String, default: 'default', index: true }, // SaaS multi-tenancy
  isVerified: { type: Boolean, default: false }, // Email verification flag
  isDeleted: { type: Boolean, default: false, index: true }, // GDPR soft deletes
  
  address: {
    country: String,
    state: String,
    city: String,
    zipCode: String,
    street: String
  },
  
  bankingInfo: {
    accountHolder: String,
    bankName: String,
    accountNumber: String,
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
    promotionStrategy: String,
    audienceSize: String,
    experience: String
  },
  
  ipAddress: String,
  deviceInfo: String
}, { 
  timestamps: true,
  versionKey: '__v',
  optimisticConcurrency: true
});

// Pre-save hook to encrypt sensitive fields and run formats validation
AffiliateSchema.pre('save', function() {
  // Simple check for unencrypted fields (they don't contain a colon)
  const isPlaintext = (val) => val && !val.includes(':');

  if (this.bankingInfo) {
    // 1. SWIFT Code Validation
    if (this.bankingInfo.swiftCode && isPlaintext(this.bankingInfo.swiftCode)) {
      const cleanSwift = this.bankingInfo.swiftCode.toUpperCase().trim();
      const swiftRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
      if (!swiftRegex.test(cleanSwift)) {
        throw new Error("Invalid SWIFT/BIC code format.");
      }
      this.bankingInfo.swiftCode = cleanSwift;
    }

    // 2. Routing Number Validation (US Banks)
    if (this.bankingInfo.routingNumber && isPlaintext(this.bankingInfo.routingNumber)) {
      const cleanRouting = this.bankingInfo.routingNumber.trim();
      if (cleanRouting && !/^\d{9}$/.test(cleanRouting)) {
        throw new Error("Routing number must be exactly 9 digits.");
      }
    }

    // Encrypt sensitive credentials
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

// Helper decryption method
AffiliateSchema.methods.decryptBankingInfo = function() {
  if (this.bankingInfo) {
    this.bankingInfo.accountNumber = decrypt(this.bankingInfo.accountNumber);
    this.bankingInfo.iban = decrypt(this.bankingInfo.iban);
    this.bankingInfo.swiftCode = decrypt(this.bankingInfo.swiftCode);
    this.bankingInfo.routingNumber = decrypt(this.bankingInfo.routingNumber);
  }
  return this;
};

// Global helper for plain objects (lean queries)
export function decryptAffiliate(affiliate) {
  if (!affiliate) return affiliate;
  if (affiliate.bankingInfo) {
    affiliate.bankingInfo.accountNumber = decrypt(affiliate.bankingInfo.accountNumber);
    affiliate.bankingInfo.iban = decrypt(affiliate.bankingInfo.iban);
    affiliate.bankingInfo.swiftCode = decrypt(affiliate.bankingInfo.swiftCode);
    affiliate.bankingInfo.routingNumber = decrypt(affiliate.bankingInfo.routingNumber);
  }
  return affiliate;
}

delete mongoose.models.Affiliate;
export default mongoose.models.Affiliate || mongoose.model('Affiliate', AffiliateSchema);
