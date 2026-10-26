import { randomInt } from 'crypto';
import dbConnect from './db';
import AbandonedCart from '@/models/AbandonedCart';
import AbandonedCartEmailLog from '@/models/AbandonedCartEmailLog';
import Order from '@/models/Order';
import Discount from '@/models/Discount';
import { sendAbandonedCartEmail, isSmtpConfigured } from './email';
import { getAbandonedCartSettings, recordScanResult } from './abandonedCartSettings';

// Personalized one-time win-back codes are tagged so they are identifiable (and reusable if the
// same person abandons again before using their code).
const PERSONAL_VOUCHER_SOURCE = 'abandoned-cart';
const PERSONAL_VOUCHER_PERCENT = 15;
// The checkout autosaves while the shopper is still typing, so a half-typed address can be stored.
// Only plausible addresses are queued, so junk never sits at the front of the queue starving real carts.
const EMAIL_PATTERN = '^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$';
const EMAIL_REGEX = new RegExp(EMAIL_PATTERN);

// A failed send is retried with a back-off (minutes after the 1st, 2nd failure) and then given up on, so one
// bad address can never be hammered every scan (that would also hurt the sender's reputation).
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MINUTES = [5, 20];
// A send is "claimed" for this long. If the process dies mid-send (a restart, a crash) the claim simply runs out and
// the cart is picked up again, instead of being stuck as "sent" without an email ever going out.
const CLAIM_LEASE_MINUTES = 10;
// Problems that are NOT about this shopper's address (mail server down, wrong login, rate limit, no connection) never
// count against the 3 attempts: otherwise one short outage would give up every queued cart for good.
const TEMPORARY_BACKOFF_MINUTES = 30;
const TEMPORARY_ERROR_CODES = new Set(['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNRESET', 'ECONNREFUSED', 'EDNS', 'ENOTFOUND', 'EAUTH', 'ETLS']);

export function isTemporaryMailError(err) {
  if (!err) return false;
  if (/SMTP is not configured/i.test(String(err.message || ''))) return true;
  if (TEMPORARY_ERROR_CODES.has(err.code)) return true;
  const reply = Number(err.responseCode);
  return reply >= 400 && reply < 500; // SMTP 4xx means "try again later" (includes rate limits)
}

