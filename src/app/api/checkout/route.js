import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Discount from "@/models/Discount";
import Promotion from "@/models/Promotion";
import Engine from "@/lib/promotionEngine/Engine";
import pairoEvents from "@/lib/events";
import mongoose from "mongoose";
import logger, { getContextLogger, LogCategory } from "@/lib/logger";
import { NextResponse } from "next/server";
import { validateLegacyDiscount, calculateEligibleSubtotal } from "@/lib/couponValidator";

export async function POST(req) {
  let session = null;
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  const tenantId = req.headers.get("x-tenant-id") || "DEFAULT_STORE";
  const log = getContextLogger(correlationId, { path: '/api/checkout', tenantId });

  const MAX_RETRIES = 3;
  let attempt = 0;

  const body = await req.json();
  const { items, shippingAddress, financials, customerEmail, customerNote, idempotencyKey } = body;

  while (attempt < MAX_RETRIES) {
    try {
        log.info({ category: LogCategory.CHECKOUT_TRANSACTION, attempt: attempt + 1 }, "Processing checkout attempt");
        await dbConnect();
        session = await mongoose.startSession();
        
        const authSession = await getServerSession(authOptions);

        // 1. Idempotency Check
        if (idempotencyKey) {
            const existingOrder = await Order.findOne({ idempotencyKey, tenantId });
            if (existingOrder) {
                log.warn({ idempotencyKey, orderNumber: existingOrder.orderNumber }, "Idempotency hit");
                return NextResponse.json({ success: true, orderNumber: existingOrder.orderNumber });
            }
        }

        let checkoutResult = null;

        await session.withTransaction(async () => {
            // 2. Evaluate Engine
            const engineResults = await Engine.evaluate(
                { subtotal: financials.subtotal, items }, 
                { 
                    couponCodes: financials.promoCode ? [financials.promoCode] : [],
                    userId: authSession?.user?.id,
                    tenantId 
                }
            );

            let finalAppliedPromotions = engineResults.appliedPromotions || [];
            let finalDiscountTotal = engineResults.discountTotal || 0;

            // Fallback: Check for legacy discount if engine didn't find any match and a promo code was entered
            if (finalAppliedPromotions.length === 0 && financials.promoCode) {
                const legacyDiscount = await Discount.findOne({
                    code: financials.promoCode.toUpperCase().trim(),
                    isActive: true,
                    isDeleted: false
                }).session(session);

                if (legacyDiscount) {
                    const validation = await validateLegacyDiscount(legacyDiscount, {
                        cartSubtotal: financials.subtotal,
                        items,
                        userId: authSession?.user?.id || null,
                        email: customerEmail || authSession?.user?.email || null
                    });

                    if (!validation.valid) {
                        throw new Error(validation.error);
                    }

                    const eligibleSubtotal = await calculateEligibleSubtotal(legacyDiscount, items);
                    const amount = legacyDiscount.type === 'percentage'
                        ? (eligibleSubtotal * legacyDiscount.value) / 100
                        : legacyDiscount.value;

                    finalDiscountTotal = Math.min(amount, eligibleSubtotal);
                    
                    // Increment legacy usageCount atomically
                    if (legacyDiscount.usageLimit) {
                        const updatedDiscount = await Discount.findOneAndUpdate(
                            {
                                _id: legacyDiscount._id,
                                usageCount: { $lt: legacyDiscount.usageLimit }
                            },
                            { $inc: { usageCount: 1 } },
                            { session, new: true }
                        );
                        if (!updatedDiscount) {
                            throw new Error("Promo code usage limit has been reached.");
                        }
                    } else {
                        await Discount.updateOne(
                            { _id: legacyDiscount._id },
                            { $inc: { usageCount: 1 } },
                            { session }
                        );
                    }

                    finalAppliedPromotions = [{
                        promotionId: legacyDiscount._id,
                        code: legacyDiscount.code,
                        title: `Discount Code: ${legacyDiscount.code}`,
                        type: legacyDiscount.type,
                        value: legacyDiscount.value,
                        discountAmount: finalDiscountTotal,
                        explanation: `Legacy discount code ${legacyDiscount.code} applied`,
                        isLegacy: true
                    }];
                } else {
                    throw new Error("Promo code is invalid or no longer available.");
                }
            }

            // 3. Reserve Promotions
            for (const applied of finalAppliedPromotions) {
                if (applied.isLegacy) continue;
                const promoRes = await Promotion.findOneAndUpdate(
                    { 
                        _id: applied.promotionId,
                        tenantId,
                        adminStatus: 'Active',
                        $or: [
                            { 'usageLimits.maxTotalUses': null },
                            { $expr: { $lt: ['$usageLimits.currentTotalUses', '$usageLimits.maxTotalUses'] } }
                        ]
                    }, 
                    { 
                        $inc: { 
                            'usageLimits.currentTotalUses': 1,
                            'analytics.timesUsed': 1,
                            'analytics.discountDistributed': applied.discountAmount
                        } 
                    },
                    { session, new: true }
                );

                if (!promoRes) throw new Error(`Promotion "${applied.title}" is no longer available.`);
            }

            // 4. Reserve Inventory
            const orderItems = [];
            for (const item of items) {
                const product = await Product.findOne({ _id: item.id || item._id, tenantId }).session(session);
                if (!product) throw new Error(`Product ${item.id} not found.`);

                if (product.manageStock) {
                    const invRes = await Product.findOneAndUpdate(
                        { _id: product._id, tenantId, stock: { $gte: item.quantity } },
                        { $inc: { stock: -item.quantity } },
                        { session, new: true }
                    );
                    if (!invRes) throw new Error(`Insufficient stock for ${product.name}`);
                }

                orderItems.push({
                    productId: product._id,
                    name: product.name,
                    sku: product.sku,
                    image: item.image || product.images?.[0] || product.image,
                    priceAtPurchase: item.price,
                    quantity: item.quantity
                });
            }

            // 5. Create Order
            const count = await Order.countDocuments({ tenantId }, { session });
            const orderNumber = `PAI-${1000 + count + 1}`;

            const [newOrder] = await Order.create([{
                tenantId,
                orderNumber,
                idempotencyKey,
                status: "Confirmed",
                items: orderItems,
                financials: {
                    ...financials,
                    discountTotal: finalDiscountTotal,
                    appliedPromotions: finalAppliedPromotions
                },
                customer: {
                    userId: authSession?.user?.id || null,
                    email: customerEmail || authSession?.user?.email,
                    isGuest: !authSession?.user?.id,
                    ipAddress: req.headers.get("x-forwarded-for") || "unknown"
                },
                shippingAddress,
                customerNote
            }], { session });

            checkoutResult = newOrder;
        });

        if (checkoutResult) {
            log.info({ orderNumber: checkoutResult.orderNumber }, "Checkout success");
            pairoEvents.dispatch('ORDER_CREATED', checkoutResult);
            return NextResponse.json({ success: true, orderNumber: checkoutResult.orderNumber });
        }

    } catch (error) {
        attempt++;
        const isTransient = error.name === 'MongoServerError' && error.code === 112; // WriteConflict/Transient
        
        if (isTransient && attempt < MAX_RETRIES) {
            const delay = Math.pow(2, attempt) * 100;
            log.warn({ attempt, delay }, "Write conflict detected. Retrying...");
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
        }

        log.error({ category: LogCategory.CHECKOUT_TRANSACTION, error: error.message }, "Checkout failed");
        return NextResponse.json({ error: error.message }, { status: 400 });
    } finally {
        if (session) await session.endSession();
    }
  }

  return NextResponse.json({ error: "Max retries exceeded" }, { status: 503 });
}
