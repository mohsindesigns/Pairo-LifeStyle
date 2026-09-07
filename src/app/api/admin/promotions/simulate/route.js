import { NextResponse } from 'next/server';
import Engine from '@/lib/promotionEngine/Engine';

export async function POST(req) {
    try {
        const { promotion, cart } = await req.json();

        if (!promotion || !cart) {
            return NextResponse.json({ error: 'Promotion and Cart data required' }, { status: 400 });
        }

        // Load other active promotions to test conflicts
        const { default: Loader } = await import('@/lib/promotionEngine/Loader');
        const otherPromos = await Loader.loadPromotions([]);
        
        // Filter out the current promo if it's already in the DB to avoid duplicates
        const activePromotions = [
            promotion,
            ...otherPromos.filter(p => p._id.toString() !== promotion._id?.toString())
        ];

        const context = {
            customerType: cart.customerType,
            userId: cart.userId,
            email: cart.email
        };

        const results = await Engine.evaluate(cart, {
            activePromotions,
            skipDb: true,
            ...context
        });

        // Extract the result for our specific promotion
        // Since we only passed one, it's the only one that could be in appliedPromotions or rejected
        const isEligible = results.appliedPromotions.some(p => p.title === promotion.title);

        // We need to get the detailed metadata from the ConditionEvaluator directly
        // because the Engine usually abstracts it away for the final checkout result.
        const { default: ConditionEvaluator } = await import('@/lib/promotionEngine/ConditionEvaluator');
        const evaluation = ConditionEvaluator.evaluate(promotion, cart, context);

        return NextResponse.json({
            isEligible,
            discountTotal: results.discountTotal,
            appliedPromotions: results.appliedPromotions,
            debugMetadata: evaluation.debugMetadata,
            explanation: evaluation.explanation
        });

    } catch (err) {
        console.error('Simulation API Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
