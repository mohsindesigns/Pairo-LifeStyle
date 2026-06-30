import mongoose from 'mongoose';

const AffiliatePayoutSchema = new mongoose.Schema({
  affiliateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Affiliate', required: true, index: true },
  amount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['Requested', 'Under Review', 'Approved', 'Paid', 'Rejected'], 
    default: 'Requested', 
    index: true 
  },
  paymentMethod: { type: String, enum: ['Bank Transfer', 'IBAN', 'PayPal', 'Wise'], required: true },
  transactionId: String,
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  paidDate: Date,
  notes: String,
  tenantId: { type: String, default: 'default', index: true } // SaaS multi-tenancy
}, { timestamps: true });

delete mongoose.models.AffiliatePayout;
export default mongoose.models.AffiliatePayout || mongoose.model('AffiliatePayout', AffiliatePayoutSchema);
