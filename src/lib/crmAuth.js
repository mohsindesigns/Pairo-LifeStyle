import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const crmCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

/** The CRM key must be at least this long on a production server (openssl rand -hex 32 gives 64). */
export const MIN_CRM_KEY_LENGTH = 32;
const MAX_FAILURES = 10;
const LOCKOUT_MS = 15 * 60 * 1000;
const failures = new Map();

const digest = (v) => createHash("sha256").update(String(v)).digest();

function clientId(req) {
  return (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
}

function isLocked(id) {
  const rec = failures.get(id);
  if (!rec) return false;
  if (Date.now() - rec.first > LOCKOUT_MS) { failures.delete(id); return false; }
  return rec.count >= MAX_FAILURES;
}

function noteFailure(id) {
  const rec = failures.get(id);
  if (!rec || Date.now() - rec.first > LOCKOUT_MS) failures.set(id, { count: 1, first: Date.now() });
  else rec.count += 1;
}

/**
 * Validates the CRM API key from the environment.
 * On a production server the key is REQUIRED and must be at least ${MIN_CRM_KEY_LENGTH} characters: with none set (or a weak one),
 * every request is refused. While developing or testing, an unset key still allows access so the endpoint is easy to try.
 * The key is only accepted in a header, never in the URL (URLs end up in logs):
 * - Header: x-api-key: <key>
 * - Header: Authorization: Bearer <key>
 * Both sides are hashed before the constant-time compare, so neither the key nor its length leaks through timing, and an
 * address that sends ${MAX_FAILURES} wrong keys is locked out for 15 minutes.
 */
export function validateCrmAuth(req) {
  const configuredKey = process.env.CRM_API_KEY;
  const isProd = process.env.NODE_ENV === "production";
  if (!configuredKey) return !isProd;
  if (isProd && configuredKey.length < MIN_CRM_KEY_LENGTH) {
    console.error("[CRM] CRM_API_KEY is shorter than " + MIN_CRM_KEY_LENGTH + " characters; every CRM request is refused.");
    return false;
  }

  const id = clientId(req);
  if (isLocked(id)) return false;

  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;
  const providedKey = req.headers.get("x-api-key") || bearerToken;

  const ok = !!providedKey && timingSafeEqual(digest(providedKey), digest(configuredKey));
  if (ok) failures.delete(id);
  else noteFailure(id);
  return ok;
}

export const crmUnauthorized = () =>
  NextResponse.json({ success: false, error: "Unauthorized. Invalid or missing CRM API Key." }, { status: 401, headers: crmCorsHeaders });

export const crmJson = (body, status = 200) => NextResponse.json(body, { status, headers: crmCorsHeaders });

export const crmError = (status, error, extra = {}) => crmJson({ success: false, error, ...extra }, status);
