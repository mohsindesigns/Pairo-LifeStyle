import crypto from "crypto";

const PINTEREST_API = "https://api.pinterest.com/v5";

// Pinterest requires PII (email, phone, name) to be SHA-256 hashed after normalization.
function hashPII(value) {
  if (!value) return undefined;
  return crypto.createHash("sha256").update(String(value).toLowerCase().trim()).digest("hex");
}

/**
 * Sends a server-side "checkout" (purchase) conversion to the Pinterest Conversions API.
 *
 * Triggered from the backend order-creation flow (checkoutFulfillment) rather than a
 * frontend-callable route, so the access token never reaches the browser. Fire-and-forget:
 * it never throws, and no-ops when PINTEREST_ACCESS_TOKEN / PINTEREST_AD_ACCOUNT_ID aren't
 * set — so it's safely opt-in via env and can't break checkout.
 *
 * The event_id matches the client pixel's checkout event_id (`checkout_<orderNumber>`), so
 * Pinterest de-duplicates the browser-pixel event and this server event into ONE conversion
 * instead of counting the purchase twice.
 *
 * Configure in .env.local (never commit these):
 *   PINTEREST_ACCESS_TOKEN=pina_...        (rotate if it was ever exposed)
 *   PINTEREST_AD_ACCOUNT_ID=549770680397
 */
export async function sendPinterestPurchaseEvent(order, { clientIp = null, clientUserAgent = null } = {}) {
  try {
    const token = process.env.PINTEREST_ACCESS_TOKEN;
    const adAccountId = process.env.PINTEREST_AD_ACCOUNT_ID;
    if (!token || !adAccountId || !order) return;

    const items = Array.isArray(order.items) ? order.items : [];
    const numItems = items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0) || 1;
    const contentIds = items.map((i) => String(i.sku || i.productId || "")).filter(Boolean);

    const userData = {};
    const hashedEmail = hashPII(order.customer?.email);
    if (hashedEmail) userData.em = [hashedEmail];
    const ip = clientIp && clientIp !== "unknown" ? String(clientIp).split(",")[0].trim() : null;
    if (ip) userData.client_ip_address = ip;
    if (clientUserAgent) userData.client_user_agent = String(clientUserAgent);

    const body = {
      data: [
        {
          event_name: "checkout",
          action_source: "web",
          event_time: Math.floor(Date.now() / 1000),
          event_id: `checkout_${order.orderNumber}`,
          user_data: userData,
          custom_data: {
            currency: String(order.financials?.currency || "USD"),
            value: String(order.financials?.total ?? 0),
            content_ids: contentIds,
            num_items: numItems,
            order_id: String(order.orderNumber || ""),
          },
        },
      ],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${PINTEREST_API}/ad_accounts/${adAccountId}/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[PinterestCAPI] checkout event failed (${res.status}): ${errText}`);
    }
  } catch (err) {
    // Analytics must never break order creation.
    console.error("[PinterestCAPI] Error sending checkout event:", err.message);
  }
}
