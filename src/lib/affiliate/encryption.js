import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Derive a secure 32-byte key from whatever key passphrase is provided in Env variables
const rawKey = process.env.AFFILIATE_ENCRYPTION_KEY || 'pairo-lifestyle-affiliate-system-passphrase-key-32-chars-long';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(rawKey).digest();

/**
 * Encrypts a string field using AES-256-CBC.
 * @param {string} text 
 * @returns {string} iv:ciphertext
 */
export function encrypt(text) {
  if (!text || typeof text !== 'string') return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
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
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // If decryption fails, return as-is
    return text;
  }
}
