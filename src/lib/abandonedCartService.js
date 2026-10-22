import dbConnect from './db';
import AbandonedCart from '@/models/AbandonedCart';
import Order from '@/models/Order';
import Promotion from '@/models/Promotion';
import Discount from '@/models/Discount';
import { sendAbandonedCartEmail, isSmtpConfigured } from './email';

// Personalized one-time win-back codes are tagged so they are identifiable (and reusable if the
// same person abandons again before using their code).
const PERSONAL_VOUCHER_SOURCE = 'abandoned-cart';
const PERSONAL_VOUCHER_PERCENT = 15;
// The checkout autosaves while the shopper is still typing, so a half-typed address can be stored.
// Only plausible addresses are queued, so junk never sits at the front of the queue starving real carts.
const EMAIL_PATTERN = '^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$';

const activeWindow = (now) => ({
  $and: [
    { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
    { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] },
  ],
});

/**
 * Finds an ONGOING campaign code to feature in abandoned-cart emails: an active, currently-running,
 * sitewide (no product/category/customer/minimum-spend restriction), publicly shareable code.
 * Looks at the promotion engine first, then the simple Coupons list. Returns
 * { code, label } (label like "10% off" / "$5 off") or null when no campaign is running.
 * Never returns a restricted code: it could reach a customer it silently will not apply to.
 */
export async function findOngoingCampaignVoucher() {
  await dbConnect();
  const now = new Date();

  // 1. Promotion-engine codes. "No conditions" is judged in JS (the rule tree is a flexible Mixed shape).
  const promos = await Promotion.find({
    adminStatus: 'Active',
    code: { $exists: true, $type: 'string', $ne: '' },
    actions: { $elemMatch: { type: 'percentage_discount', target: 'cart' } },
    ...activeWindow(now),
  }).limit(25).lean();
  const promo = promos.find((p) => !p.conditions || Object.keys(p.conditions).length === 0);
  if (promo?.code) {
    const action = (promo.actions || []).find((a) => a.type === 'percentage_discount' && a.target === 'cart');
    return { code: promo.code, label: action?.value ? `${Number(action.value)}% off` : 'a discount' };
  }

  // 2. Simple coupons: active, in date, not exhausted, open to everyone, no restrictions.
  const coupons = await Discount.find({
    isActive: true,
    isDeleted: { $ne: true },
    source: { $ne: PERSONAL_VOUCHER_SOURCE },
    ...activeWindow(now),
  }).limit(50).lean();
  const coupon = coupons.find((c) =>
    !(c.specificCustomers?.length) && !(c.specificCustomerEmails?.length) &&
    !(c.specificProducts?.length) && !(c.specificCategories?.length) &&
    !c.userRegistrationRequired && !c.newsletterSubscribedOnly && !c.firstOrderOnly &&
    !c.oneRedemptionPerDevice && !(c.minPurchase > 0) && !(c.minQuantity > 0) && !c.excludeSaleItems &&
    (!c.usageLimit || (c.usageCount || 0) < c.usageLimit)
  );
  if (coupon?.code) {
    return {
      code: coupon.code,
      label: coupon.type === 'percentage' ? `${Number(coupon.value)}% off` : `$${Number(coupon.value)} off`,
    };
  }

  return null;
}

/** "Donald Spanton" -> "DONALD"; strips accents/symbols; falls back to the email prefix, then "WELCOME". */
export function personalCodeBase(cart, email) {
  const clean = (v) =>
    String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 12);
  const fullName = cart?.shippingAddress?.fullName || '';
  return (
    clean(cart?.contact?.firstName) ||
    clean(fullName.trim().split(/\s+/)[0]) ||
    clean(String(email || '').split('@')[0]) ||
    'WELCOME'
  );
}

/**
 * Creates (or reuses) a personalized, single-use code for this customer, e.g. DONALD15.
 * Locked to their email, 1 use total. If they abandon again before using it, the same unused code
 * is reused instead of minting another. Name clashes (another Donald) get a letter suffix.
 */
