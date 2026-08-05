import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Discount from "@/models/Discount";
import Order from "@/models/Order";
import Engine from "@/lib/promotionEngine/Engine";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { validateLegacyDiscount, calculateEligibleSubtotal } from "@/lib/couponValidator";

export async function POST(req) {
  try {
    await dbConnect();
    const { code, cartSubtotal, items = [], email: requestEmail } = await req.json();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    const email = requestEmail || session?.user?.email || null;

    // Resolve customerType (guest vs logged_in vs new vs returning)
    let customerType = 'guest';
    if (userId) {
      customerType = 'logged_in';
    }

    const emailToSearch = email || "";
    const orConditions = [];
    if (userId) orConditions.push({ "customer.userId": userId });
    if (emailToSearch) orConditions.push({ "customer.email": emailToSearch.toLowerCase().trim() });

    if (orConditions.length > 0) {
      const orderCount = await Order.countDocuments({
        $or: orConditions,
        status: { $nin: ['Cancelled', 'Refunded'] }
      });
      if (orderCount > 0) {
        customerType = 'returning';
      } else {
        customerType = userId ? 'logged_in' : 'new';
      }
    }

    // 1. Try the new Enterprise Promotion Engine first
    const engineResults = await Engine.evaluate(
      { subtotal: cartSubtotal, items }, 
      { 
        couponCodes: code ? [code] : [],
        userId,
        email,
        customerType
      }
    );
    
    // If a coupon code was provided, check if it was successfully applied
    if (code) {
      const couponApplied = engineResults.appliedPromotions.find(
        p => p.code && p.code.toUpperCase() === code.toUpperCase()
      );

      if (couponApplied) {
        return NextResponse.json({
          success: true,
          appliedPromotions: engineResults.appliedPromotions,
          discountAmount: engineResults.discountTotal,
          freeShipping: engineResults.freeShipping,
          isEnterprise: true
        });
      }

      // 2. Fallback to Legacy Discount model for backward compatibility
      const discount = await Discount.findOne({ 
        code: code.toUpperCase(), 
        isActive: true,
        isDeleted: false 
      });

      if (discount) {
          const validation = await validateLegacyDiscount(discount, {
            cartSubtotal,
            items,
            userId,
            email
          });

          if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
          }
      
          const eligibleSubtotal = await calculateEligibleSubtotal(discount, items);
          let discountAmount = discount.type === 'percentage' 
            ? (eligibleSubtotal * discount.value) / 100 
            : discount.value;
      
          return NextResponse.json({
            success: true,
            appliedPromotions: [{
              code: discount.code,
              title: `Discount Code: ${discount.code}`,
              type: discount.type,
              value: discount.value,
              discountAmount: Math.min(discountAmount, eligibleSubtotal)
            }],
            discountAmount: Math.min(discountAmount, eligibleSubtotal),
            isLegacy: true
          });
      }

      return NextResponse.json({ error: "Invalid or expired promo code" }, { status: 404 });
    }

    // If no coupon code was entered, return any applied automatic promotions
    return NextResponse.json({
      success: true,
      appliedPromotions: engineResults.appliedPromotions,
      discountAmount: engineResults.discountTotal,
      freeShipping: engineResults.freeShipping,
      isEnterprise: true
    });

  } catch (error) {
    console.error("Coupon Validation Error:", error);
    return NextResponse.json({ error: "Failed to validate promo code" }, { status: 500 });
  }
}
