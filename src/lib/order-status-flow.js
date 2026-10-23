// Order status moves forward one step at a time so no fulfilment step is skipped.
// Cancelling is allowed from any active status, and a cancelled order can be marked Refunded.

export const ORDER_STATUS_FLOW = ["Pending", "Confirmed", "Processing", "Packed", "Shipped", "Out for Delivery", "Delivered"];

export function nextOrderStatus(status) {
  const i = ORDER_STATUS_FLOW.indexOf(status);
  return i >= 0 && i < ORDER_STATUS_FLOW.length - 1 ? ORDER_STATUS_FLOW[i + 1] : null;
}

/** Returns null when the change is allowed, otherwise a message explaining why not. */
export function orderStatusChangeError(from, to) {
  if (!to || to === from) return null;
  if (to === "Cancelled") {
    return from === "Refunded" ? "A refunded order can't be cancelled." : null;
  }
  if (to === "Refunded") {
    return from === "Cancelled" ? null : "Only a cancelled order can be marked Refunded here. Use the refund form to refund money.";
  }
  const next = nextOrderStatus(from);
  if (next === to) return null;
  return next
    ? `Orders move one step at a time: the next status after ${from} is ${next}.`
    : `A ${from} order can't be moved to ${to}.`;
}
