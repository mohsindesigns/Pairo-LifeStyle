import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Discount from "@/models/Discount";
import Engine from "@/lib/promotionEngine/Engine";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { validateLegacyDiscount, calculateEligibleSubtotal } from "@/lib/couponValidator";

export async function POST(req) {
  try {
    await dbConnect();
    const { code, cartSubtotal, items = [], email: requestEmail } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    // 1. Try the new Enterprise Promotion Engine first
    const engineResults = await Engine.evaluate({ subtotal: cartSubtotal, items }, { couponCodes: [code] });
    
    if (engineResults.appliedPromotions.length > 0) {
      const applied = engineResults.appliedPromotions[0];
      return NextResponse.json({
        success: true,
        code: applied.code,
        type: applied.type,
        value: applied.value,
        discountAmount: applied.discountAmount,
        explanation: applied.explanation,
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
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id || null;
        const email = requestEmail || session?.user?.email || null;

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
          code: discount.code,
          type: discount.type,
          value: discount.value,
          minPurchase: discount.minPurchase || 0,
          discountAmount: Math.min(discountAmount, eligibleSubtotal),
          isLegacy: true
        });
    }

    return NextResponse.json({ error: "Invalid or expired promo code" }, { status: 404 });

  } catch (error) {
    console.error("Coupon Validation Error:", error);
    return NextResponse.json({ error: "Failed to validate promo code" }, { status: 500 });
  }
}
