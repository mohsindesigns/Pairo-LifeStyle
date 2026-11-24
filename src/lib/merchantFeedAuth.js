import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * HTTP Basic Auth gate shared by the Google Merchant Center feed routes (feed.xml, review.xml).
 * Merchant Center's "Scheduled fetch" feature natively authenticates a feed URL with a plain
 * username/password (it has Username/Password fields in its own UI) — Basic Auth is the
 * standard mechanism for this, not a custom token.
 *
 * Both sides of each comparison are reduced to a fixed-length SHA-256 digest before
 * timingSafeEqual, so two inputs of different lengths never throw and a wrong guess can't be
 * timed to learn how close it was (either to the other's length or its content).
 *
 * If MERCHANT_FEED_USERNAME / MERCHANT_FEED_PASSWORD are not configured at all (e.g. local dev
 * without them set), every request is refused — missing credentials are treated as "nothing can
 * authenticate", never as an open door. A one-line console.warn explains why, so a developer
 * running locally understands what's missing.
 *
 * @param {Request} req
 * @returns {Response|null} `null` when the request is authorized (caller proceeds); otherwise a
 *   401 Response that the caller should return immediately.
 */
export function requireMerchantFeedAuth(req) {
  const configuredUser = process.env.MERCHANT_FEED_USERNAME;
  const configuredPass = process.env.MERCHANT_FEED_PASSWORD;

  if (!configuredUser || !configuredPass) {
    console.warn(
      "[MerchantFeedAuth] MERCHANT_FEED_USERNAME/PASSWORD not set — feed is inaccessible until configured"
    );
    return unauthorized();
  }

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("basic ")) return unauthorized();

  const encoded = authHeader.slice(6).trim();
  if (!encoded) return unauthorized();

  let decoded;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return unauthorized();
  }

  const sep = decoded.indexOf(":");
  if (sep === -1) return unauthorized();

  const providedUser = decoded.slice(0, sep);
  const providedPass = decoded.slice(sep + 1);

  const authorized = safeEqual(providedUser, configuredUser) && safeEqual(providedPass, configuredPass);
  return authorized ? null : unauthorized();
}

/** Fixed-length digest compare: never throws on mismatched input length, never leaks length/content via timing. */
function safeEqual(a, b) {
  const digest = (v) => createHash("sha256").update(String(v)).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function unauthorized() {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<error>Unauthorized</error>`, {
    status: 401,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "WWW-Authenticate": 'Basic realm="Merchant Feed"',
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
