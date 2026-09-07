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

export function resolveAuthoritativePrice(product, item) {
  const variant = resolveVariantForItem(product, item);
  return (variant?.price !== undefined && variant?.price !== null) ? variant.price : product.price;
}

export function resolveAuthoritativeCompareAtPrice(product, item) {
  const variant = resolveVariantForItem(product, item);
  if (variant) return variant.compareAtPrice ?? null;
  return product.compareAtPrice ?? null;
}
