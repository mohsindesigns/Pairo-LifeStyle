import pairoEvents from '../events';
import QueueService from '../queue';
import { sendOrderConfirmation, sendAdminOrderNotification } from '../email';
import { dispatchOrderToCRM } from '../crmWebhook';

/**
 * Initialize Order Listeners
 */
export function initOrderListeners() {
  // 1. ORDER_CREATED
  pairoEvents.on('ORDER_CREATED', async (order) => {
    try {
        console.log(`[Event Received] ORDER_CREATED: ${order.orderNumber}`);
        // Email Customer
        await sendOrderConfirmation(order).catch(e => console.error("Email Cust Error:", e.message));
        if (order?.guestAccount?.temporaryPassword) {
          delete order.guestAccount.temporaryPassword;
        }
        // Email Admin
        await sendAdminOrderNotification(order).catch(e => console.error("Email Admin Error:", e.message));

        // Push real-time event to CRM
        await dispatchOrderToCRM('ORDER_CREATED', order).catch(e => console.error("CRM Webhook Error:", e.message));
    } catch (err) {
        console.error("Order created listener error:", err);
    }
  });

  // 2. ORDER_CANCELLED
  pairoEvents.on('ORDER_CANCELLED', (order) => {
     QueueService.push('SEND_CANCELLATION_EMAIL', async () => {
        console.log(`Sending cancellation email for order ${order.orderNumber}`);
     }, { retries: 3, referenceId: order._id });

     dispatchOrderToCRM('ORDER_CANCELLED', order).catch(e => console.error("CRM Cancel Webhook Error:", e.message));
  });

  // 3. ORDER_STATUS_UPDATED
  pairoEvents.on('ORDER_STATUS_UPDATED', ({ order, oldStatus, newStatus }) => {
    console.log(`Order ${order.orderNumber} status changed from ${oldStatus} to ${newStatus}`);
    dispatchOrderToCRM('ORDER_STATUS_UPDATED', order).catch(e => console.error("CRM Status Webhook Error:", e.message));
  });

  console.log("✔ Order Listeners Initialized");
}
