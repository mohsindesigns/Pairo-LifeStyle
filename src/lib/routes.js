// Centralized Reserved Routes Registry
export const RESERVED_ROUTES = [
  "",
  "shop",
  "blog",
  "contact",
  "about",
  "faq",
  "cart",
  "checkout",
  "login",
  "signup",
  "register",
  "account",
  "admin",
  "admin-login",
  "affiliate",
  "affiliate-login",
  "api",
  "search",
  "wishlist",
  "orders",
  "profile",
  "order-tracking",
  "sitemap.xml",
  "robots.txt",
  "product"
];

export function getProductPrimaryCategorySlug(product) {
  if (product) {
    const isActiveCategory = (c) => {
      if (!c) return false;
      if (c.isDeleted === true || c.isDeleted === 'true') return false;
      if (c.status === 'Draft') return false;
      return true;
    };

    if (product.primaryCategory) {
      if (typeof product.primaryCategory === 'object' && product.primaryCategory.slug && isActiveCategory(product.primaryCategory)) {
        return product.primaryCategory.slug;
      }
      if (typeof product.primaryCategory === 'string') {
        if (product.categories && product.categories.length > 0) {
          const matched = product.categories.find(c => c._id?.toString() === product.primaryCategory || c === product.primaryCategory);
          if (matched && typeof matched === 'object' && matched.slug && isActiveCategory(matched)) {
            return matched.slug;
          }
        }
      }
    }
    // Fallback: use first assigned category that is active
    if (product.categories && product.categories.length > 0) {
      const activeCats = product.categories.filter(c => typeof c === 'object' && c.slug && isActiveCategory(c));
      if (activeCats.length > 0) {
        return activeCats[0].slug;
      }
    }
    if (product.category) {
      return product.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
  }
  return 'uncategorized';
}

export function getProductUrl(product) {
  if (!product) return '#';
  const productSlug = product.slug || product._id?.toString() || product.id?.toString();
  if (!productSlug) return '#';
  return `/product/${productSlug}`;
}

export function getCategoryUrl(category) {
  if (!category) return '#';
  const slug = category.slug || category._id?.toString() || category.id?.toString();
  return slug ? `/collections/${slug.toLowerCase().trim().replace(/[^a-z0-9-_]+/g, '-')}` : '#';
}
