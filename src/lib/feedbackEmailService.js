import dbConnect from './db';
import Order from '@/models/Order';
import FeedbackEmailLog from '@/models/FeedbackEmailLog';
import { sendFeedbackRequestEmail, isSmtpConfigured } from './email';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CLAIM_LEASE_MS = 10 * 60 * 1000;
const PAUSE_MS = 1000;

const normalize = (e) => String(e || '').trim().toLowerCase();
const firstNameOf = (order) => String(order?.shippingAddress?.fullName || '').trim().split(' ')[0] || '';

/**
 * Who still has to be asked: one entry per customer email (case-insensitive, newest delivered order), for delivered,
 * non-trashed orders with a valid address, skipping anyone who already got the email for ANY of their orders.
 */
export async function getFeedbackAudience() {
  await dbConnect();
  const delivered = await Order.find({ status: 'Delivered', isDeleted: { $ne: true } })
    .select('orderNumber customer.email shippingAddress.fullName items.productId items.name feedbackEmail createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const byEmail = new Map();
  for (const o of delivered) {
    const email = normalize(o.customer?.email);
    if (!EMAIL_REGEX.test(email)) continue;
    const entry = byEmail.get(email) || { email, newest: o, emailed: false, failed: false };
    if (o.feedbackEmail?.sentAt) entry.emailed = true;
    else if (o.feedbackEmail?.lastError) entry.failed = true;
    byEmail.set(email, entry);
  }
  const all = [...byEmail.values()];
  const pending = all.filter((e) => !e.emailed).map((e) => ({ email: e.email, order: e.newest }));
  return {
    pending,
    counts: {
      deliveredCustomers: all.length,
      alreadyEmailed: all.filter((e) => e.emailed).length,
      pending: pending.length,
      failed: all.filter((e) => !e.emailed && e.failed).length,
    },
  };
}

/** Sends the feedback request for one order. Claims it atomically first; sets sentAt only after the mail server accepted. */
export async function sendFeedbackEmailToOrder(order, { staffId = null, trigger = 'manual' } = {}) {
  await dbConnect();
  const email = normalize(order?.customer?.email);
  const base = { orderId: order._id, orderNumber: order.orderNumber || '', email, firstName: firstNameOf(order), trigger, triggeredBy: staffId };
  if (!EMAIL_REGEX.test(email)) return { sent: false, reason: 'invalid-email' };

  const claim = await Order.updateOne(
    {
      _id: order._id,
      'feedbackEmail.sentAt': null,
      $or: [{ 'feedbackEmail.sendingSince': null }, { 'feedbackEmail.sendingSince': { $lt: new Date(Date.now() - CLAIM_LEASE_MS) } }],
    },
    { $set: { 'feedbackEmail.sendingSince': new Date() } },
    { timestamps: false }
  );
  if (claim.matchedCount === 0) return { sent: false, reason: 'already-sent-or-claimed' };

  try {
    const info = await sendFeedbackRequestEmail(order, { to: email });
    await Order.updateOne(
      { _id: order._id },
      { $set: { 'feedbackEmail.sentAt': new Date(), 'feedbackEmail.messageId': info?.messageId || '', 'feedbackEmail.lastError': null, 'feedbackEmail.lastAttemptAt': new Date(), 'feedbackEmail.sendingSince': null } },
      { timestamps: false }
    );
    await FeedbackEmailLog.create({ ...base, status: 'sent', messageId: info?.messageId || '' }).catch(() => {});
    return { sent: true };
  } catch (err) {
    const message = String(err.message || err).slice(0, 300);
    await Order.updateOne(
      { _id: order._id },
      { $set: { 'feedbackEmail.lastError': message, 'feedbackEmail.lastAttemptAt': new Date(), 'feedbackEmail.sendingSince': null } },
      { timestamps: false }
    ).catch(() => {});
    await FeedbackEmailLog.create({ ...base, status: 'failed', error: message }).catch(() => {});
    return { sent: false, reason: 'error', error: message };
  }
}

const progress = () => (globalThis.__pairoFeedbackCampaign ||= { running: false, total: 0, done: 0, failed: 0 });
export const getCampaignProgress = () => ({ ...progress() });

/** Starts the campaign in the background and returns at once. Only one can run at a time. */
export async function startFeedbackCampaign({ staffId = null, pauseMs = PAUSE_MS } = {}) {
  const p = progress();
  if (p.running) return { started: false, reason: 'already-running', progress: { ...p } };
  p.running = true; // claimed before the first await, so two quick clicks cannot start two runs
  let pending;
  try {
    ({ pending } = await getFeedbackAudience());
  } catch (err) {
    p.running = false;
    throw err;
  }
  Object.assign(p, { total: pending.length, done: 0, failed: 0 });
  (async () => {
    try {
      for (const { order } of pending) {
        const r = await sendFeedbackEmailToOrder(order, { staffId, trigger: 'manual' }).catch((e) => ({ sent: false, error: e.message }));
        p.done += 1;
        if (!r.sent && r.reason !== 'already-sent-or-claimed') p.failed += 1;
        if (pauseMs) await new Promise((resolve) => setTimeout(resolve, pauseMs));
      }
    } finally {
      p.running = false;
    }
  })();
  return { started: true, progress: { ...p } };
}

/** Sends a sample to `toEmail` (latest delivered order's details, or a sample) and marks nothing. */
export async function sendFeedbackTest(toEmail, staffId = null) {
  await dbConnect();
  const email = normalize(toEmail);
  if (!EMAIL_REGEX.test(email)) return { sent: false, error: 'Enter a valid email address.' };
  const latest = await Order.findOne({ status: 'Delivered', isDeleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .select('orderNumber shippingAddress.fullName items.productId items.name')
    .lean();
  const sample = latest || { orderNumber: 'PAI-1001', shippingAddress: { fullName: 'Alex Sample' }, items: [] };
  try {
    const info = await sendFeedbackRequestEmail(sample, { to: email });
    await FeedbackEmailLog.create({ orderId: latest?._id, orderNumber: sample.orderNumber, email, firstName: firstNameOf(sample), status: 'test', trigger: 'test', triggeredBy: staffId, messageId: info?.messageId || '' }).catch(() => {});
    return { sent: true };
  } catch (err) {
    return { sent: false, error: String(err.message || err).slice(0, 300) };
  }
}

export async function getRecentFeedbackLog(limit = 25) {
  await dbConnect();
  return FeedbackEmailLog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
}

export { isSmtpConfigured };
