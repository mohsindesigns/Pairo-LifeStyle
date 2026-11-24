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
