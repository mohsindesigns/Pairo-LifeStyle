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

// Maps a cart-line item to GA4's item shape (shared by cart/checkout funnel events).
function mapCartItem(item = {}) {
  return {
    item_id: String(item.sku || item._id || item.id || item.productId || ""),
    item_name: String(item.title || item.name || "Product"),
    price: safeNumber(item.price ?? item.priceAtPurchase),
    quantity: Math.max(1, safeNumber(item.quantity, 1)),
    item_variant: [item.selectedSize, item.selectedColor].filter(Boolean).join(" / ") || item.selectedVariant?.title || undefined
  };
}

export function trackGAEvent(eventName, params = {}) {
  if (typeof window === "undefined") return;

  try {
    // Always push to the dataLayer in GA4 ecommerce format so Google Tag Manager can pick up,
    // transform, fix, enable/disable, and manage every event visually in its own UI — no code
    // change or redeploy needed to adjust events later. Initialising the array means events
    // still fire if they happen before GTM finishes loading; GTM replays the queued events.
    // (Add your GTM container under Admin → Settings → Scripts → "GTM Template".)
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ ecommerce: null }); // reset the ecommerce object between events
    window.dataLayer.push({ event: eventName, ecommerce: params });

    // Also fire directly to GA4 when a direct gtag tag is loaded (i.e. you're NOT using GTM to
    // forward to GA4). If you manage GA4 through GTM instead, do not also add a direct GA4
    // script in the Scripts screen, or these events will be counted twice.
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
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

// ── Full-funnel events ──────────────────────────────────────────────

// view_item — product detail page view
export function trackViewItem(product) {
  if (!product) return;
  const price = safeNumber(product.price ?? product.priceAtPurchase);
  trackGAEvent("view_item", {
    currency: String(product.currency || "USD"),
    value: price,
    items: [{
      item_id: String(product.sku || product._id || product.id || product.item_id || ""),
      item_name: String(product.title || product.name || product.item_name || "Product"),
      price,
      quantity: 1,
      item_category: product.primaryCategory?.name || product.category || undefined,
      item_variant: [product.selectedSize, product.selectedColor].filter(Boolean).join(" / ") || product.selectedVariant?.title || undefined
    }]
  });
}

// view_item_list — a list/grid of products was shown (e.g. shop / category page)
export function trackViewItemList(products = [], listName = "Product List") {
  if (!Array.isArray(products) || products.length === 0) return;
  trackGAEvent("view_item_list", {
    item_list_name: String(listName),
    items: products.slice(0, 50).map((p, index) => ({
      item_id: String(p.sku || p._id || p.id || ""),
      item_name: String(p.title || p.name || "Product"),
      price: safeNumber(p.price),
      index,
      item_list_name: String(listName)
    }))
  });
}

// select_item — a product was clicked within a list
export function trackSelectItem(product, listName = "Product List") {
  if (!product) return;
  trackGAEvent("select_item", {
    item_list_name: String(listName),
    items: [{
      item_id: String(product.sku || product._id || product.id || ""),
      item_name: String(product.title || product.name || "Product"),
      price: safeNumber(product.price),
      item_list_name: String(listName)
    }]
  });
}

// view_cart — the cart was viewed (cart page / drawer opened)
export function trackViewCart(cartItems = [], totalValue = 0) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) return;
  trackGAEvent("view_cart", {
    currency: String(cartItems[0]?.currency || "USD"),
    value: safeNumber(totalValue),
    items: cartItems.map(mapCartItem)
  });
}

// remove_from_cart — an item (or units of it) was removed
export function trackRemoveFromCart(item) {
  if (!item) return;
  const price = safeNumber(item.price ?? item.priceAtPurchase);
  const quantity = Math.max(1, safeNumber(item.quantity, 1));
  trackGAEvent("remove_from_cart", {
    currency: String(item.currency || "USD"),
    value: price * quantity,
    items: [mapCartItem(item)]
  });
}

// add_shipping_info — a shipping method was chosen during checkout
export function trackAddShippingInfo(cartItems = [], totalValue = 0, shippingTier = undefined) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) return;
  trackGAEvent("add_shipping_info", {
    currency: String(cartItems[0]?.currency || "USD"),
    value: safeNumber(totalValue),
    shipping_tier: shippingTier ? String(shippingTier) : undefined,
    items: cartItems.map(mapCartItem)
  });
}

// add_payment_info — payment details were provided during checkout
export function trackAddPaymentInfo(cartItems = [], totalValue = 0, paymentType = undefined) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) return;
  trackGAEvent("add_payment_info", {
    currency: String(cartItems[0]?.currency || "USD"),
    value: safeNumber(totalValue),
    payment_type: paymentType ? String(paymentType) : undefined,
    items: cartItems.map(mapCartItem)
  });
}
