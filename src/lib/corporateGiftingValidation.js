// Shared, single source of truth for Corporate Gifting server-side re-validation — used by both
// src/app/api/checkout/create-payment-intent/route.js (pre-charge check, so a stale/invalid
// selection fails before the card is charged) and src/lib/checkoutFulfillment.js (order-creation
// time, where the resolved snapshot is actually persisted). Keeping this logic in one place means
// the two call sites can never drift into a "charge approved here, rejected there" split-brain.
export function validateCorporateGiftingSelections(item, product) {
  if (!item?.corporateGifting?.enabled) {
    // A gifting product can't be bought bare (e.g. via a quick-add or a forged request) —
    // that would skip the minimum-selection rule and the surcharge entirely.
    if (product?.corporateGifting?.enabled) {
      return {
        valid: false,
        error: `Please choose your items for "${product.name}" on its product page before checkout.`,
      };
    }
    return { valid: true, data: null };
  }

  if (!product?.corporateGifting?.enabled) {
    return {
      valid: false,
      error: `Customization is no longer available for "${product?.name || "this product"}". Please update your cart.`,
    };
  }

  const minSelections = product.corporateGifting.minSelections || 3;

  // Dedupe by itemId server-side — the "N distinct items" rule must not be satisfiable by
  // repeating the same itemId, even though the storefront UI can only ever toggle each item once.
  const seenItemIds = new Set();
  const rawSelections = (Array.isArray(item.corporateGifting.selections) ? item.corporateGifting.selections : [])
    .filter((sel) => {
      const key = String(sel?.itemId);
      if (seenItemIds.has(key)) return false;
      seenItemIds.add(key);
      return true;
    });

  if (rawSelections.length < minSelections) {
    return {
      valid: false,
      error: `Please select at least ${minSelections} customization items for "${product.name}" before checkout.`,
    };
  }

  const catalogById = new Map((product.corporateGifting.items || []).map((ci) => [String(ci._id), ci]));
  for (const sel of rawSelections) {
    const catalogItem = catalogById.get(String(sel.itemId));
    if (!catalogItem || catalogItem.active === false) {
      return {
        valid: false,
        error: `One of the selected customization items for "${product.name}" is no longer available.`,
      };
    }
  }

  return {
    valid: true,
    data: {
      enabled: true,
      minSelections,
      selections: rawSelections.map((sel) => {
        const catalogItem = catalogById.get(String(sel.itemId));
        return {
          itemId: catalogItem._id,
          name: catalogItem.name,
          image: catalogItem.image,
          priceDelta: catalogItem.priceDelta || 0,
          artwork: sel.artwork ? { url: sel.artwork.url, name: sel.artwork.name } : null,
        };
      }),
    },
  };
}
