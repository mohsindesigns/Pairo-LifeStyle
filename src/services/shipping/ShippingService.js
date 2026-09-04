/**
 * ShippingService
 * 
 * Main orchestrator for the shipping engine. Designed with Redis-readiness:
 * a cacheAdapter is injected at construction — defaults to NullCacheAdapter
 * (always miss). Swap in a RedisCacheAdapter instance when ready with zero
 * changes to this class (Open/Closed Principle).
 * 
 * Registers all shipping providers at module load time via ProviderRegistry.
 */

import dbConnect        from '@/lib/db';
import ShippingZone     from '@/models/ShippingZone';
import ShippingMethod   from '@/models/ShippingMethod';
import SiteConfig       from '@/models/SiteConfig';
import { matchZone }    from './ZoneMatcher.js';
import { isEligible }   from './MethodEligibility.js';
import { calculateRate } from './RateCalculator.js';
import { providerRegistry } from './providers/ProviderRegistry.js';
import FlatRateProvider     from './providers/FlatRateProvider.js';
import FreeShippingProvider from './providers/FreeShippingProvider.js';
import LocalPickupProvider  from './providers/LocalPickupProvider.js';
import { NullCacheAdapter } from './NullCacheAdapter.js';
import crypto               from 'crypto';

// ─── Register all built-in providers once at module load ──────────────────────
providerRegistry
  .register('FLAT_RATE',     FlatRateProvider)
  .register('FREE_SHIPPING', FreeShippingProvider)
  .register('LOCAL_PICKUP',  LocalPickupProvider);

// ─── Default cache TTL ────────────────────────────────────────────────────────
const CACHE_TTL_SECONDS = 120; // 2 minutes

class ShippingService {
  /**
   * @param {object} cacheAdapter - Object with async get(key) and async set(key, value, ttl)
   */
  constructor(cacheAdapter = NullCacheAdapter) {
    this.cache = cacheAdapter;
  }

  /**
   * Build a deterministic cache key from the request context.
   * @private
   */
  #buildCacheKey(tenantId, address, subtotal) {
    const raw = JSON.stringify({ tenantId, address, subtotal });
    return `shipping:rates:${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16)}`;
  }

  /**
   * Fetch the store currency from SiteConfig.
   * Falls back to 'USD' if not configured.
   * @private
   */
  async #getStoreCurrency(tenantId) {
    try {
      const config = await SiteConfig.findOne({ key: 'main', tenantId }).select('commerce').lean();
      return config?.commerce?.storeCurrency ?? 'USD';
    } catch {
      return 'USD';
    }
  }

  /**
   * Calculate available shipping rates for a given address and cart context.
   * 
   * @param {string} tenantId
   * @param {{ country?: string, state?: string, city?: string, zip?: string }} address
   * @param {number} cartSubtotal
   * @param {Array}  cartItems
   * @returns {Promise<{
   *   zone: object|null,
   *   rates: Array,
   *   currency: string,
   *   cacheHit: boolean
   * }>}
   */
  async getRatesForAddress(tenantId, address, cartSubtotal, cartItems = []) {
    const cacheKey = this.#buildCacheKey(tenantId, address, cartSubtotal);

    // ── 1. Cache check ─────────────────────────────────────────────────────────
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, cacheHit: true };
    }

    await dbConnect();

    // ── 2. Load active zones for tenant ───────────────────────────────────────
    const zones = await ShippingZone
      .find({ tenantId, status: 'Active' })
      .sort({ priority: -1 })
      .lean();

    if (!zones.length) {
      return { zone: null, rates: [], currency: 'USD', cacheHit: false };
    }

    // ── 3. Match best zone ────────────────────────────────────────────────────
    const matchedZone = matchZone(zones, address);
    if (!matchedZone) {
      return { zone: null, rates: [], currency: 'USD', cacheHit: false };
    }

    // ── 4. Load methods for matched zone ──────────────────────────────────────
    const methods = await ShippingMethod
      .find({ zoneId: matchedZone._id, status: 'Active' })
      .sort({ sortOrder: 1 })
      .lean();

    // ── 5. Build cart context for eligibility + calculation ───────────────────
    const totalQuantity = cartItems.reduce((sum, i) => sum + (i.quantity ?? 1), 0);
    const totalWeight   = cartItems.reduce((sum, i) => sum + ((i.weight ?? 0) * (i.quantity ?? 1)), 0);

    const cart = {
      subtotal: cartSubtotal,
      totalQuantity,
      totalWeight,
      items: cartItems,
      country: address.country,
      state:   address.state,
      city:    address.city
    };

    // ── 6. Load store currency ────────────────────────────────────────────────
    const currency = await this.#getStoreCurrency(tenantId);

    // ── 7. Filter eligible methods and calculate rates ────────────────────────
    const rates = [];
    for (const method of methods) {
      if (isEligible(method, cart)) {
        rates.push(calculateRate(method, cart, currency, matchedZone));
      }
    }

    const result = { zone: matchedZone, rates, currency, cacheHit: false };

    // ── 8. Cache result ───────────────────────────────────────────────────────
    await this.cache.set(cacheKey, result, CACHE_TTL_SECONDS);

    return result;
  }
}

// Export a default singleton — inject a different cacheAdapter here when Redis is ready
export const shippingService = new ShippingService(NullCacheAdapter);
export default ShippingService;
