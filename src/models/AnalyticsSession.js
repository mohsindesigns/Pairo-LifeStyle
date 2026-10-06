import mongoose from 'mongoose';

const AnalyticsSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  visitorId: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
  userName: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  startedAt: { type: Date, required: true, index: true },
  lastSeenAt: { type: Date, required: true, index: true },
  pageViews: { type: Number, default: 0 },
  eventCount: { type: Number, default: 0 },
  conversionCount: { type: Number, default: 0 },
  clickCount: { type: Number, default: 0 },
  activeMs: { type: Number, default: 0 },
  entryPath: { type: String, default: '' },
  landingPath: { type: String, default: '' },
  exitPath: { type: String, default: '' },
  referrer: { type: String, default: '' },
  source: { type: String, default: 'direct', index: true },
  medium: { type: String, default: '' },
  campaign: { type: String, default: '' },
  device: { type: String, default: 'desktop' },
  browser: { type: String, default: '' },
  os: { type: String, default: '' },
  country: { type: String, default: '' },
}, { timestamps: false });

export default mongoose.models.AnalyticsSession || mongoose.model('AnalyticsSession', AnalyticsSessionSchema);
