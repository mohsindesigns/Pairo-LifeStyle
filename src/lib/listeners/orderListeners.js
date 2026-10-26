import pairoEvents from '../events';
import QueueService from '../queue';
import { sendOrderConfirmation, sendAdminOrderNotification } from '../email';
import { dispatchOrderToCRM } from '../crmWebhook';
import { autoSendSizeConfirmation } from '../sizeConfirmationService';

/**
 * Initialize Order Listeners
 */
export function initOrderListeners() {
  // 1. ORDER_CREATED
  pairoEvents.on('ORDER_CREATED', async (payload) => {
    try {
        const order = payload?.order || payload;
        if (!order) return;
        const origin = payload?.origin;
        // Orders the CRM creates only email the customer when it asks for it (sendConfirmation).
        const skipEmails = payload?.skipEmails === true;
        console.log(`[Event Received] ORDER_CREATED: ${order.orderNumber}`);
        // Email Customer — must complete (and the temp password must still be present) before
        // the password is stripped below, so this one stays sequential and first.
        if (!skipEmails) await sendOrderConfirmation(order).catch(e => console.error("Email Cust Error:", e.message));
        if (order?.guestAccount?.temporaryPassword) {
          delete order.guestAccount.temporaryPassword;
        }

        // None of these three depend on each other (or on the temp password, now stripped),
        // so they run concurrently instead of stacking each call's latency on top of the last.
        await Promise.allSettled([
          sendAdminOrderNotification(order).catch(e => console.error("Email Admin Error:", e.message)),
          // Ask the customer to confirm their jacket size (includes each product's size chart).
          // Fires for any new order (COD/Pending included) that contains a product with a size
          // chart, once per order — skipped only if the payment already failed outright.
          skipEmails ? null : autoSendSizeConfirmation(order),
          dispatchOrderToCRM('ORDER_CREATED', order, { origin }).catch(e => console.error("CRM Webhook Error:", e.message)),
        ]);
    } catch (err) {
        console.error("Order created listener error:", err);
    }
  });

  // 2. ORDER_CANCELLED
  pairoEvents.on('ORDER_CANCELLED', (payload) => {
     const order = payload?.order || payload;
     if (!order) return;
     QueueService.push('SEND_CANCELLATION_EMAIL', async () => {
        console.log(`Sending cancellation email for order ${order.orderNumber}`);
     }, { retries: 3, referenceId: order._id });

     dispatchOrderToCRM('ORDER_CANCELLED', order, { origin: payload?.origin }).catch(e => console.error("CRM Cancel Webhook Error:", e.message));
  });

  // 3. ORDER_STATUS_UPDATED
  pairoEvents.on('ORDER_STATUS_UPDATED', (payload) => {
    const order = payload?.order || payload;
    if (!order) return;
    const oldStatus = payload?.oldStatus || order?.status;
    const newStatus = payload?.newStatus || order?.status;
    console.log(`Order ${order.orderNumber} status changed from ${oldStatus} to ${newStatus}`);
    dispatchOrderToCRM('ORDER_STATUS_UPDATED', order, { origin: payload?.origin, extra: { oldStatus, newStatus } }).catch(e => console.error("CRM Status Webhook Error:", e.message));
  });

  // 4. The rest of what can change on an order. The CRM gets every one, so it never has to poll to stay in sync.
  for (const event of ['ORDER_PAYMENT_UPDATED', 'ORDER_UPDATED', 'ORDER_DELETED', 'ORDER_RESTORED']) {
    pairoEvents.on(event, (payload) => {
      const order = payload?.order || payload;
      if (!order) return;
      const extra = {};
      if (payload?.fields) extra.fields = payload.fields;
      if (payload?.oldPaymentStatus !== undefined) { extra.oldPaymentStatus = payload.oldPaymentStatus; extra.newPaymentStatus = payload.newPaymentStatus; }
      dispatchOrderToCRM(event, order, { origin: payload?.origin, extra }).catch(e => console.error(`CRM ${event} Webhook Error:`, e.message));
    });
  }

  console.log("✔ Order Listeners Initialized");
}
