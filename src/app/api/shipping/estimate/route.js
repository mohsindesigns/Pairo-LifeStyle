import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SiteConfig from '@/models/SiteConfig';
import ShippingZone from '@/models/ShippingZone';
import ShippingMethod from '@/models/ShippingMethod';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

// Small per-process memo so a burst of cart/product views does not hit Mongo each time.
const MEMO_TTL_MS = 60 * 1000;
let memo = null; // { at, body }

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/**
 * Summary builder. A "base cost" is what a cart BELOW any free threshold pays on that method:
 *   FLAT_RATE      -> settings.cost
 *   FREE_SHIPPING  -> 0 when it has no minimum (or its fallbackCost is 0), else fallbackCost; a minimum with a
 *                     positive fallbackCost is a "free over X" threshold.
 * LOCAL_PICKUP is ignored (not a delivery rate). Method eligibility conditions are NOT evaluated here, so
 * the numbers are indicative ("from"); checkout stays the source of truth.
 */
function buildSummary(zones, methods) {
  const activeZoneIds = new Set(zones.map((z) => String(z._id)));
  const now = Date.now();
  const byZone = new Map();
  let freeShippingOver = null;

  for (const m of methods) {
    if (!activeZoneIds.has(String(m.zoneId))) continue;
    if (m.activeFrom && new Date(m.activeFrom).getTime() > now) continue;
    if (m.activeUntil && new Date(m.activeUntil).getTime() < now) continue;

    let base = null;
    if (m.provider === 'FLAT_RATE') {
      base = num(m.settings?.cost);
    } else if (m.provider === 'FREE_SHIPPING') {
      const min = num(m.settings?.minimumOrderAmount);
      const fallback = num(m.settings?.fallbackCost);
      if (min > 0 && fallback > 0) {
        base = fallback;
        if (freeShippingOver === null || min < freeShippingOver) freeShippingOver = min;
      } else {
        base = 0;
      }
    }
    if (base === null) continue;
    const key = String(m.zoneId);
    byZone.set(key, byZone.has(key) ? Math.min(byZone.get(key), base) : base);
  }

  const zoneMins = [...byZone.values()];
  const cheapestRate = zoneMins.length ? Math.min(...zoneMins) : null;
  const allFree = zoneMins.length > 0 && zoneMins.every((c) => c === 0);
  return {
    freeShippingOver: allFree ? null : freeShippingOver,
    cheapestRate,
    allFree,
  };
}

async function compute() {
  await dbConnect();
  const config = await SiteConfig.findOne({ key: 'main' }).select('commerce').lean();
  const currency = config?.commerce?.storeCurrency ?? 'USD';

  if (config?.commerce?.shippingEnabled === false) {
    return { success: true, currency, summary: { freeShippingOver: null, cheapestRate: 0, allFree: true } };
  }

  const zones = await ShippingZone.find({ status: 'Active' }).select('_id').lean();
  const methods = zones.length
    ? await ShippingMethod.find({ status: 'Active', zoneId: { $in: zones.map((z) => z._id) } })
        .select('zoneId provider settings activeFrom activeUntil')
        .lean()
    : [];

  return { success: true, currency, summary: buildSummary(zones, methods) };
}

/**
 * GET /api/shipping/estimate
 * Public, tiny, cacheable summary of shipping cost for cart / product / trust badge copy.
 * No personal data. On error returns an all-null summary (clients fall back to "Calculated at checkout").
 */
export async function GET() {
  try {
    if (memo && Date.now() - memo.at < MEMO_TTL_MS) {
      return NextResponse.json(memo.body, { headers: CACHE_HEADERS });
    }
    const body = await compute();
    memo = { at: Date.now(), body };
    return NextResponse.json(body, { headers: CACHE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { success: false, currency: 'USD', summary: { freeShippingOver: null, cheapestRate: null, allFree: false } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
