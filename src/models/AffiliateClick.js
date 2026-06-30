import mongoose from 'mongoose';

const AffiliateClickSchema = new mongoose.Schema({
  affiliateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Affiliate', required: true, index: true },
  referralCode: { type: String, required: true, index: true },
  landingPage: String,
  referrer: String,
  ip: { type: String, index: true },
  userAgent: String,
  
  tenantId: { type: String, default: 'default', index: true }, // SaaS multi-tenancy
  
  utmParameters: {
    source: String,
    medium: String,
    campaign: String,
    content: String,
    term: String
  },
  
  converted: { type: Boolean, default: false, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true }
}, { timestamps: true });

// Optimize query performance for click reports and anti-spam check
AffiliateClickSchema.index({ referralCode: 1, createdAt: -1 });
AffiliateClickSchema.index({ affiliateId: 1, createdAt: -1 });
AffiliateClickSchema.index({ ip: 1, createdAt: -1 }); // Anti-spam rate limit index
AffiliateClickSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days TTL auto cleanup

delete mongoose.models.AffiliateClick;
export default mongoose.models.AffiliateClick || mongoose.model('AffiliateClick', AffiliateClickSchema);
