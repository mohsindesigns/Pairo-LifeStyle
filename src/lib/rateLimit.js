import { cache } from './cache';
import logger, { LogCategory } from './logger';

/**
 * Enterprise Rate Limiter (Redis-backed with In-Memory LRU/TTL Fallback)
 * Protects against brute-force attacks, credential stuffing, spam submissions, and DoS.
 */

// In-Memory store fallback for environments without Redis
const memoryStore = new Map();

// Periodic cleanup of expired entries in memory store (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      if (record.expiresAt < now) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (cleanupInterval.unref) cleanupInterval.unref();
}

/**
 * Extracts client IP address from a Next.js Request or Headers object
 * @param {Request|Headers} req 
 * @returns {string}
 */
export function getClientIp(req) {
  if (!req) return '127.0.0.1';

  const headers = req.headers ? (typeof req.headers.get === 'function' ? req.headers : new Headers(req.headers)) : null;
  if (headers) {
    const forwarded = headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    const realIp = headers.get('x-real-ip');
    if (realIp) {
      return realIp.trim();
    }
    const cfConnectingIp = headers.get('cf-connecting-ip');
    if (cfConnectingIp) {
      return cfConnectingIp.trim();
    }
  }

  if (req.ip) return req.ip;
  return '127.0.0.1';
}

/**
 * Rate limit a specific key (e.g. IP, email, action)
 * @param {string} key - Unique identifier to rate limit
 * @param {number} limit - Maximum number of allowed requests in the window
 * @param {number} window - Window duration in seconds (default: 60)
 * @returns {Promise<{ success: boolean, remaining: number, limit: number, resetIn: number }>}
 */
export async function rateLimit(key, limit = 10, window = 60) {
  const cacheKey = `RATELIMIT:${key}`;
  const now = Date.now();

  try {
    const current = await cache.get(cacheKey);
    
    if (current !== null && current !== undefined) {
      const count = parseInt(current, 10);
      if (count >= limit) {
        logger.warn({ category: LogCategory.SECURITY_HARDENING, key, count, limit }, "Rate limit exceeded (Redis)");
        return { success: false, remaining: 0, limit, resetIn: window };
      }
      await cache.set(cacheKey, count + 1, window);
      return { success: true, remaining: Math.max(0, limit - (count + 1)), limit, resetIn: window };
    }
    
    // If cache.get returned null (either no key yet or Redis disconnected)
    const redisAvailable = await cache.set(cacheKey, 1, window);
    if (redisAvailable) {
      return { success: true, remaining: limit - 1, limit, resetIn: window };
    }
  } catch (err) {
    logger.warn({ category: LogCategory.SECURITY_HARDENING, error: err.message }, "Redis rate limiter unavailable. Using in-memory fallback.");
  }

  // In-Memory Fallback
  const record = memoryStore.get(cacheKey);
  if (record && record.expiresAt > now) {
    if (record.count >= limit) {
      logger.warn({ category: LogCategory.SECURITY_HARDENING, key, count: record.count, limit }, "Rate limit exceeded (Memory fallback)");
      return { 
        success: false, 
        remaining: 0, 
        limit, 
        resetIn: Math.ceil((record.expiresAt - now) / 1000) 
      };
    }
    record.count += 1;
    return { 
      success: true, 
      remaining: limit - record.count, 
      limit, 
      resetIn: Math.ceil((record.expiresAt - now) / 1000) 
    };
  }

  // Create new memory record
  memoryStore.set(cacheKey, {
    count: 1,
    expiresAt: now + window * 1000
  });

  return { success: true, remaining: limit - 1, limit, resetIn: window };
}

/**
 * Plug-and-play helper for route handlers
 * @param {Request} req 
 * @param {{ limit?: number, window?: number, keyPrefix?: string, identifier?: string }} options 
 */
export async function checkRateLimit(req, options = {}) {
  const {
    limit = 10,
    window = 60,
    keyPrefix = 'ROUTE',
    identifier = null
  } = options;

  const ip = identifier || getClientIp(req);
  const key = `${keyPrefix}:${ip}`;
  
  return await rateLimit(key, limit, window);
}

export default {
  rateLimit,
  checkRateLimit,
  getClientIp
};
