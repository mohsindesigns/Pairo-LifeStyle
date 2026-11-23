/**
 * Resolves the real, DB-authoritative price/compareAtPrice for a cart line item,
 * accounting for variant-specific pricing (product.variantCombinations) rather
 * than always falling back to the base product's price. A variable product's
 * variant can legitimately cost more or less than its base price/listing price,
 * so any code re-deriving an "authoritative" price from a Product document must
 * resolve the matching variant first — using the base price unconditionally
 * would over/undercharge for products whose variants are priced differently.
 *
 * @param {Object} product - A DB Product document (lean or Mongoose doc).
 * @param {Object} item - The cart line item, expected to optionally carry
 *   `selectedOptions` (e.g. { Size: "M", Color: "Black" }).
 */
export function resolveVariantForItem(product, item) {
  if (!product?.variantCombinations?.length) return null;

  const selectedOptions = item?.selectedOptions && Object.keys(item.selectedOptions).length > 0
    ? item.selectedOptions
    : null;
  if (!selectedOptions) return null;

  const variantTitle = (product.attributes || []).map(a => selectedOptions[a.name]).filter(Boolean).join(" / ")
    || Object.values(selectedOptions).join(" / ");

  return product.variantCombinations.find(vc => vc.title === variantTitle) || null;
}

// Must match the client-side constant in MadeToMeasureModal.js. Applied by
// flag only (never trusting a client-supplied surcharge amount) — an item
// tagged madeToMeasure.enabled always costs base/variant price + this fixed
// amount, so a forged surcharge value can't be used to discount the item.
export const MADE_TO_MEASURE_SURCHARGE = 25;

// Sums the price delta of this item's Corporate Gifting selections, resolved against the
// product's own catalog of configurable items — never trusting a client-supplied priceDelta —
// so a forged request can't under/over-price a selection. Deactivated or unknown items are
// silently ignored here (checkoutFulfillment performs the hard validation/rejection).
export function resolveCorporateGiftingSurcharge(product, item) {
  if (!product?.corporateGifting?.enabled) return 0;
  const selections = item?.corporateGifting?.enabled ? (item.corporateGifting.selections || []) : [];
  if (!selections.length || !product?.corporateGifting?.items?.length) return 0;

  const selectedIds = new Set(selections.map((s) => String(s.itemId)));
  return product.corporateGifting.items.reduce((sum, giftItem) => {
    if (giftItem.active === false) return sum;
    if (!selectedIds.has(String(giftItem._id))) return sum;
    return sum + (Number(giftItem.priceDelta) || 0);
  }, 0);
}

export function resolveAuthoritativePrice(product, item) {
  const variant = resolveVariantForItem(product, item);
  const basePrice = (variant?.price !== undefined && variant?.price !== null) ? variant.price : product.price;
  const m2mPrice = item?.madeToMeasure?.enabled ? basePrice + MADE_TO_MEASURE_SURCHARGE : basePrice;
  return m2mPrice + resolveCorporateGiftingSurcharge(product, item);
}

export function resolveAuthoritativeCompareAtPrice(product, item) {
  const variant = resolveVariantForItem(product, item);
  if (variant) return variant.compareAtPrice ?? null;
  return product.compareAtPrice ?? null;
}
