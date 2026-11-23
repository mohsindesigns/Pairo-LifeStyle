// Runs once when the Next.js server starts (see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md).
// It must return quickly, so it only schedules background work.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return; // not for the Edge runtime
  if (process.env.NODE_ENV !== 'production') return; // no background jobs while developing
  if (process.env.NEXT_PHASE === 'phase-production-build') return; // never while building

  const { startAbandonedCartScheduler } = await import('./lib/abandonedCartScheduler');
  startAbandonedCartScheduler();
}
