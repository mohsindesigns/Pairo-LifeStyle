import mongoose from 'mongoose';

const ItemSchema = new mongoose.Schema({
  item_id: String,
  item_name: String,
  item_category: String,
  item_category_id: String,
  productId: String,
  price: Number,
  quantity: Number,
  priceBand: String,
  position: Number,
}, { _id: false });

const AnalyticsEventSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  visitorId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  pageViewId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  name: { type: String, required: true },
  path: { type: String, default: '' },
  pageType: { type: String, default: '' },
  categorySlug: { type: String, default: '' },
  device: { type: String, default: '' },
  browser: { type: String, default: '' },
  os: { type: String, default: '' },
  country: { type: String, default: '' },
  source: { type: String, default: '' },
  medium: { type: String, default: '' },
  campaign: { type: String, default: '' },
  segment: { type: String, default: 'guest' },
  value: { type: Number, default: 0 },
  currency: { type: String, default: '' },
  items: { type: [ItemSchema], default: [] },
  category: { type: String, default: '' },
  priceBand: { type: String, default: '' },
  productId: { type: String, default: '' },
  search_term: { type: String, default: '' },
  list_name: { type: String, default: '' },
  shipping_tier: { type: String, default: '' },
  payment_type: { type: String, default: '' },
  transaction_id: { type: String, default: '' },
  label: { type: String, default: '' },
  href: { type: String, default: '' },
  section: { type: String, default: '' },
  durationMs: { type: Number, default: 0 },
  fieldName: { type: String, default: '' },
  filled: { type: Boolean, default: false },
  variant: { type: String, default: '' },
  statusCode: { type: Number, default: 0 },
  resultCount: { type: Number, default: null },
  clickX: { type: Number, default: null },
  clickY: { type: Number, default: null },
  createdAt: { type: Date, required: true, default: Date.now, index: true },
}, { timestamps: false });

AnalyticsEventSchema.index({ name: 1, createdAt: -1 });
AnalyticsEventSchema.index({ 'items.item_id': 1, createdAt: -1 });
AnalyticsEventSchema.index({ 'items.item_category': 1, createdAt: -1 });

export default mongoose.models.AnalyticsEvent || mongoose.model('AnalyticsEvent', AnalyticsEventSchema);