/** "Donald Spanton" -> "DONALD"; strips accents/symbols; falls back to the email prefix, then "WELCOME". */
export function personalCodeBase(cart, email) {
  const clean = (v) =>
    String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 12);
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

  // After the 25 tidy codes for a name (DONALD15, DONALD15A ... DONALD15Z) are taken, fall back to short random
  // suffixes (DONALD15K7, then three characters) so a common first name can never run out of codes.
  const RANDOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomSuffix = (length) => Array.from({ length }, () => RANDOM_ALPHABET[randomInt(RANDOM_ALPHABET.length)]).join('');
  const allSuffixes = [...suffixes, ...Array.from({ length: 30 }, () => randomSuffix(2)), ...Array.from({ length: 30 }, () => randomSuffix(3))];

  for (const suffix of allSuffixes) {
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
export async function getAbandonedCartDiagnostics({ windowMinutes, maxAgeHours } = {}) {
  await dbConnect();
  const settings = await getAbandonedCartSettings();
  const idle = windowMinutes ?? settings.idleMinutes;
  const maxAge = maxAgeHours ?? settings.maxAgeHours;
  const now = Date.now();
  const cutoff = new Date(now - idle * 60 * 1000);
  const oldest = new Date(now - maxAge * 60 * 60 * 1000);
  const active = { status: 'active', isDeleted: { $ne: true } };
  const queued = { ...active, 'recoveryEmail.sent': { $ne: true }, 'recoveryEmail.gaveUp': { $ne: true }, 'contact.email': { $regex: EMAIL_PATTERN } };

  const [total, recovered, noEmail, invalidEmail, alreadyEmailed, waiting, tooOld, eligible, gaveUp] = await Promise.all([
    AbandonedCart.countDocuments({ isDeleted: { $ne: true } }),
    AbandonedCart.countDocuments({ status: 'recovered', isDeleted: { $ne: true } }),
    AbandonedCart.countDocuments({ ...active, $or: [{ 'contact.email': { $exists: false } }, { 'contact.email': '' }] }),
    AbandonedCart.countDocuments({ ...active, 'contact.email': { $nin: ['', null], $not: { $regex: EMAIL_PATTERN } } }),
    AbandonedCart.countDocuments({ ...active, 'recoveryEmail.sent': true }),
    AbandonedCart.countDocuments({ ...queued, updatedAt: { $gt: cutoff } }),
    AbandonedCart.countDocuments({ ...queued, updatedAt: { $lt: oldest } }),
    AbandonedCart.countDocuments({ ...queued, updatedAt: { $lte: cutoff, $gte: oldest } }),
    AbandonedCart.countDocuments({ ...active, 'recoveryEmail.gaveUp': true }),
  ]);

  return {
    smtpConfigured: isSmtpConfigured(),
    enabled: settings.enabled,
    windowMinutes: idle,
    carts: { total, recovered, noEmail, invalidEmail, alreadyEmailed, waitingForQuietPeriod: waiting, olderThanMaxAge: tooOld, eligibleNow: eligible, gaveUp },
  };
}

// ─── activity log ───────────────────────────────────────────────────────────────────────────────

async function writeLog(entry) {
  try {
    await AbandonedCartEmailLog.create(entry);
  } catch (err) {
    console.error('[AbandonedCart] Could not write the activity log:', err.message);
  }
}

function cartSummary(cart) {
  const items = Array.isArray(cart.items) ? cart.items : [];
  return {
    cartId: cart._id,
    cartTotal: Number(cart.cartTotal) || 0,
    itemCount: items.reduce((n, i) => n + (Number(i.quantity) || 1), 0),
    itemNames: items.slice(0, 4).map((i) => String(i.name || '').slice(0, 80)).filter(Boolean),
    firstName: cart.contact?.firstName || String(cart.shippingAddress?.fullName || '').split(' ')[0] || '',
  };
}

// ─── sending ────────────────────────────────────────────────────────────────────────────────────

/**
 * Sends the recovery email for one cart and records the outcome (cart fields + activity log).
 * Every email carries the shopper's OWN one-time code, made from their name (e.g. DONALD15): never a shared code, so a
 * code can't be passed around or reused by someone else. `force` is for the admin's "Send now": it
 * ignores the quiet period and may re-send to a cart that was already emailed, but never to someone who ordered.
 */
async function processCart(cart, { trigger = 'scheduler', idleMinutes = null, staffId = null, force = false } = {}) {
  const email = cart.contact?.email?.trim();
  const base = { ...cartSummary(cart), email: email ? email.toLowerCase() : '', trigger, triggeredBy: staffId, idleMinutes };

  if (!email || !EMAIL_REGEX.test(email)) {
    if (force) await writeLog({ ...base, status: 'failed', reason: 'invalid-email', error: 'The cart has no valid email address.' });
    return { id: cart._id, email: email || null, sent: false, status: 'failed', reason: 'invalid-email' };
  }

  // Defensive re-check: even though `status` flips to 'recovered' when the same checkout session completes,
  // guard against a *different* completed order for the same email landing after the snapshot.
  const hasRecentOrder = await Order.exists({
    'customer.email': { $in: [...new Set([email, email.toLowerCase()])] }, // the order may have been placed with different capitals
    createdAt: { $gte: cart.createdAt },
  });
  if (hasRecentOrder) {
    await AbandonedCart.updateOne({ _id: cart._id }, { $set: { status: 'recovered', orderId: hasRecentOrder._id } }, { timestamps: false });
    await writeLog({ ...base, status: 'skipped', reason: 'order-exists' });
    return { id: cart._id, email, sent: false, status: 'skipped', reason: 'order-exists' };
  }

  // Atomic claim BEFORE sending: two overlapping scans would otherwise both send. Whoever sets `sendingSince` wins; the
  // claim runs out after CLAIM_LEASE_MINUTES, so a crash mid-send cannot leave the cart stuck. `sent` is only set once the
  // mail server has accepted the message. The claim also re-checks the cart is still live: it may have been trashed or
  // completed since the scan loaded it.
  const claimFilter = {
    _id: cart._id,
    status: 'active',
    isDeleted: { $ne: true },
    ...(force ? {} : { 'recoveryEmail.sent': { $ne: true } }),
    $or: [{ 'recoveryEmail.sendingSince': null }, { 'recoveryEmail.sendingSince': { $lt: new Date(Date.now() - CLAIM_LEASE_MINUTES * 60 * 1000) } }],
  };
  const claim = await AbandonedCart.updateOne(
    claimFilter,
    { $set: { 'recoveryEmail.sendingSince': new Date() } },
    { timestamps: false }
  );
  if (claim.matchedCount === 0) return { id: cart._id, email, sent: false, status: 'skipped', reason: 'already-claimed' };

  const previousAttempts = cart.recoveryEmail?.attempts || 0;
  const attempt = previousAttempts + 1;
  let voucher;
  let info;
  try {
    // Only the claim winner creates the personal code, so there are no orphan codes from lost races.
    voucher = await getOrCreatePersonalVoucher(cart, email);
    info = await sendAbandonedCartEmail(email, cart, voucher.code, { discountLabel: voucher.label, oneTime: !!voucher.oneTime });
  } catch (err) {
    const temporary = isTemporaryMailError(err);
    // Only problems with this shopper's address count towards giving up; an admin pressing "Send now" never gives up a cart.
    const countedAttempts = temporary ? previousAttempts : attempt;
    const gaveUp = !temporary && !force && attempt >= MAX_ATTEMPTS;
    const backoff = temporary ? TEMPORARY_BACKOFF_MINUTES : RETRY_BACKOFF_MINUTES[Math.min(attempt - 1, RETRY_BACKOFF_MINUTES.length - 1)];
    // timestamps:false: touching updatedAt would make the cart look "fresh" again and delay the retry.
    await AbandonedCart.updateOne(
      { _id: cart._id },
      {
        $set: {
          'recoveryEmail.sendingSince': null,
          'recoveryEmail.attempts': countedAttempts,
          'recoveryEmail.lastAttemptAt': new Date(),
          'recoveryEmail.lastError': String(err.message || err).slice(0, 300),
          'recoveryEmail.nextAttemptAt': gaveUp || force ? null : new Date(Date.now() + backoff * 60 * 1000),
          'recoveryEmail.gaveUp': gaveUp,
        },
      },
      { timestamps: false }
    ).catch(() => {});
    console.error(`[AbandonedCart] Failed to send recovery email for ${email} (attempt ${attempt}${temporary ? ', temporary problem' : ''}):`, err.message);
    await writeLog({ ...base, status: gaveUp ? 'gave-up' : 'failed', attempt, reason: temporary ? 'mail-server-problem' : 'send-error', error: String(err.message || err).slice(0, 500) });
    return { id: cart._id, email, sent: false, status: gaveUp ? 'gave-up' : 'failed', reason: 'error', error: err.message, temporary };
  }

  // The mail server has accepted the message. From here on a bookkeeping hiccup must never be treated as a failed send
  // (a retry would mail the shopper a second time): it is logged, and the email still counts as sent.
  try {
    await AbandonedCart.updateOne(
      { _id: cart._id },
      {
        $set: {
          'recoveryEmail.sent': true,
          'recoveryEmail.sentAt': new Date(),
          'recoveryEmail.sendingSince': null,
          'recoveryEmail.voucherCode': voucher.code,
          'recoveryEmail.messageId': info?.messageId || null,
          'recoveryEmail.attempts': attempt,
          'recoveryEmail.lastAttemptAt': new Date(),
          'recoveryEmail.nextAttemptAt': null,
          'recoveryEmail.lastError': null,
          'recoveryEmail.gaveUp': false,
        },
      },
      { timestamps: false }
    );
  } catch (err) {
    console.error(`[AbandonedCart] Email to ${email} was sent but the cart could not be updated:`, err.message);
  }
  await writeLog({
    ...base,
    status: 'sent',
    attempt,
    subject: info?.subject || '',
    voucherCode: voucher.code,
    voucherKind: 'personal',
    discountLabel: voucher.label || '',
    messageId: info?.messageId || '',
    smtpResponse: String(info?.response || '').slice(0, 300),
    accepted: (info?.accepted || []).map(String),
    rejected: (info?.rejected || []).map(String),
  });
  return { id: cart._id, email, sent: true, status: 'sent', voucherCode: voucher.code, personal: !!voucher.oneTime, messageId: info?.messageId || '' };
}

/**
 * Scans for checkout sessions that captured an email but never turned into an order within the idle time
 * (default 30 minutes, editable in the admin), and sends each the recovery email. Safe to call as often as you
 * like: carts that were handled are skipped. `trigger` says who started it (scheduler | cron | manual).
 * `filter` narrows the scan to matching carts (extra Mongo conditions; it can never widen the built-in ones).
 */
export async function sendAbandonedCartRecoveryEmails({ trigger = 'scheduler', windowMinutes, maxAgeHours, limit = 50, filter = {} } = {}) {
  await dbConnect();
  const settings = await getAbandonedCartSettings();

  if (!settings.enabled) {
    await recordScanResult({ trigger, scanned: 0, sent: 0, failed: 0, error: 'disabled in settings' });
    return { scanned: 0, sent: 0, failed: 0, skipped: 0, disabled: true, results: [] };
  }

  const idle = windowMinutes ?? settings.idleMinutes;
  const maxAge = maxAgeHours ?? settings.maxAgeHours;
  const now = Date.now();
  const cutoff = new Date(now - idle * 60 * 1000);
  const oldestEligible = new Date(now - maxAge * 60 * 60 * 1000);

  // Candidates: still "active", valid email, not emailed yet, quiet for at least the idle time, not ancient,
  // not trashed, not given up on, and past any retry back-off.
  const candidates = await AbandonedCart.find({
    ...filter,
    status: 'active',
    isDeleted: { $ne: true },
    'contact.email': { $regex: EMAIL_PATTERN },
    'recoveryEmail.sent': { $ne: true },
    'recoveryEmail.gaveUp': { $ne: true },
    $and: [
      { $or: [{ 'recoveryEmail.nextAttemptAt': null }, { 'recoveryEmail.nextAttemptAt': { $lte: new Date(now) } }] },
      // not being sent right now (a claim older than the lease belongs to a process that died)
      { $or: [{ 'recoveryEmail.sendingSince': null }, { 'recoveryEmail.sendingSince': { $lt: new Date(now - CLAIM_LEASE_MINUTES * 60 * 1000) } }] },
    ],
    updatedAt: { $lte: cutoff, $gte: oldestEligible },
  })
    .sort({ updatedAt: 1 })
    .limit(limit)
    .lean();

  const results = [];
  if (candidates.length > 0) {
    for (const cart of candidates) {
      try {
        results.push(await processCart(cart, { trigger, idleMinutes: idle }));
      } catch (err) {
        console.error('[AbandonedCart] Unexpected error while processing a cart:', err);
        results.push({ id: cart._id, email: cart.contact?.email || null, sent: false, status: 'failed', reason: 'error', error: err.message });
      }
    }
  }

  const sent = results.filter((r) => r.sent).length;
  const failed = results.filter((r) => r.status === 'failed' || r.status === 'gave-up').length;
  await recordScanResult({ trigger, scanned: candidates.length, sent, failed });
  return { scanned: candidates.length, sent, failed, skipped: candidates.length - sent - failed, results };
}

/** Admin "Send now" for one cart: ignores the quiet period; may re-send; never emails someone who already ordered. */
export async function sendRecoveryEmailNow(cartId, { staffId = null } = {}) {
  await dbConnect();
  const cart = await AbandonedCart.findOne({ _id: cartId, isDeleted: { $ne: true } }).lean();
  if (!cart) return { sent: false, status: 'failed', reason: 'not-found', error: 'Cart not found.' };
  if (cart.status === 'recovered') return { sent: false, status: 'skipped', reason: 'order-exists', error: 'This shopper already placed an order.' };
  const settings = await getAbandonedCartSettings();
  return processCart(cart, { trigger: 'manual', idleMinutes: settings.idleMinutes, staffId, force: true });
}

/**
 * Carts that have an email but have not been emailed yet, with how long until they are due. Carts the scheduler gave up on
 * are listed too (flagged), so an admin can still press "Send now" after the cause (a mail outage, a typo) is fixed.
 */
export async function getWaitingCarts({ limit = 50 } = {}) {
  await dbConnect();
  const settings = await getAbandonedCartSettings();
  const now = Date.now();
  const rows = await AbandonedCart.find({
    status: 'active',
    isDeleted: { $ne: true },
    'contact.email': { $regex: EMAIL_PATTERN },
    'recoveryEmail.sent': { $ne: true },
    updatedAt: { $gte: new Date(now - settings.maxAgeHours * 60 * 60 * 1000) },
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('contact shippingAddress items cartTotal updatedAt recoveryEmail')
    .lean();
  return rows.map((c) => {
    const idleMin = Math.floor((now - new Date(c.updatedAt).getTime()) / 60000);
    return {
      _id: c._id,
      email: c.contact?.email || '',
      name: c.shippingAddress?.fullName || c.contact?.firstName || '',
      cartTotal: c.cartTotal || 0,
      itemCount: (c.items || []).reduce((n, i) => n + (Number(i.quantity) || 1), 0),
      idleMinutes: idleMin,
      dueInMinutes: Math.max(0, settings.idleMinutes - idleMin),
      gaveUp: !!c.recoveryEmail?.gaveUp,
      attempts: c.recoveryEmail?.attempts || 0,
      lastError: c.recoveryEmail?.lastError || '',
    };
  });
}
