import crypto from 'crypto';
import dbConnect from './db';
import Order from '@/models/Order';
import SizeConfirmation from '@/models/SizeConfirmation';
import { sendSizeConfirmationEmail, getFromAddress } from './email';
import { resolveOrderSizeCharts } from './orderSizeCharts';

const inFlight = new Set();

function isAutoEnabled() {
  return !['off', 'false', '0', 'disabled'].includes(String(process.env.SIZE_CONFIRMATION_AUTO || '').toLowerCase());
}

/**
 * Builds the email (with each ordered product's size chart), sends it, records
 * the SizeConfirmation used for reply tracking, and notes it on the order timeline.
 */
export async function sendSizeConfirmationForOrder(order, { sentBy = 'Admin', auto = false, sizeChartImageUrl, charts } = {}) {
  await dbConnect();
  const resolvedCharts = charts || (await resolveOrderSizeCharts(order));

  // Our own Message-ID so replies can be matched back via In-Reply-To.
  const domainMatch = getFromAddress().match(/@([^>\s]+)/);
  const domain = domainMatch ? domainMatch[1] : 'pairolifestyle.com';
  const messageId = `<sizeconf-${crypto.randomBytes(12).toString('hex')}@${domain}>`;

  const sent = await sendSizeConfirmationEmail(order, { sizeChartImageUrl, charts: resolvedCharts, messageId });

  const confirmation = await SizeConfirmation.create({
    orderId: order._id,
    orderNumber: String(order.orderNumber),
    customerName: order.shippingAddress?.fullName || '',
    customerEmail: order.customer.email,
    subject: sent.subject,
    messageId: sent.messageId,
    sizeChartImageUrl,
    chartLabels: resolvedCharts.map((c) => c.heading),
    sentBy,
    auto,
  });

  await Order.updateOne(
    { _id: order._id },
    {
      $push: {
        timeline: {
          status: order.status,
          message: `Size confirmation ${auto ? 'sent automatically' : 'emailed'} to ${order.customer.email}${resolvedCharts.length ? ` (with ${resolvedCharts.length} size chart${resolvedCharts.length > 1 ? 's' : ''})` : ''}.`,
          source: auto ? 'System' : 'Admin',
        },
      },
    }
  );

  return confirmation;
}

/**
 * Called when an order is received/paid. Sends the size confirmation email once
 * per order, but only if the order is paid, has a customer email, and contains
 * at least one product that has a size chart. Never throws.
 */
export async function autoSendSizeConfirmation(orderLike) {
  try {
    if (!isAutoEnabled() || !orderLike?._id) return { sent: false, reason: 'disabled' };
    const key = String(orderLike._id);
    if (inFlight.has(key)) return { sent: false, reason: 'in-flight' };
    inFlight.add(key);

    try {
      await dbConnect();
      const order = await Order.findById(orderLike._id);
      if (!order) return { sent: false, reason: 'no-order' };
      if (!order.customer?.email) return { sent: false, reason: 'no-email' };
      // Fire on order creation regardless of payment status for real customer-facing payment
      // methods (COD orders are created with payment.status 'Pending' and otherwise never got
      // this email automatically) — but skip a payment that's already known to have failed
      // outright, and skip an admin-created Manual/Gift order still awaiting payment, since
      // asking a customer to confirm their size before the admin has even confirmed the order
      // will actually be fulfilled is premature (COD doesn't have this ambiguity — the order is
      // already committed to shipping regardless of payment status).
      if (order.payment?.status === 'Failed') return { sent: false, reason: 'payment-failed' };
      if (order.payment?.method === 'Manual/Gift' && order.payment?.status === 'Pending') {
        return { sent: false, reason: 'manual-order-pending-payment' };
      }
      if (['Cancelled', 'Refunded'].includes(order.status)) return { sent: false, reason: 'cancelled' };
      if (await SizeConfirmation.exists({ orderId: order._id })) return { sent: false, reason: 'already-sent' };

      const charts = await resolveOrderSizeCharts(order);
      if (charts.length === 0) return { sent: false, reason: 'no-size-chart' };

      await sendSizeConfirmationForOrder(order, { sentBy: 'Automatic', auto: true, charts });
      console.log(`[SizeConfirmation] Auto-sent for order #${order.orderNumber}`);
      return { sent: true };
    } finally {
      inFlight.delete(key);
    }
  } catch (err) {
    console.error('[SizeConfirmation] Auto-send failed:', err.message);
    return { sent: false, reason: 'error', error: err.message };
  }
}
