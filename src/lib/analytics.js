/**
 * Google Analytics 4 (GA4) & Google Tag Manager E-Commerce Helper
 * Resilient e-commerce tracking with deduplication, numeric normalization,
 * and fail-safe execution.
 */

function safeNumber(val, fallback = 0) {
  if (typeof val === "number") return Number.isFinite(val) ? val : fallback;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.-]+/g, "");
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function trackGAEvent(eventName, params = {}) {
  if (typeof window === "undefined") return;

  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push({
        event: eventName,
        ...params,
        ecommerce: params
      });
    }
  } catch (err) {
    // Analytics failures must never break customer checkout or navigation
    console.debug("[GA4 Analytics Event Error]", eventName, err);
  }
}

export function trackAddToCart(product) {
  if (!product) return;

  const price = safeNumber(product.price ?? product.priceAtPurchase);
  const quantity = Math.max(1, safeNumber(product.quantity, 1));
  const variant = [product.selectedSize, product.selectedColor].filter(Boolean).join(" / ") || product.selectedVariant?.title || undefined;

  trackGAEvent("add_to_cart", {
    currency: String(product.currency || "USD"),
    value: price * quantity,
    items: [
      {
        item_id: String(product.sku || product._id || product.id || product.item_id || ""),
        item_name: String(product.title || product.name || product.item_name || "Product"),
        price,
        quantity,
        item_variant: variant
      }
    ]
  });
}

let lastBeginCheckoutTs = 0;

export function trackBeginCheckout(cartItems = [], totalValue = 0) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) return;

  // Throttle: avoid duplicate events within 3 seconds (e.g., clicking Drawer CTA then page loading)
  const now = Date.now();
  if (now - lastBeginCheckoutTs < 3000) return;
  lastBeginCheckoutTs = now;

  trackGAEvent("begin_checkout", {
    currency: String(cartItems[0]?.currency || "USD"),
    value: safeNumber(totalValue),
    items: cartItems.map((item) => ({
      item_id: String(item.sku || item._id || item.id || item.productId || ""),
      item_name: String(item.title || item.name || "Product"),
      price: safeNumber(item.price ?? item.priceAtPurchase),
      quantity: Math.max(1, safeNumber(item.quantity, 1)),
      item_variant: [item.selectedSize, item.selectedColor].filter(Boolean).join(" / ") || item.selectedVariant?.title || undefined
    }))
  });
}

export function trackPurchase(orderData) {
  if (!orderData) return;

  const transactionId = String(orderData.orderId || orderData.orderNumber || orderData._id || "");
  if (!transactionId) return;

  // Deduplication: prevent duplicate purchase tracking on page refresh or back/forward navigation
  try {
    const dedupeKey = `pairo_ga_purchase_${transactionId}`;
    if (sessionStorage.getItem(dedupeKey)) {
      return;
    }
    sessionStorage.setItem(dedupeKey, "1");
  } catch {
    // Storage access unavailable
  }

  const items = Array.isArray(orderData.items) ? orderData.items : [];
  const total = safeNumber(
    orderData?.financials?.total ??
    orderData?.totalAmount ??
    orderData?.total
  );

  const currency = String(orderData?.financials?.currency || orderData?.currency || "USD");

  trackGAEvent("purchase", {
    transaction_id: transactionId,
    value: total,
    currency,
    items: items.map((item) => ({
      item_id: String(item.sku || item.productId?._id || item.productId || item.id || item._id || ""),
      item_name: String(item.name || item.title || "Product"),
      price: safeNumber(item.priceAtPurchase ?? item.price),
      quantity: Math.max(1, safeNumber(item.quantity, 1)),
      item_variant: item.selectedVariant?.title || (item.selectedVariant?.options ? Object.values(item.selectedVariant.options).join(" / ") : undefined)
    }))
  });
}
