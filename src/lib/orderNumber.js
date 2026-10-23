import Order from "@/models/Order";
import Counter from "@/models/Counter";

const COUNTER_ID = "order:global";
const MAX_SKIPS = 50;

/**
 * Ensures the order-number counter exists, seeded from the highest existing
 * order number so numbering stays continuous with any orders created before this counter
 * was introduced. Idempotent and safe to call concurrently (a duplicate-key from a racing
 * seed is harmless). Runs OUTSIDE the order transaction so first-ever concurrent orders
 * don't collide on the counter's insert.
 */
export async function ensureOrderCounter() {
  const existing = await Counter.findById(COUNTER_ID);
  if (existing) return;

  const lastOrder = await Order.findOne().sort({ createdAt: -1 }).select("orderNumber");
  const lastSeq = parseInt(String(lastOrder?.orderNumber || "").match(/(\d+)\s*$/)?.[1] || "1000", 10);
  try {
    await Counter.updateOne(
      { _id: COUNTER_ID },
      { $setOnInsert: { seq: Number.isFinite(lastSeq) ? lastSeq : 1000 } },
      { upsert: true }
    );
  } catch (e) {
    // Another concurrent checkout seeded it first — that's fine.
    if (e?.code !== 11000) throw e;
  }
}

/**
 * Atomic, race-safe order number generation, shared by customer checkout, admin-created orders,
 * duplicated orders, custom-jacket orders and customization requests so numbering stays
 * single-sourced. Two concurrent callers $inc the same counter doc, which produces a
 * WriteConflict (retried by the caller's transaction) rather than duplicate order numbers.
 *
 * Order numbers are unique, so a number that is already taken (made by older code that counted
 * documents, or left ahead of the counter by a restore) is skipped instead of failing the order
 * with a duplicate-key error. That also moves the counter past it, so the drift heals itself.
 */
export async function getNextOrderNumber(mongoSession = null) {
  await ensureOrderCounter();
  for (let attempt = 0; attempt < MAX_SKIPS; attempt++) {
    const bumped = await Counter.findByIdAndUpdate(
      COUNTER_ID,
      { $inc: { seq: 1 } },
      { session: mongoSession, new: true, upsert: true }
    );
    const orderNumber = `PAI-${bumped.seq}`;
    const taken = await Order.exists({ orderNumber }).session(mongoSession);
    if (!taken) return orderNumber;
  }
  throw new Error("Could not allocate an order number. Please try again.");
}
