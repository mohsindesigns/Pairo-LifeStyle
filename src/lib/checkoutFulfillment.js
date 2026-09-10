import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Customer from "@/models/Customer";
import Counter from "@/models/Counter";
import pairoEvents from "@/lib/events";
import { computeAuthoritativeCheckout } from "@/lib/checkoutPricing";
import { resolveAuthoritativePrice } from "@/lib/productPricing";
import { CommissionEngine } from "@/lib/affiliate/CommissionEngine";
import { sendPinterestPurchaseEvent } from "@/lib/pinterestCapi";
import {
  buildGuestCheckoutAccountPayload,
  resolveGuestCheckoutCustomerAction,
} from "@/lib/guestCheckoutAccount";

/**
 * Ensures the per-tenant order-number counter exists, seeded from the highest existing
 * order number so numbering stays continuous with any orders created before this counter
 * was introduced. Idempotent and safe to call concurrently (a duplicate-key from a racing
 * seed is harmless). Runs OUTSIDE the order transaction so first-ever concurrent orders
 * don't collide on the counter's insert.
 */
async function ensureOrderCounter(tenantId) {
  const counterId = `order:${tenantId}`;
  const existing = await Counter.findById(counterId);
  if (existing) return;

  const lastOrder = await Order.findOne({ tenantId }).sort({ createdAt: -1 }).select("orderNumber");
  const lastSeq = parseInt(String(lastOrder?.orderNumber || "").match(/(\d+)\s*$/)?.[1] || "1000", 10);
  try {
    await Counter.updateOne(
      { _id: counterId },
      { $setOnInsert: { seq: Number.isFinite(lastSeq) ? lastSeq : 1000 } },
      { upsert: true }
    );
  } catch (e) {
    // Another concurrent checkout seeded it first — that's fine.
    if (e?.code !== 11000) throw e;
  }
}

