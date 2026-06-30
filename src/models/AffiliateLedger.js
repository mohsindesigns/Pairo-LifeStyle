import mongoose from 'mongoose';

const AffiliateLedgerSchema = new mongoose.Schema({
  affiliateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Affiliate', required: true, index: true },
  tenantId: { type: String, default: 'default', index: true },
  type: { type: String, enum: ['Credit', 'Debit'], required: true },
  amount: { type: Number, required: true },
  source: { type: String, enum: ['Commission', 'Payout', 'Reversal', 'Adjustment'], required: true },
  referenceModel: { type: String, enum: ['AffiliateCommission', 'AffiliatePayout'] },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  balanceBefore: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  description: String
}, { timestamps: true });

// Compound indexes for rapid month-end audits and dashboard queries
AffiliateLedgerSchema.index({ affiliateId: 1, createdAt: -1 });
AffiliateLedgerSchema.index({ tenantId: 1, source: 1 });

/**
 * Helper to record an immutable financial transaction and update the affiliate balance atomically.
 * Must run inside a session transaction when called inside one.
 */
AffiliateLedgerSchema.statics.record = async function({
  affiliateId,
  tenantId,
  type,
  amount,
  source,
  referenceModel,
  referenceId,
  description
}, session = null) {
  const Affiliate = mongoose.model('Affiliate');
  
  // Find current affiliate
  const query = Affiliate.findById(affiliateId);
  if (session) query.session(session);
  const affiliate = await query;
  if (!affiliate) throw new Error("Affiliate not found for ledger record.");

  const balanceBefore = affiliate.balance || 0;
  let balanceAfter = balanceBefore;

  const parsedAmount = Math.round(Number(amount) * 100) / 100;
  if (type === 'Credit') {
    balanceAfter = Math.round((balanceBefore + parsedAmount) * 100) / 100;
  } else if (type === 'Debit') {
    balanceAfter = Math.round((balanceBefore - parsedAmount) * 100) / 100;
  }

  // Create ledger entry
  const Ledger = this;
  const ledgerDoc = new Ledger({
    affiliateId,
    tenantId: tenantId || affiliate.tenantId || "default",
    type,
    amount: parsedAmount,
    source,
    referenceModel,
    referenceId,
    balanceBefore,
    balanceAfter,
    description
  });

  if (session) {
    await ledgerDoc.save({ session });
  } else {
    await ledgerDoc.save();
  }

  // Update affiliate balance
  affiliate.balance = balanceAfter;
  if (type === 'Credit' && source === 'Commission') {
    affiliate.lifetimeEarnings = Math.round(((affiliate.lifetimeEarnings || 0) + parsedAmount) * 100) / 100;
  }

  if (session) {
    await affiliate.save({ session });
  } else {
    await affiliate.save();
  }

  return ledgerDoc;
};

// Enforce immutability using middleware hooks to prevent any alterations or deletions
const preventMutation = function() {
  throw new Error("Ledger entries are immutable and cannot be updated or deleted.");
};

AffiliateLedgerSchema.pre('updateOne', preventMutation);
AffiliateLedgerSchema.pre('updateMany', preventMutation);
AffiliateLedgerSchema.pre('findOneAndUpdate', preventMutation);
AffiliateLedgerSchema.pre('deleteOne', preventMutation);
AffiliateLedgerSchema.pre('deleteMany', preventMutation);
AffiliateLedgerSchema.pre('findOneAndDelete', preventMutation);
AffiliateLedgerSchema.pre('remove', preventMutation);

delete mongoose.models.AffiliateLedger;
export default mongoose.models.AffiliateLedger || mongoose.model('AffiliateLedger', AffiliateLedgerSchema);
