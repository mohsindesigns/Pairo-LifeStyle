// Settings for the abandoned-cart recovery emails, stored in SiteConfig.commerce.abandonedCart and edited in
// Admin > Orders > Abandoned Carts > Recovery emails. Defaults apply until someone saves the form.

import dbConnect from '@/lib/db';
import SiteConfig from '@/models/SiteConfig';

export const ABANDONED_CART_DEFAULTS = Object.freeze({
  enabled: true,
  idleMinutes: 30,      // quiet time before a checkout counts as abandoned and is emailed
  maxAgeHours: 72,      // carts older than this are never emailed (avoids waking up stale junk)
});

export const IDLE_MINUTES_RANGE = { min: 5, max: 1440 };
export const MAX_AGE_HOURS_RANGE = { min: 1, max: 720 };

const clamp = (v, min, max, fallback) => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Lenient: any stored value becomes complete, in-range settings. */
export function normalizeAbandonedCartSettings(input) {
  const src = input && typeof input === 'object' ? input : {};
  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : ABANDONED_CART_DEFAULTS.enabled,
    idleMinutes: clamp(src.idleMinutes, IDLE_MINUTES_RANGE.min, IDLE_MINUTES_RANGE.max, ABANDONED_CART_DEFAULTS.idleMinutes),
    maxAgeHours: clamp(src.maxAgeHours, MAX_AGE_HOURS_RANGE.min, MAX_AGE_HOURS_RANGE.max, ABANDONED_CART_DEFAULTS.maxAgeHours),
  };
}

/** Strict: for the admin API. */
export function validateAbandonedCartSettings(input) {
  const errors = [];
  const src = input && typeof input === 'object' ? input : {};
  if (typeof src.enabled !== 'boolean') errors.push('"enabled" must be true or false.');
  const idle = Number(src.idleMinutes);
  if (!Number.isInteger(idle) || idle < IDLE_MINUTES_RANGE.min || idle > IDLE_MINUTES_RANGE.max) {
    errors.push(`Idle time must be a whole number of minutes from ${IDLE_MINUTES_RANGE.min} to ${IDLE_MINUTES_RANGE.max}.`);
  }
  const age = Number(src.maxAgeHours);
  if (!Number.isInteger(age) || age < MAX_AGE_HOURS_RANGE.min || age > MAX_AGE_HOURS_RANGE.max) {
    errors.push(`Maximum cart age must be a whole number of hours from ${MAX_AGE_HOURS_RANGE.min} to ${MAX_AGE_HOURS_RANGE.max}.`);
  }
  if (!errors.length && age * 60 <= idle) errors.push('Maximum cart age must be longer than the idle time.');
  if (errors.length) return { ok: false, errors, settings: null };
  return { ok: true, errors: [], settings: normalizeAbandonedCartSettings(src) };
}

export async function getAbandonedCartSettings() {
  try {
    await dbConnect();
    const doc = await SiteConfig.findOne({ key: 'main' }).select('commerce.abandonedCart').maxTimeMS(4000).lean();
    return normalizeAbandonedCartSettings(doc?.commerce?.abandonedCart);
  } catch (err) {
    console.error('[AbandonedCart] Could not read settings, using defaults:', err.message);
    return { ...ABANDONED_CART_DEFAULTS };
  }
}

export async function saveAbandonedCartSettings(settings) {
  await dbConnect();
  await SiteConfig.findOneAndUpdate(
    { key: 'main' },
    { $set: { 'commerce.abandonedCart.enabled': settings.enabled, 'commerce.abandonedCart.idleMinutes': settings.idleMinutes, 'commerce.abandonedCart.maxAgeHours': settings.maxAgeHours } },
    { upsert: true }
  );
  return settings;
}

/** Remembers the result of the latest scan so the admin can see whether the scheduler is alive. */
export async function recordScanResult({ trigger, scanned = 0, sent = 0, failed = 0, error = '' }) {
  try {
    await dbConnect();
    await SiteConfig.findOneAndUpdate(
      { key: 'main' },
      { $set: { 'commerce.abandonedCart.lastRun': { at: new Date(), trigger, scanned, sent, failed, error: String(error || '').slice(0, 300) } } },
      { upsert: true }
    );
  } catch (err) {
    console.error('[AbandonedCart] Could not record the scan result:', err.message);
  }
}

export async function getLastScan() {
  try {
    await dbConnect();
    const doc = await SiteConfig.findOne({ key: 'main' }).select('commerce.abandonedCart.lastRun').maxTimeMS(4000).lean();
    return doc?.commerce?.abandonedCart?.lastRun || null;
  } catch {
    return null;
  }
}