export async function getOrCreatePersonalVoucher(cart, email) {
  await dbConnect();
  const normalizedEmail = String(email).toLowerCase().trim();

  const existing = await Discount.findOne({
    source: PERSONAL_VOUCHER_SOURCE,
    specificCustomerEmails: normalizedEmail,
    isActive: true,
    isDeleted: { $ne: true },
    usageCount: { $lt: 1 },
  }).lean();
  if (existing?.code) return { code: existing.code, label: `${PERSONAL_VOUCHER_PERCENT}% off`, oneTime: true };

  const base = `${personalCodeBase(cart, normalizedEmail)}${PERSONAL_VOUCHER_PERCENT}`;
  const suffixes = ['', ...'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('')];

  for (const suffix of suffixes) {
    const code = base + suffix;
    try {
      await Discount.create({
        code,
        type: 'percentage',
        value: PERSONAL_VOUCHER_PERCENT,
        usageLimit: 1,
        usagePerUserLimit: 1,
        specificCustomerEmails: [normalizedEmail],
        // Customer-specific codes cannot be represented in Stripe; local-only like the admin ones.
        stripeSyncStatus: 'unsupported',
        source: PERSONAL_VOUCHER_SOURCE,
        isActive: true,
      });
      return { code, label: `${PERSONAL_VOUCHER_PERCENT}% off`, oneTime: true };
    } catch (err) {
      if (err?.code === 11000) continue; // code already taken (unique index) - try the next suffix
      throw err;
    }
  }
  throw new Error(`Could not allocate a personal voucher code for ${normalizedEmail}`);
}

/**
 * Explains WHY carts are or are not getting emails: counts every cart by the reason it is
 * excluded from (or included in) the next run. Returned by the cron endpoint so a "nothing
 * arrived" report can be diagnosed in one call instead of guessing.
 */
export async function getAbandonedCartDiagnostics({ windowMinutes = 60, maxAgeHours = 72 } = {}) {
  await dbConnect();
  const now = Date.now();
  const cutoff = new Date(now - windowMinutes * 60 * 1000);
  const oldest = new Date(now - maxAgeHours * 60 * 60 * 1000);
  const active = { status: 'active' };
  const queued = { ...active, 'recoveryEmail.sent': { $ne: true }, 'contact.email': { $regex: EMAIL_PATTERN } };

  const [total, recovered, noEmail, invalidEmail, alreadyEmailed, waiting, tooOld, eligible] = await Promise.all([
    AbandonedCart.countDocuments({}),
    AbandonedCart.countDocuments({ status: 'recovered' }),
    AbandonedCart.countDocuments({ ...active, $or: [{ 'contact.email': { $exists: false } }, { 'contact.email': '' }] }),
    AbandonedCart.countDocuments({ ...active, 'contact.email': { $nin: ['', null], $not: { $regex: EMAIL_PATTERN } } }),
    AbandonedCart.countDocuments({ ...active, 'recoveryEmail.sent': true }),
    AbandonedCart.countDocuments({ ...queued, updatedAt: { $gt: cutoff } }),
    AbandonedCart.countDocuments({ ...queued, updatedAt: { $lt: oldest } }),
    AbandonedCart.countDocuments({ ...queued, updatedAt: { $lte: cutoff, $gte: oldest } }),
  ]);

  return {
    smtpConfigured: isSmtpConfigured(),
    windowMinutes,
    carts: { total, recovered, noEmail, invalidEmail, alreadyEmailed, waitingForQuietPeriod: waiting, olderThanMaxAge: tooOld, eligibleNow: eligible },
  };
}

/**
 * Scans for checkout sessions that captured an email but never turned into an order within
 * `windowMinutes`, and have not already received a recovery email, then sends each one the
 * abandoned-cart voucher email. Designed to be called repeatedly (e.g. every 15-30 min via a
 * cron-hit HTTP endpoint) — already-handled carts are skipped via the `recoveryEmail.sent` flag,
 * so re-running it is always safe.
 */
export async function sendAbandonedCartRecoveryEmails({ windowMinutes = 60, maxAgeHours = 72, limit = 50 } = {}) {
  await dbConnect();

  const now = Date.now();
  const cutoff = new Date(now - windowMinutes * 60 * 1000);
  const oldestEligible = new Date(now - maxAgeHours * 60 * 60 * 1000);

  // Candidates: still "active" (never turned into an order via this exact checkout session),
  // have an email, haven't been emailed yet, went quiet at least `windowMinutes` ago, and
  // aren't ancient (avoid resurrecting month-old test/junk rows if the cron was down a while).
  const candidates = await AbandonedCart.find({
    status: 'active',
    'contact.email': { $regex: EMAIL_PATTERN },
    'recoveryEmail.sent': { $ne: true },
    updatedAt: { $lte: cutoff, $gte: oldestEligible },
  })
    .sort({ updatedAt: 1 })
    .limit(limit)
    .lean();

  if (candidates.length === 0) {
    return { scanned: 0, sent: 0, skipped: 0, results: [] };
  }

  const results = [];
  // An ongoing campaign is the same for every cart, so look it up once. When none is running,
  // each customer gets their own personalized one-time code instead (created per cart below).
  const campaign = await findOngoingCampaignVoucher();

  for (const cart of candidates) {
    const email = cart.contact?.email?.trim();
    if (!email) {
      results.push({ id: cart._id, email: null, sent: false, reason: 'no-email' });
      continue;
    }

    let claimed = false;
    try {
      // Defensive re-check: even though `status` flips to 'recovered' when the same checkout
      // session completes, guard against the (rare) case of a *different* completed order for
      // the same email landing after the snapshot but before this cron run.
      const hasRecentOrder = await Order.exists({
        'customer.email': email,
        createdAt: { $gte: cart.createdAt },
      });
      if (hasRecentOrder) {
        await AbandonedCart.updateOne({ _id: cart._id }, { $set: { status: 'recovered', orderId: hasRecentOrder._id } });
        results.push({ id: cart._id, email, sent: false, reason: 'order-exists' });
        continue;
      }

      // Atomic claim BEFORE sending — two overlapping cron runs reading the same unclaimed cart
      // would otherwise both pass the `recoveryEmail.sent !== true` filter above and both send.
      // Whichever update actually flips `sent` from not-true to true (matchedCount === 1) wins;
      // the loser skips. If the send itself then fails, the claim is reverted below so a later
      // run retries it instead of leaving it permanently (falsely) marked as sent.
      const claimResult = await AbandonedCart.updateOne(
        { _id: cart._id, 'recoveryEmail.sent': { $ne: true } },
        { $set: { 'recoveryEmail.sent': true, 'recoveryEmail.sentAt': new Date() } },
        { timestamps: false }
      );
      if (claimResult.matchedCount === 0) {
        results.push({ id: cart._id, email, sent: false, reason: 'already-claimed' });
        continue;
      }
      claimed = true;

      // Only the claim winner creates a personal code, so there are no orphan codes from lost races.
      const voucher = campaign || (await getOrCreatePersonalVoucher(cart, email));
      await AbandonedCart.updateOne({ _id: cart._id }, { $set: { 'recoveryEmail.voucherCode': voucher.code } }, { timestamps: false });

      await sendAbandonedCartEmail(email, cart, voucher.code, {
        discountLabel: voucher.label,
        oneTime: !!voucher.oneTime,
      });

      results.push({ id: cart._id, email, sent: true, voucherCode: voucher.code, personal: !!voucher.oneTime });
    } catch (err) {
      if (claimed) {
        // timestamps:false — touching updatedAt here would make the cart look "fresh" again and delay the retry by a full quiet window.
        await AbandonedCart.updateOne({ _id: cart._id }, { $set: { 'recoveryEmail.sent': false } }, { timestamps: false }).catch(() => {});
      }
      console.error(`[AbandonedCart] Failed to send recovery email for ${email}:`, err.message);
      results.push({ id: cart._id, email, sent: false, reason: 'error', error: err.message });
    }
  }

  const sent = results.filter((r) => r.sent).length;
  return { scanned: candidates.length, sent, skipped: candidates.length - sent, results };
}
