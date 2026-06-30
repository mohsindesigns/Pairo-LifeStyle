import mongoose from 'mongoose';

const AffiliateMarketingAssetSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['Banner', 'Logo', 'Video', 'Guideline', 'Social Graphic'], required: true },
  fileUrl: { type: String, required: true },
  dimensions: String, // e.g. "728x90", "1080x1080"
  status: { type: String, enum: ['Active', 'Archived'], default: 'Active', index: true }
}, { timestamps: true });

delete mongoose.models.AffiliateMarketingAsset;
export default mongoose.models.AffiliateMarketingAsset || mongoose.model('AffiliateMarketingAsset', AffiliateMarketingAssetSchema);
