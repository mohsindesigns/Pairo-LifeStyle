import { NextResponse } from "next/server";
import { sendAbandonedCartRecoveryEmails, getAbandonedCartDiagnostics } from "@/lib/abandonedCartService";

/**
 * Triggers a scan for abandoned checkout sessions and sends each one a win-back voucher email
 * (see src/lib/abandonedCartService.js). The server already runs this scan itself every 5 minutes
 * (src/lib/abandonedCartScheduler.js, started from src/instrumentation.js), so a crontab entry is
 * no longer required; this route stays as an optional external trigger and for diagnosing, because
 * its response explains why each cart is or is not being emailed. Re-running it is always safe:
 * every cart is claimed atomically before it is emailed, so nobody gets the same email twice.
 *
 * Gated by a shared secret so random callers can't trigger it. Required: set CRON_SECRET in
 * .env.local/.env.production and send it back as the `x-cron-secret` header (or `?secret=`
 * query param, for crontabs where setting a custom header is inconvenient).
 */
function isAuthorized(req) {
  const configuredSecret = process.env.CRON_SECRET;
  // Unlike some lighter-weight internal endpoints, this one is NOT left open when unconfigured —
  // it sends real customer emails and can create a live discount Promotion, so fail closed.
  if (!configuredSecret) return false;

  const { searchParams } = new URL(req.url);
  const headerSecret = req.headers.get("x-cron-secret");
  const queryServer = searchParams.get("secret");
  const provided = headerSecret || queryServer;

  return Boolean(provided) && provided === configuredSecret;
}

export async function POST(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Optional overrides for testing, e.g. ?windowMinutes=1 sends to carts idle for just 1 minute
    // (default: the idle time in the admin settings). Still requires the cron secret.
    const { searchParams } = new URL(req.url);
    const w = Number(searchParams.get("windowMinutes"));
    // No override: the idle time from the admin settings (default 30 minutes) is used.
    const windowMinutes = Number.isFinite(w) && searchParams.get("windowMinutes") !== null ? Math.min(Math.max(w, 0), 1440) : undefined;

    const summary = await sendAbandonedCartRecoveryEmails({ trigger: "cron", windowMinutes });
    const diagnostics = await getAbandonedCartDiagnostics({ windowMinutes });
    console.log(`[Cron] Abandoned cart scan: scanned=${summary.scanned} sent=${summary.sent} smtp=${diagnostics.smtpConfigured}`);
    return NextResponse.json({ success: true, ...summary, diagnostics });
  } catch (error) {
    console.error("[Cron] Abandoned cart scan failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Also accept GET so a simple `curl` crontab entry (no -X POST needed) works too.
export async function GET(req) {
  return POST(req);
}
