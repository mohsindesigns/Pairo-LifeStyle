import dbConnect from "../db.js";
import Affiliate from "../../models/Affiliate.js";
import AffiliateCommission from "../../models/AffiliateCommission.js";
import AffiliateSettings from "../../models/AffiliateSettings.js";
import AffiliateLedger from "../../models/AffiliateLedger.js";
import mongoose from "mongoose";

export class CommissionEngine {
  /**
   * Calculate and save a pending commission for an order.
   * Runs inside the database session when called during checkout transaction.
   */
  static async calculateCommission(order, affiliate, session = null) {
    await dbConnect();
    
    // 1. Get global settings for snapshot fallback
    let settings = await AffiliateSettings.findOne();
    if (session) settings = await AffiliateSettings.findOne().session(session);
    
    if (!settings) {
      settings = { defaultCommissionRate: 5, minimumPayoutAmount: 50 };
    }

    const rate = affiliate.commissionRate !== undefined && affiliate.commissionRate !== null
      ? affiliate.commissionRate
      : (settings.defaultCommissionRate || 5);

    // subtotal from order financials
    const subtotal = order.financials?.subtotal || 0;
    const commissionAmount = Math.round((subtotal * (rate / 100)) * 100) / 100; // Round to 2 decimal places

    // Build the snapshot for absolute historical persistence
    const productPrices = (order.items || []).map(item => ({
      productId: item.productId,
      name: item.name,
      price: item.priceAtPurchase,
      quantity: item.quantity
    }));

    const commissionData = {
      affiliateId: affiliate._id,
      orderId: order._id,
      orderNumber: order.orderNumber,
      subtotal,
      commissionAmount,
      status: 'Pending',
      tenantId: affiliate.tenantId || 'default',
      snapshot: {
        commissionRate: rate,
        productPrices,
        discountTotal: order.financials?.discountTotal || 0,
        shippingCost: order.financials?.shippingCost || 0,
        tax: order.financials?.tax || 0,
        globalSettingsSnapshot: settings
      }
    };

    let commission;
    if (session) {
      [commission] = await AffiliateCommission.create([commissionData], { session });
    } else {
      commission = await AffiliateCommission.create(commissionData);
    }

    console.log(`[CommissionEngine] Calculated pending commission of $${commissionAmount} for order #${order.orderNumber} (Affiliate: ${affiliate.referralCode})`);
    return commission;
  }

  /**
   * Approve a pending commission, transferring amount to the affiliate's balance via the immutable Ledger
   */
  static async approveCommission(commissionId, session = null) {
    await dbConnect();
    
    const query = AffiliateCommission.findById(commissionId);
    if (session) query.session(session);
    const commission = await query;
    
    if (!commission) throw new Error("Commission not found");

    if (commission.status !== 'Pending') {
      console.log(`[CommissionEngine] Commission ${commissionId} is already in state: ${commission.status}. Skipping approval.`);
      return commission;
    }

    commission.status = 'Approved';
    if (session) {
      await commission.save({ session });
    } else {
      await commission.save();
    }

    // Record Credit in the Immutable Financial Ledger (updating Affiliate balance atomically)
    await AffiliateLedger.record({
      affiliateId: commission.affiliateId,
      tenantId: commission.tenantId,
      type: 'Credit',
      amount: commission.commissionAmount,
      source: 'Commission',
      referenceModel: 'AffiliateCommission',
      referenceId: commission._id,
      description: `Commission approved for order #${commission.orderNumber}`
    }, session);

    console.log(`[CommissionEngine] Approved commission of $${commission.commissionAmount} for affiliate: ${commission.affiliateId}`);
    return commission;
  }

  /**
   * Reverse an approved commission (supports pro-rata partial reversals on partial refunds)
   */
  static async reverseCommission(orderId, reason = "Refunded", refundAmount = null, session = null) {
    await dbConnect();
    
    const query = AffiliateCommission.find({ orderId, status: 'Approved' });
    if (session) query.session(session);
    const commissions = await query;
    
    for (const commission of commissions) {
      const affiliateQuery = Affiliate.findById(commission.affiliateId);
      if (session) affiliateQuery.session(session);
      const affiliate = await affiliateQuery;
      if (!affiliate) continue;

      if (refundAmount !== null && refundAmount > 0) {
        // Calculate the ratio of the refund relative to the order subtotal
        const originalSubtotal = commission.subtotal || 1;
        const refundRatio = Math.min(1, Number(refundAmount) / originalSubtotal);
        const reversalAmount = Math.round((commission.commissionAmount * refundRatio) * 100) / 100;

        if (reversalAmount <= 0) continue;

        // Record a Debit in the Immutable Ledger (deducts from balance)
        await AffiliateLedger.record({
          affiliateId: affiliate._id,
          tenantId: commission.tenantId || affiliate.tenantId,
          type: 'Debit',
          amount: reversalAmount,
          source: 'Reversal',
          referenceModel: 'AffiliateCommission',
          referenceId: commission._id,
          description: `Partial reversal of $${reversalAmount} due to partial refund of $${refundAmount} (Order #${commission.orderNumber})`
        }, session);

        console.log(`[CommissionEngine] Partially reversed commission of $${reversalAmount} for affiliate ${affiliate.referralCode}. Refund amount: $${refundAmount}`);
      } else {
        // Full reversal
        commission.status = 'Reversed';
        if (session) {
          await commission.save({ session });
        } else {
          await commission.save();
        }

        // Record full Debit reversal in ledger
        await AffiliateLedger.record({
          affiliateId: affiliate._id,
          tenantId: commission.tenantId || affiliate.tenantId,
          type: 'Debit',
          amount: commission.commissionAmount,
          source: 'Reversal',
          referenceModel: 'AffiliateCommission',
          referenceId: commission._id,
          description: `Full commission reversal for order #${commission.orderNumber}`
        }, session);

        console.log(`[CommissionEngine] Fully reversed commission of $${commission.commissionAmount} for affiliate ${affiliate.referralCode}`);
      }
    }
  }

  /**
   * Cancel a pending commission (e.g. order cancelled before delivery)
   */
  static async cancelCommission(orderId, session = null) {
    await dbConnect();
    const query = { orderId, status: 'Pending' };
    const update = { $set: { status: 'Cancelled' } };
    
    let result;
    if (session) {
      result = await AffiliateCommission.updateMany(query, update).session(session);
    } else {
      result = await AffiliateCommission.updateMany(query, update);
    }
    
    console.log(`[CommissionEngine] Cancelled ${result.modifiedCount} pending commissions for orderId: ${orderId}`);
  }
}
