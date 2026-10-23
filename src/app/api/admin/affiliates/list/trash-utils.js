// Pure helpers for the affiliates Trash (no DB, no React) so they can be unit-tested.

// Before the Trash existed, "delete" renamed an affiliate's unique fields to
// "<email>-deleted-<timestamp>" / "<CODE>-DELETED-<timestamp>". Restoring such a record
// gives it back its original value.
export function stripDeletedSuffix(value) {
  if (typeof value !== "string") return value;
  return value.replace(/-deleted-\d+$/i, "");
}

/**
 * Reasons an affiliate can't be deleted permanently. Commissions, payouts, ledger entries,
 * referred orders and any money owed/earned are financial history that must be kept, so an
 * affiliate with any of them stays in the Trash (suspended) instead. Empty array = safe.
 */
export function permanentDeleteBlockers({ commissions = 0, payouts = 0, ledger = 0, orders = 0, balance = 0, lifetimeEarnings = 0 } = {}) {
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const reasons = [];
  if (commissions > 0) reasons.push(plural(commissions, "commission"));
  if (payouts > 0) reasons.push(plural(payouts, "payout"));
  if (ledger > 0) reasons.push(plural(ledger, "ledger entry").replace("entrys", "entries"));
  if (orders > 0) reasons.push(plural(orders, "referred order"));
  if (Number(balance) !== 0) reasons.push("a non-zero balance");
  if (Number(lifetimeEarnings) > 0) reasons.push("lifetime earnings");
  return reasons;
}

// ["a", "b", "c"] -> "a, b and c"
export function joinReasons(reasons) {
  if (reasons.length <= 1) return reasons.join("");
  return `${reasons.slice(0, -1).join(", ")} and ${reasons[reasons.length - 1]}`;
}

export function blockersMessage(reasons) {
  if (!reasons.length) return "";
  return `This affiliate has ${joinReasons(reasons)}. That history is kept for your records, so the affiliate stays in the Trash (suspended, unable to log in or earn) instead of being deleted.`;
}
