// Is this product sold out for the shopper? Mirrors how the storefront computes displayed stock:
// variants (when the product has them) decide, otherwise the product's own stock. Products that do not manage stock are
// never sold out. A variable product whose variants were not loaded is treated as available (the server re-checks at payment).
export function isSoldOut(product) {
  if (!product || product.manageStock === false) return false;
  if (Array.isArray(product.variantCombinations) && product.variantCombinations.length > 0) {
    return product.variantCombinations.reduce((sum, v) => sum + (Number(v?.stock) || 0), 0) <= 0;
  }
  if (product.productType === "variable") return false;
  return !(Number(product.stock) > 0);
}

// The title a variant combination carries for a set of selected options (e.g. { Color: "Black", Size: "M" } ->
// "Black / M"). Same rule the PDP, the cart and the server (productPricing.resolveVariantForItem) use: values in the
// product's attribute order, joined by " / ", falling back to the selection's own key order.
export function buildVariantTitle(product, selectedOptions) {
  const selected = selectedOptions || {};
  return (product?.attributes || []).map((a) => selected[a.name]).filter(Boolean).join(" / ")
    || Object.values(selected).join(" / ");
}

// Splits a combination title into one value per attribute, or null when it cannot be mapped positionally (a value that
// itself contains " / ", or a title that does not cover every attribute). Callers treat null as "unknown".
function splitCombinationTitle(title, attributeCount) {
  if (typeof title !== "string") return null;
  const parts = title.split(" / ");
  return parts.length === attributeCount ? parts : null;
}

// Can the shopper still buy this option value, given the options they have ALREADY chosen for the other attributes?
// An option is unavailable when every variant combination that contains it (and agrees with the other current
// selections) has no stock. The attribute being asked about is ignored in `selectedOptions`, so every value of one
// attribute is judged against the same context. Anything that cannot be determined is reported as available (the server
// re-checks stock at payment): stock not managed, no combinations, an unknown attribute, a combination title that cannot
// be mapped to the attributes, or a value no combination mentions at all.
export function isOptionAvailable(product, selectedOptions, attrName, value) {
  if (!product || product.manageStock === false) return true;
  const attributes = Array.isArray(product.attributes) ? product.attributes : [];
  const combos = Array.isArray(product.variantCombinations) ? product.variantCombinations : [];
  if (attributes.length === 0 || combos.length === 0) return true;
  const idx = attributes.findIndex((a) => a.name === attrName);
  if (idx === -1) return true;

  const rows = [];
  for (const combo of combos) {
    const parts = splitCombinationTitle(combo?.title, attributes.length);
    if (!parts) return true;
    rows.push({ parts, stock: Number(combo?.stock) || 0 });
  }

  const containing = rows.filter((r) => r.parts[idx] === value);
  if (containing.length === 0) return true;

  const selected = selectedOptions || {};
  const matching = containing.filter((r) =>
    attributes.every((a, j) => j === idx || !selected[a.name] || r.parts[j] === selected[a.name])
  );
  return matching.some((r) => r.stock > 0);
}
