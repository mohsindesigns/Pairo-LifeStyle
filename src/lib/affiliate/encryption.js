import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Derive a secure 32-byte key from whatever key passphrase is provided in Env variables.
// In production this MUST come from the environment — a hardcoded fallback baked into
// source would mean anyone with repo access could decrypt sensitive affiliate data at rest
// in any deployment that forgot to set it. Only dev/test gets a (loud) fallback so local
// work isn't blocked by a missing .env.local entry.
//
// The check is deferred to first actual use (not module load) — Next.js's production build
// imports every route module to statically collect page data, even ones that never call
// encrypt/decrypt at runtime, so throwing at import time broke `next build` entirely for
// routes that merely import this file without using it.
let cachedKey = null;

function getEncryptionKey() {
  if (cachedKey) return cachedKey;

  if (!process.env.AFFILIATE_ENCRYPTION_KEY) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AFFILIATE_ENCRYPTION_KEY must be set in production — refusing to encrypt affiliate data with a fallback key.');
    }
    console.error('[affiliate/encryption] AFFILIATE_ENCRYPTION_KEY is not set — using an insecure dev-only fallback key. Set it in .env.local before storing real data.');
  }

  const rawKey = process.env.AFFILIATE_ENCRYPTION_KEY || 'pairo-lifestyle-affiliate-system-passphrase-key-32-chars-long';
  cachedKey = crypto.createHash('sha256').update(rawKey).digest();
  return cachedKey;
}

/**
 * Encrypts a string field using AES-256-CBC.
 * @param {string} text
 * @returns {string} iv:ciphertext
 */
export function encrypt(text) {
  if (!text || typeof text !== 'string') return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string field using AES-256-CBC.
 * Supports graceful fallback to plaintext for backward compatibility.
 * @param {string} text
 * @returns {string} decrypted plaintext
 */
export function decrypt(text) {
  if (!text || typeof text !== 'string') return text;
  try {
    const parts = text.split(':');
    if (parts.length !== 2) {
      return text; // Graceful fallback if data is not in "iv:ciphertext" format
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // If decryption fails, return as-is
    return text;
  }
}
