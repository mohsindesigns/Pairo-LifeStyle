// Recovery links for abandoned-cart emails.
//
// The shopper's cart lives only in their browser, so "Complete my order" in the email would land on an empty checkout
// on any other device. Each email therefore carries an unguessable token (`/checkout?recover=<token>`); the server
// keeps only its SHA-256 hash (a leaked database never reveals a working link) and /api/checkout/recover turns a valid
// token back into the cart's items.
//
// A cart may hold several tokens (first email, the 24h reminder, an admin "Send now"): earlier links keep working.

import { createHash, randomBytes } from 'crypto';
import AbandonedCart from '@/models/AbandonedCart';

export const RECOVERY_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // links stop working after 14 days
export const MAX_RECOVERY_TOKENS = 5; // oldest tokens fall off when more are issued

const TOKEN_PATTERN = /^[a-f0-9]{48}$/;

export function hashRecoveryToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

/** Cheap shape check before touching the database (random garbage never causes a query). */
export function isWellFormedRecoveryToken(token) {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

export function mintRecoveryToken() {
  const token = randomBytes(24).toString('hex');
  return { token, hash: hashRecoveryToken(token) };
}

/** Creates a token for the cart and stores its hash. Only the returned `token` can be put in an email. */
export async function issueRecoveryToken(cartId) {
  const { token, hash } = mintRecoveryToken();
  await AbandonedCart.updateOne(
    { _id: cartId },
    { $push: { recoveryTokens: { $each: [{ hash, createdAt: new Date() }], $slice: -MAX_RECOVERY_TOKENS } } },
    { timestamps: false }
  );
  return { token, hash };
}

/** Drops a token whose email was never sent, so failed attempts do not pile up unused tokens. */
export async function revokeRecoveryToken(cartId, hash) {
  try {
    await AbandonedCart.updateOne({ _id: cartId }, { $pull: { recoveryTokens: { hash } } }, { timestamps: false });
  } catch (err) {
    console.error('[AbandonedCart] Could not remove an unused recovery token:', err.message);
  }
}
