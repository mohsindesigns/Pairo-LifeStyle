/**
 * TaxService
 *
 * Completely independent from ShippingService. Computes tax amounts from a
 * TaxSettings document's tax classes / rate rows. Pure calculation functions
 * (rowMatches, postcodeMatches, calculateTax) take a plain settings object and
 * do no database access, so they're directly unit-testable.
 *
 * NOTE: as of this rewrite, TaxService is still not called from checkout —
 * that's an intentional product decision (tax isn't live yet). This module is
 * fixed and tested so it's correct and ready whenever it is wired in.
 */

import dbConnect   from '@/lib/db';
import TaxSettings from '@/models/TaxSettings';

/**
 * Does a single tax rate row's location constraints match the given address?
 * Blank fields on the row mean "matches anything" for that field.
 *
 * @param {object} row - { country, state, postcode, city }
 * @param {{ country?: string, state?: string, city?: string, zip?: string }} address
 * @returns {boolean}
 */
export function rowMatches(row, address = {}) {
  const country = (address.country || '').trim().toUpperCase();
  const state = (address.state || '').trim().toUpperCase();
  const city = (address.city || '').trim().toUpperCase();

  if (row.country && row.country.toUpperCase() !== country) return false;
  if (row.state && row.state.toUpperCase() !== state) return false;
  if (row.city && row.city.toUpperCase() !== city) return false;
  if (row.postcode && !postcodeMatches(row.postcode, address.zip)) return false;
  return true;
}

/**
 * Postcode matching supports three syntaxes (same as WooCommerce):
 *   exact:    "94103"
 *   wildcard: "9410*"           — prefix match
 *   range:    "10000...19999"   — inclusive numeric or lexicographic range
 *
 * @param {string} rowPostcode
 * @param {string} addressZip
 * @returns {boolean}
 */
export function postcodeMatches(rowPostcode, addressZip) {
  if (!rowPostcode) return true;
  const zip = (addressZip || '').trim().toUpperCase();
  if (!zip) return false;

  const raw = rowPostcode.trim().toUpperCase();

  if (raw.includes('...')) {
    const [start, end] = raw.split('...').map(s => s.trim());
    const zNum = parseInt(zip.replace(/\D/g, ''), 10);
    const sNum = parseInt(start.replace(/\D/g, ''), 10);
    const eNum = parseInt(end.replace(/\D/g, ''), 10);
    if (!Number.isNaN(zNum) && !Number.isNaN(sNum) && !Number.isNaN(eNum)) {
      return zNum >= sNum && zNum <= eNum;
    }
    return zip >= start && zip <= end;
  }

  if (raw.endsWith('*')) {
    return zip.startsWith(raw.slice(0, -1));
  }

  return zip === raw;
}

function roundValue(value, mode) {
  const cents = value * 100;
  switch (mode) {
    case 'floor': return Math.floor(cents) / 100;
    case 'ceil':  return Math.ceil(cents) / 100;
    default:      return Math.round(cents) / 100;
  }
}

class TaxService {
  /**
   * Fetch tax settings for a tenant. Returns safe, tax-disabled defaults if not configured.
   * @param {string} tenantId
   * @returns {Promise<object>}
   */
  async getTaxSettings(tenantId) {
    await dbConnect();
    const settings = await TaxSettings.findOne({ tenantId }).lean();
    return settings ?? {
      tenantId,
      enabled: false,
      calculationMethod: 'exclusive',
      taxRoundingMode: 'round',
      priceDisplaySuffix: '',
      taxClasses: [],
    };
  }

  /**
   * Resolve which tax class to use: the requested key if it exists, else the
   * class flagged isDefault, else the first class, else null (no classes configured).
   * @param {object} taxSettings
   * @param {string|null} classKey
   * @returns {object|null}
   */
  getTaxClass(taxSettings, classKey = null) {
    const classes = taxSettings?.taxClasses || [];
    if (classKey) {
      const found = classes.find(c => c.key === classKey);
      if (found) return found;
    }
    return classes.find(c => c.isDefault) || classes[0] || null;
  }

  /**
   * Calculate tax for a subtotal + shipping cost against a tax class's rate table.
   *
   * Matching rows in the same class all apply (this is how real combined taxes
   * work, e.g. a federal rate + a provincial rate both matching the same
   * address). Non-compound ("simple") rows are summed against the base
   * subtotal; compound rows are then applied on top of subtotal + already-
   * applied simple tax, in priority order — matching WooCommerce's model.
   *
   * "Inclusive" mode treats the given subtotal as already containing the
   * combined simple-rate tax and backs it out before computing the breakdown;
   * compound rows are then computed on the resulting tax-exclusive base. This
   * is exact for the common case (no compound rows) and a reasonable
   * approximation when compound rows are also present.
   *
   * @param {number} subtotal
   * @param {number} shippingCost
   * @param {object} taxSettings - TaxSettings document (or lean object)
   * @param {{ country?: string, state?: string, city?: string, zip?: string }} address
   * @param {string|null} classKey - which tax class to use; defaults to the store's default class
   * @returns {{ taxAmount: number, effectiveRate: number, breakdown: Array<{name: string, rate: number, compound: boolean, onSubtotal: number, onShipping: number, amount: number}> }}
   */
  calculateTax(subtotal, shippingCost = 0, taxSettings, address = {}, classKey = null) {
    const empty = { taxAmount: 0, effectiveRate: 0, breakdown: [] };
    if (!taxSettings?.enabled) return empty;

    const taxClass = this.getTaxClass(taxSettings, classKey);
    if (!taxClass) return empty;

    const matchingRows = (taxClass.rates || []).filter(row => rowMatches(row, address));
    if (matchingRows.length === 0) return empty;

    const round = (v) => roundValue(v, taxSettings.taxRoundingMode);

    const simpleRows = matchingRows.filter(r => !r.compound).sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1));
    const compoundRows = matchingRows.filter(r => r.compound).sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1));

    let taxableSubtotal = subtotal;
    if (taxSettings.calculationMethod === 'inclusive') {
      const combinedSimpleRate = simpleRows.reduce((sum, r) => sum + (r.rate || 0), 0);
      if (combinedSimpleRate > 0) {
        taxableSubtotal = subtotal / (1 + combinedSimpleRate / 100);
      }
    }

    const breakdown = [];
    for (const row of simpleRows) {
      const onSubtotal = round((taxableSubtotal * row.rate) / 100);
      const onShipping = row.shipping ? round((shippingCost * row.rate) / 100) : 0;
      breakdown.push({ name: row.name || 'Tax', rate: row.rate, compound: false, onSubtotal, onShipping, amount: round(onSubtotal + onShipping) });
    }

    let runningBase = taxableSubtotal + breakdown.reduce((s, b) => s + b.onSubtotal, 0);
    let runningShippingBase = shippingCost + breakdown.reduce((s, b) => s + b.onShipping, 0);

    for (const row of compoundRows) {
      const onSubtotal = round((runningBase * row.rate) / 100);
      const onShipping = row.shipping ? round((runningShippingBase * row.rate) / 100) : 0;
      breakdown.push({ name: row.name || 'Tax', rate: row.rate, compound: true, onSubtotal, onShipping, amount: round(onSubtotal + onShipping) });
      runningBase += onSubtotal;
      runningShippingBase += onShipping;
    }

    const taxAmount = round(breakdown.reduce((s, b) => s + b.amount, 0));
    const effectiveRate = subtotal > 0 ? Math.round((taxAmount / subtotal) * 10000) / 100 : 0;

    return { taxAmount, effectiveRate, breakdown };
  }
}

export const taxService = new TaxService();
export default TaxService;
