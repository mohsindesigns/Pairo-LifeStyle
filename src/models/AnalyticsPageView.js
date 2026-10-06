import mongoose from 'mongoose';

const AnalyticsPageViewSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  visitorId: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  path: { type: String, required: true },
  pageType: { type: String, default: 'page', index: true },
  categorySlug: { type: String, default: '' },
  title: { type: String, default: '' },
  referrer: { type: String, default: '' },
  enteredAt: { type: Date, required: true, index: true },
  engagedMs: { type: Number, default: 0 },
  maxScrollPct: { type: Number, default: 0 },
  device: { type: String, default: '' },
  browser: { type: String, default: '' },
  os: { type: String, default: '' },
  country: { type: String, default: '' },
  source: { type: String, default: '' },
  medium: { type: String, default: '' },
  campaign: { type: String, default: '' },
  segment: { type: String, default: 'guest' },
}, { timestamps: false });

AnalyticsPageViewSchema.index({ path: 1, enteredAt: -1 });

export default mongoose.models.AnalyticsPageView || mongoose.model('AnalyticsPageView', AnalyticsPageViewSchema);
