// Built-in scheduler for the abandoned-cart recovery emails.
//
// Started once per server process from src/instrumentation.js, so recovery emails go out without depending on a
// server cron job (the old setup only worked if someone had configured a cron entry correctly, and it ran every 20
// minutes). Runs a scan every 5 minutes. It is safe next to an external cron job or several processes: every cart
// is claimed atomically before it is emailed, so nobody gets the same email twice.

import { sendAbandonedCartRecoveryEmails } from './abandonedCartService';

const INTERVAL_MS = 5 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60 * 1000;

export function startAbandonedCartScheduler() {
  const off = String(process.env.DISABLE_INTERNAL_SCHEDULER || '').toLowerCase();
  if (off === '1' || off === 'true') {
    console.log('[Scheduler] Abandoned cart scheduler disabled by DISABLE_INTERNAL_SCHEDULER');
    return false;
  }
  if (globalThis.__pairoAbandonedCartScheduler) return false; // already running in this process
  globalThis.__pairoAbandonedCartScheduler = true;

  let running = false;
  const tick = async () => {
    if (running) return; // never let two scans overlap in one process
    running = true;
    try {
      const r = await sendAbandonedCartRecoveryEmails({ trigger: 'scheduler' });
      if (r.scanned > 0) console.log(`[Scheduler] Abandoned cart scan: scanned=${r.scanned} sent=${r.sent} failed=${r.failed}`);
    } catch (err) {
      console.error('[Scheduler] Abandoned cart scan failed:', err && err.message);
    } finally {
      running = false;
    }
  };

  const first = setTimeout(tick, FIRST_RUN_DELAY_MS);
  const loop = setInterval(tick, INTERVAL_MS);
  if (first.unref) first.unref();
  if (loop.unref) loop.unref();
  console.log('[Scheduler] Abandoned cart recovery scheduler started (scans every 5 minutes)');
  return true;
}
