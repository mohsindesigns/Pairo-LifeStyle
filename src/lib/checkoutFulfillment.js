import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Customer from "@/models/Customer";
import pairoEvents from "@/lib/events";
import { computeAuthoritativeCheckout } from "@/lib/checkoutPricing";
import { CommissionEngine } from "@/lib/affiliate/CommissionEngine";
import {
  buildGuestCheckoutAccountPayload,
  resolveGuestCheckoutCustomerAction,
} from "@/lib/guestCheckoutAccount";

export async function createOrderFromCheckoutPayload(payload, {
  tenantId,
  orderUserId = null,
  checkoutEmail = "",
  isGuestSession = true,
  ipAddress = "unknown",
  paymentInfo = null,
} = {}) {
  const { items, shippingAddress, financials, customerEmail, customerNote, idempotencyKey, shippingSnapshot, referralCode } = payload;

  await dbConnect();
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
        mongoSession,
        dryRun: false,
      });

      const {
        finalAppliedPromotions,
        finalDiscountTotal,
        affiliateId,
        affiliateReferralCode,
        activeAffiliate,
        affiliateDiscountType,
        affiliateDiscountValue,
        affiliateDiscountAmount,
        authoritativeTotal,
      } = pricing;

      const orderItems = [];
      for (const item of items) {
        const product = await Product.findOne({ _id: item.id || item._id, tenantId }).session(mongoSession);
        if (!product) throw new Error(`Product ${item.id} not found.`);

        if (product.manageStock) {
          const invRes = await Product.findOneAndUpdate(
            { _id: product._id, tenantId, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } },
            { session: mongoSession, new: true }
          );
          if (!invRes) throw new Error(`Insufficient stock for ${product.name}`);
        }

        orderItems.push({
          productId: product._id,
          name: product.name,
          sku: product.sku,
          image: item.image || product.images?.[0] || product.image,
          priceAtPurchase: item.price,
          quantity: item.quantity,
          ...(item.madeToMeasure?.enabled ? { madeToMeasure: item.madeToMeasure } : {})
        });
      }

      const count = await Order.countDocuments({ tenantId }, { session: mongoSession });
      const orderNumber = `PAI-${1000 + count + 1}`;

      if (shippingSnapshot && typeof shippingSnapshot.cost === 'number') {
        const declaredShipping = Number(financials.shippingCost ?? 0);
        if (Math.abs(shippingSnapshot.cost - declaredShipping) > 0.01) {
          throw new Error(`Shipping cost mismatch: snapshot says ${shippingSnapshot.cost}, financials says ${declaredShipping}.`);
        }
      }

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
          subtotal:              financials.subtotal,
          shippingCost:          financials.shippingCost || 0,
          tax:                   financials.tax || 0,
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
  }

  return checkoutResult;
}
