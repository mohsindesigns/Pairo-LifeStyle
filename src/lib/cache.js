import Redis from 'ioredis';
import logger, { LogCategory } from './logger';

const REDIS_URL = process.env.REDIS_URL;
let redis = null;

if (REDIS_URL) {
    redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 50, 2000);
        }
    });

    redis.on('error', (err) => {
        logger.error({ category: LogCategory.CACHE_OPERATIONS, error: err.message }, "Redis connection error. Falling back to DB.");
    });
}

/**
 * Resilient Cache Wrapper (SaaS Hardened)
 */
export const cache = {
    /**
     * Cache Versioning Strategy
     * Instead of deleting keys by pattern (O(N)), we increment a version number.
     * Old keys will naturally expire via TTL.
     */
    async getVersionedKey(baseKey) {
        if (!redis) return baseKey;
        try {
            const version = await redis.get('PROMO:SCHEMA_VERSION') || 'v1';
            return `PROMO:${version}:${baseKey}`;
        } catch (e) {
            return `PROMO:v1:${baseKey}`;
        }
    },

    async incrementSchemaVersion() {
        if (!redis) return false;
        try {
            await redis.incr('PROMO:SCHEMA_VERSION_NUM');
            const num = await redis.get('PROMO:SCHEMA_VERSION_NUM');
            await redis.set('PROMO:SCHEMA_VERSION', `v${num}`);
            logger.info({ category: LogCategory.CACHE_OPERATIONS, version: `v${num}` }, "Global cache version incremented");
            return true;
        } catch (err) {
            logger.error({ category: LogCategory.CACHE_OPERATIONS, error: err.message }, "Failed to increment cache version");
            return false;
        }
    },

    async get(key) {
        if (!redis) return null;
        try {
            return await redis.get(key);
        } catch (err) {
            logger.warn({ category: LogCategory.CACHE_OPERATIONS, key }, "Cache GET failed. Bypassing.");
            return null;
        }
    },

    async set(key, value, ttl = 3600) {
        if (!redis) return false;
        try {
            await redis.set(key, value, 'EX', ttl);
            return true;
        } catch (err) {
            logger.warn({ category: LogCategory.CACHE_OPERATIONS, key }, "Cache SET failed. Bypassing.");
            return false;
        }
    },

    async del(key) {
        if (!redis) return false;
        try {
            await redis.del(key);
            return true;
        } catch (err) {
            logger.warn({ category: LogCategory.CACHE_OPERATIONS, key }, "Cache DEL failed. Bypassing.");
            return false;
        }
    },

    async clearActivePromotionCache() {
        return await this.incrementSchemaVersion();
    }
};

export default redis;
