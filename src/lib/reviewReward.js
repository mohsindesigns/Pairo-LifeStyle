import dbConnect from './db';
import Order from '@/models/Order';
import Review from '@/models/Review';
import { getOrCreatePersonalVoucher } from './abandonedCartService';
import { sendReviewRewardEmail } from './email';

const REWARD_PERCENT = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function skip(review, note) {
  review.reward = { ...(review.reward?.toObject?.() || review.reward || {}), note };
  await review.save();
  return { rewarded: false, note };
}

/**
 * When a review that contains a video has just been approved, emails the customer a personal one-time 10% code (once per
 * customer, and only for customers with a delivered order). Never throws: approval must not depend on this.
 */
export async function maybeRewardVideoReview(review) {
  try {
    if (!review || review.status !== 'Approved') return { rewarded: false };
    if (!(review.media || []).some((m) => m.type === 'video')) return { rewarded: false };
    if (review.reward?.code) return { rewarded: false, note: 'already rewarded' };
    const email = String(review.customerEmail || '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) return skip(review, 'no valid email address');

    await dbConnect();
    const emailRx = new RegExp(`^${escapeRegex(email)}$`, 'i');
    const delivered = await Order.exists({ 'customer.email': emailRx, status: 'Delivered', isDeleted: { $ne: true } });
    if (!delivered) return skip(review, 'no delivered order for this email');

    const earlier = await Review.exists({ _id: { $ne: review._id }, customerEmail: emailRx, 'reward.code': { $exists: true, $ne: null } });
    if (earlier) return skip(review, 'already rewarded');

    const firstName = String(review.customerName || '').trim().split(/\s+/)[0] || '';
    const voucher = await getOrCreatePersonalVoucher({ contact: { firstName } }, email, { percent: REWARD_PERCENT, source: 'review-reward' });
    try {
      const info = await sendReviewRewardEmail(email, firstName, voucher.code, REWARD_PERCENT);
      review.reward = { code: voucher.code, percent: REWARD_PERCENT, sentAt: new Date(), messageId: info?.messageId || '' };
      await review.save();
      return { rewarded: true, code: voucher.code };
    } catch (err) {
      console.error('[ReviewReward] Email failed:', err.message);
      return skip(review, `email could not be sent: ${String(err.message).slice(0, 120)}`);
    }
  } catch (err) {
    console.error('[ReviewReward] Unexpected error:', err);
    return { rewarded: false, error: err.message };
  }
}
