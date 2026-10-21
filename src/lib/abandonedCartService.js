import dbConnect from './db';
import AbandonedCart from '@/models/AbandonedCart';
import Order from '@/models/Order';
import Promotion from '@/models/Promotion';
import { sendAbandonedCartEmail } from './email';

// Recognizable marker so we reuse the same auto-generated voucher every time instead of
// minting a new code on every cron run. Checked against `code` first (fast, indexed) and
// `description` as a fallback in case an admin renamed the code but kept the marker text.
const AUTO_VOUCHER_CODE = 'COMEBACK15';
const AUTO_VOUCHER_MARKER = 'auto-abandoned-cart-voucher';
const AUTO_VOUCHER_DISCOUNT_PERCENT = 15;

/**
 * Finds a reusable active sitewide percentage-discount coupon code to feature in abandoned-cart
 * emails, preferring our own auto-generated voucher (tagged with AUTO_VOUCHER_MARKER) over any
 * other active sitewide percentage-discount code so that we never spam new codes. Creates the
 * auto voucher once, the first time none exists, then reuses it forever after (until an admin
 * pauses/archives it, at which point a fresh one is created).
 */
export async function getOrCreateAbandonedCartVoucher() {
  await dbConnect();

  const now = new Date();
  const notExpired = {
    $and: [
      { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] },
    ],
  };

  // 1. Our own previously-created auto voucher, if still active.
  const existingAuto = await Promotion.findOne({
    adminStatus: 'Active',
    $or: [{ code: AUTO_VOUCHER_CODE }, { description: { $regex: AUTO_VOUCHER_MARKER, $options: 'i' } }],
    ...notExpired,
  }).lean();
  if (existingAuto?.code) return existingAuto.code;

  // 2. Any other active, sitewide (no product/category/collection targeting, no minimum-cart-value
  //    or other eligibility rule), code-based, percentage_discount-on-cart promotion an admin
  //    already has running — reuse it rather than creating a redundant second sitewide code.
  //    Mongo can't reliably query "conditions object is empty" given the Mixed/flexible shape
  //    (an admin-built rule tree can represent "no conditions" several ways), so candidates are
  //    fetched and filtered in JS using the exact same emptiness check ConditionEvaluator uses
  //    ("no conditions" = eligible by default) — a conditionally-restricted code (e.g. minimum
  //    cart value, category-only) must never be picked here, since it could reach a customer it
  //    silently won't apply to.
  const sitewideCandidates = await Promotion.find({
    adminStatus: 'Active',
    code: { $exists: true, $type: 'string', $ne: '' },
    actions: {
      $elemMatch: { type: 'percentage_discount', target: 'cart' },
    },
    ...notExpired,
  }).limit(25).lean();
  const existingSitewide = sitewideCandidates.find(
    (p) => !p.conditions || Object.keys(p.conditions).length === 0
  );
  if (existingSitewide?.code) return existingSitewide.code;

  // 3. Nothing suitable exists — create our own 15%-off sitewide voucher and reuse it from now on.
  try {
    const created = await Promotion.create({
      title: 'Abandoned Cart Win-Back (Auto)',
      description: `Automatically created and reused by the ${AUTO_VOUCHER_MARKER} system. Do not delete — abandoned-cart recovery emails reference this code. Safe to pause/archive; a new one will be created automatically if needed.`,
      code: AUTO_VOUCHER_CODE,
      isAutomatic: false,
      adminStatus: 'Active',
      priority: 0,
      stackable: false,
      exclusive: false,
      conditions: {},
      actions: [{ type: 'percentage_discount', target: 'cart', value: AUTO_VOUCHER_DISCOUNT_PERCENT }],
      // Schema defaults: unlimited total uses, 1 use per customer — fine for a shared sitewide code.
    });
    return created.code;
  } catch (err) {
    // Two overlapping cron runs can both reach step 3 before either commits — the unique
    // index on `code` rejects the loser. That's fine: the winner's voucher already exists,
    // so just look it up instead of failing this cart's recovery email.
    if (err?.code === 11000) {
      const winner = await Promotion.findOne({ code: AUTO_VOUCHER_CODE }).lean();
      if (winner?.code) return winner.code;
    }
    throw err;
  }
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
    'contact.email': { $exists: true, $ne: '' },
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
  // Resolved once up-front (not lazily per-cart) so the atomic claim below can stamp the real
  // code at claim time, before the email is actually sent.
  const voucherCode = await getOrCreateAbandonedCartVoucher();

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
        { $set: { 'recoveryEmail.sent': true, 'recoveryEmail.sentAt': new Date(), 'recoveryEmail.voucherCode': voucherCode } }
      );
      if (claimResult.matchedCount === 0) {
        results.push({ id: cart._id, email, sent: false, reason: 'already-claimed' });
        continue;
      }
      claimed = true;

      await sendAbandonedCartEmail(email, cart, voucherCode, { discountPercent: AUTO_VOUCHER_DISCOUNT_PERCENT });

      results.push({ id: cart._id, email, sent: true, voucherCode });
    } catch (err) {
      if (claimed) {
        await AbandonedCart.updateOne({ _id: cart._id }, { $set: { 'recoveryEmail.sent': false } }).catch(() => {});
      }
      console.error(`[AbandonedCart] Failed to send recovery email for ${email}:`, err.message);
      results.push({ id: cart._id, email, sent: false, reason: 'error', error: err.message });
    }
  }

  const sent = results.filter((r) => r.sent).length;
  return { scanned: candidates.length, sent, skipped: candidates.length - sent, results };
}