export async function createOrderFromCheckoutPayload(payload, {
  tenantId,
  orderUserId = null,
  checkoutEmail = "",
  isGuestSession = true,
  ipAddress = "unknown",
  paymentInfo = null,
  clientUserAgent = null,
} = {}) {
  const { items, shippingAddress, financials, customerEmail, customerNote, idempotencyKey, shippingSnapshot, referralCode } = payload;

  await dbConnect();
  await ensureOrderCounter(tenantId);
  const mongoSession = await mongoose.startSession();
  let checkoutResult = null;

  try {
    await mongoSession.withTransaction(async () => {
      const pricing = await computeAuthoritativeCheckout({
        items,
        financials,
        referralCode,
        checkoutEmail,
        orderUserId,
        tenantId,
        shippingAddress,
        shippingSnapshot,
        mongoSession,
        dryRun: false,
        ipAddress,
      });

      const {
        authoritativeSubtotal,
        finalAppliedPromotions,
        finalDiscountTotal,
        affiliateId,
        affiliateReferralCode,
        activeAffiliate,
        affiliateDiscountType,
        affiliateDiscountValue,
        affiliateDiscountAmount,
        authoritativeShippingCost,
        authoritativeTax,
        authoritativeTotal,
      } = pricing;

      const orderItems = [];
      for (const item of items) {
        const product = await Product.findOne({ _id: item.id || item._id, tenantId }).session(mongoSession);
        if (!product) throw new Error(`Product ${item.id} not found.`);

        if (product.productType === "variable" && Array.isArray(product.attributes) && product.attributes.length > 0) {
          const isMadeToMeasure = !!item.madeToMeasure?.enabled;
          const missingAttrs = product.attributes.filter((attr) => {
            // Made-to-measure orders replace the standard Size selection with custom measurements.
            if (isMadeToMeasure && attr.name.toLowerCase().includes("size")) return false;
            return !item.selectedOptions?.[attr.name];
          });
          if (missingAttrs.length > 0) {
            throw new Error(`Please select ${missingAttrs.map((a) => a.name).join(" and ")} for "${product.name}" before checkout.`);
          }
        }

        if (product.manageStock) {
          const invRes = await Product.findOneAndUpdate(
            { _id: product._id, tenantId, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } },
            { session: mongoSession, new: true }
          );
          if (!invRes) throw new Error(`Insufficient stock for ${product.name}`);
        }

        const selectedOptions = item.selectedOptions && Object.keys(item.selectedOptions).length > 0
          ? item.selectedOptions
          : null;
        const variantTitle = selectedOptions
          ? (product.attributes || []).map(a => selectedOptions[a.name]).filter(Boolean).join(" / ")
            || Object.values(selectedOptions).join(" / ")
          : null;

        orderItems.push({
          productId: product._id,
          name: product.name,
          sku: product.sku,
          image: item.image || product.images?.[0] || product.image,
          priceAtPurchase: resolveAuthoritativePrice(product, item),
          quantity: item.quantity,
          ...(variantTitle ? { selectedVariant: { title: variantTitle, options: selectedOptions } } : {}),
          ...(item.madeToMeasure?.enabled ? { madeToMeasure: item.madeToMeasure } : {}),
          ...(item.customization?.enabled ? { customization: item.customization } : {})
        });
      }

      // Atomic, race-safe order number. Two concurrent checkouts $inc the same counter doc,
      // which produces a WriteConflict (retried by withTransaction / the checkout route's
      // retry loop) rather than the duplicate order numbers that countDocuments+1 allowed.
      const bumped = await Counter.findByIdAndUpdate(
        `order:${tenantId}`,
        { $inc: { seq: 1 } },
        { session: mongoSession, new: true, upsert: true }
      );
      const orderNumber = `PAI-${bumped.seq}`;

      // Shipping cost is no longer taken from the client at all — computeAuthoritativeCheckout
      // above already re-derived it from the real ShippingZone/ShippingMethod config and threw
      // if the selected method wasn't actually available, so there's nothing further to verify here.

      const isPaid = paymentInfo?.status === 'Paid';
      const initialStatus = isPaid ? 'Confirmed' : 'Pending';
      const initialMessage = isPaid
        ? 'Payment confirmed via Card. Order is being processed.'
        : 'Order placed successfully. Pending confirmation.';

      const orderDoc = {
        tenantId,
        orderNumber,
        idempotencyKey,
        status: initialStatus,
        timeline: [{
          status: initialStatus,
          message: initialMessage,
          source: "System"
        }],
        items: orderItems,
        affiliateId,
        affiliateReferralCode,
        financials: {
          subtotal:              authoritativeSubtotal,
          shippingCost:          authoritativeShippingCost,
          tax:                   authoritativeTax,
          discountTotal:         finalDiscountTotal,
          affiliateDiscountType,
          affiliateDiscountValue,
          affiliateDiscountAmount,
          total:                 authoritativeTotal,
          currency:              financials.currency || 'USD',
          promoCode:             financials.promoCode || null,
          appliedPromotions:     finalAppliedPromotions
        },
        customer: {
          userId: orderUserId,
          email: customerEmail || checkoutEmail,
          isGuest: isGuestSession,
          ipAddress
        },
        shippingAddress,
        shippingSnapshot: shippingSnapshot ?? null,
        customerNote
      };

      if (paymentInfo) {
        orderDoc.payment = {
          method: paymentInfo.method || 'Card',
          status: paymentInfo.status || 'Pending',
          provider: paymentInfo.provider || 'stripe',
          stripePaymentIntentId: paymentInfo.stripePaymentIntentId || null,
          stripeChargeId: paymentInfo.stripeChargeId || null,
          receiptUrl: paymentInfo.receiptUrl || null,
          paidAt: paymentInfo.paidAt || null,
        };
      }

      const [newOrder] = await Order.create([orderDoc], { session: mongoSession });

      let guestAccountInfo = null;
      const checkoutName = shippingAddress?.fullName || checkoutEmail.split("@")[0] || "Customer";

      if (isGuestSession && checkoutEmail) {
        const existingCustomer = await Customer.findOne({ email: checkoutEmail }).session(mongoSession);
        const action = resolveGuestCheckoutCustomerAction({
          existingCustomer,
          customerEmail: checkoutEmail,
          shippingAddress,
          customerName: checkoutName,
        });

        if (action.shouldCreateAccount) {
          const accountPayload = buildGuestCheckoutAccountPayload({
            customerEmail: checkoutEmail,
            shippingAddress,
            customerName: checkoutName,
          });

          const [createdCustomer] = await Customer.create([{
            ...accountPayload,
            password: await bcrypt.hash(accountPayload.password, 12),
            emailVerified: true,
          }], { session: mongoSession });

          await Order.updateOne(
            { _id: newOrder._id },
            {
              $set: {
                "customer.userId": createdCustomer._id,
                "customer.isGuest": false,
              }
            },
            { session: mongoSession }
          );

          newOrder.customer.userId = createdCustomer._id;
          newOrder.customer.isGuest = false;
          guestAccountInfo = {
            created: true,
            loginEmail: createdCustomer.email,
            temporaryPassword: accountPayload.password,
            loginUrl: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://yourdomain.com"}/login`,
          };
        } else if (existingCustomer) {
          await Order.updateOne(
            { _id: newOrder._id },
            {
              $set: {
                "customer.userId": existingCustomer._id,
                "customer.isGuest": false,
              }
            },
            { session: mongoSession }
          );

          newOrder.customer.userId = existingCustomer._id;
          newOrder.customer.isGuest = false;
        }
      }

      if (guestAccountInfo) {
        newOrder.guestAccount = guestAccountInfo;
      }

      checkoutResult = newOrder;

      if (affiliateId && activeAffiliate) {
        await CommissionEngine.calculateCommission(checkoutResult, activeAffiliate, mongoSession);
      }
    });
  } finally {
    await mongoSession.endSession();
  }

  if (checkoutResult) {
    pairoEvents.dispatch('ORDER_CREATED', checkoutResult);
    // Server-side Pinterest purchase conversion (Conversions API). Fire-and-forget — never
    // awaited so it can't slow or break checkout; no-ops unless PINTEREST_* env vars are set.
    // Dedupes with the browser pixel via a shared event_id (`checkout_<orderNumber>`).
    sendPinterestPurchaseEvent(checkoutResult, { clientIp: ipAddress, clientUserAgent }).catch(() => {});
  }

  return checkoutResult;
}
