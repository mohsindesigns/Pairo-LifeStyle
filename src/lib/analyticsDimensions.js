// Shared by the tracking collector, the admin dashboard APIs and the filter UI.

// GA4-style engaged-session rule: a session is engaged (not a bounce) when it viewed 2+ pages,
// converted (cart, checkout, payment or purchase), or stayed active 10s or longer.
export const ENGAGED_MS = 10000;

export const BOUNCE_EXPR = {
  $cond: [
    {
      $and: [
        { $lte: ["$pageViews", 1] },
        { $lte: [{ $ifNull: ["$conversionCount", 0] }, 0] },
        { $lt: ["$activeMs", ENGAGED_MS] },
      ],
    },
    1,
    0,
  ],
};

export function isBounced(session) {
  return session.pageViews <= 1 && !(session.conversionCount > 0) && session.activeMs < ENGAGED_MS;
}

export const PRICE_BANDS = [
  { key: "under-100", label: "Under $100", min: 0, max: 100 },
  { key: "100-250", label: "$100 - $250", min: 100, max: 250 },
  { key: "250-500", label: "$250 - $500", min: 250, max: 500 },
  { key: "500-1000", label: "$500 - $1,000", min: 500, max: 1000 },
  { key: "1000-plus", label: "$1,000+", min: 1000, max: Infinity },
];

export function priceBandFor(price) {
  const p = Number(price);
  if (!Number.isFinite(p) || p < 0) return "";
  const band = PRICE_BANDS.find((b) => p >= b.min && p < b.max) || PRICE_BANDS[PRICE_BANDS.length - 1];
  return band.key;
}

export const PAGE_TYPES = [
  "home", "shop", "category", "product", "cart", "checkout", "checkout_success",
  "blog", "blog_post", "account", "auth", "search", "page",
];

// Classifies a storefront path. Category slugs come from the Category collection so
// "/mens/some-jacket" is a product page and "/mens" is a category page.
export function pageInfo(path, categorySlugs = new Set()) {
  const clean = String(path || "/").split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  const segs = clean.split("/").filter(Boolean);
  if (segs.length === 0) return { pageType: "home", categorySlug: "" };

  const first = segs[0];
  const simple = (pageType) => ({ pageType, categorySlug: "" });

  if (first === "shop") return simple("shop");
  if (first === "product") return simple("product");
  if (first === "cart") return simple("cart");
  if (first === "checkout") return simple(segs[1] === "success" ? "checkout_success" : "checkout");
  if (first === "blog") return simple(segs.length > 1 ? "blog_post" : "blog");
  if (["profile", "order-tracking", "track-order"].includes(first)) return simple("account");
  if (["login", "signup", "forgot-password", "reset-password", "verify-email", "admin-login"].includes(first)) return simple("auth");
  if (first === "search") return simple("search");
  if (categorySlugs.has(first)) {
    return { pageType: segs.length >= 2 ? "product" : "category", categorySlug: first };
  }
  return simple("page");
}

export function parseUserAgent(ua = "") {
  const u = String(ua);
  const device = /iPad|Tablet/i.test(u) || (/Android/i.test(u) && !/Mobi/i.test(u))
    ? "tablet"
    : /Mobi|Android|iPhone|iPod/i.test(u) ? "mobile" : "desktop";
  const browser = /Edg\//.test(u) ? "Edge"
    : /OPR\//.test(u) ? "Opera"
    : /CriOS|Chrome\//.test(u) ? "Chrome"
    : /FxiOS|Firefox\//.test(u) ? "Firefox"
    : /Safari\//.test(u) ? "Safari" : "Other";
  const os = /Windows/i.test(u) ? "Windows"
    : /iPhone|iPad|iPod/i.test(u) ? "iOS"
    : /Android/i.test(u) ? "Android"
    : /Mac OS X/i.test(u) ? "macOS"
    : /CrOS/i.test(u) ? "ChromeOS"
    : /Linux/i.test(u) ? "Linux" : "Other";
  return { device, browser, os };
}

export const BOT_PATTERN = /bot|crawl|spider|slurp|lighthouse|preview/i;

export const ALLOWED_EVENTS = new Set([
  "view_item", "view_item_list", "select_item", "add_to_cart", "remove_from_cart",
  "view_cart", "begin_checkout", "add_shipping_info", "add_payment_info", "purchase",
  "search", "sign_up", "section_view", "click", "field_interaction",
  "option_select", "js_error", "api_error", "form_error", "search_result", "heat_click", "rage_click", "dead_click",
]);

export const CONVERSION_EVENTS = new Set(["add_to_cart", "begin_checkout", "add_payment_info", "purchase", "sign_up"]);

export const FUNNEL_EVENTS = ["view_item", "add_to_cart", "begin_checkout", "add_payment_info", "purchase"];

export const SENSITIVE_FIELD = /card|cvv|cvc|pass|secret|token|ssn|iban|routing|account/i;
