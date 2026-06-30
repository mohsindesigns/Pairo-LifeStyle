import mongoose from 'mongoose';

const AffiliateSettingsSchema = new mongoose.Schema({
  defaultCommissionRate: { type: Number, default: 5 }, // 5%
  cookieDurationDays: { type: Number, default: 30 }, // 30 Days
  minimumPayoutAmount: { type: Number, default: 50 }, // $50
  autoApproveApplications: { type: Boolean, default: false },
  allowedCountries: { type: [String], default: [] }, // Empty means all
  referralAttributionMode: { type: String, enum: ['last-click', 'first-click'], default: 'last-click' },
  supportEmail: { type: String, default: 'affiliates@pairolifestyle.com' }
}, { timestamps: true });

delete mongoose.models.AffiliateSettings;
export default mongoose.models.AffiliateSettings || mongoose.model('AffiliateSettings', AffiliateSettingsSchema);
