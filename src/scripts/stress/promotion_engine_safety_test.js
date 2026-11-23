import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import mongoose from 'mongoose';
import dbConnect from '../../lib/db.js';
import Engine from '../../lib/promotionEngine/Engine.js';
import ConditionEvaluator from '../../lib/promotionEngine/ConditionEvaluator.js';

async function runSafetyTimeoutTest() {
    console.log("\n🚀 [STRESS] Starting Promotion Engine Safety Verification...");
    await dbConnect();

    // Evaluation Safety Timeout
    console.log("\n[SIM] Testing Evaluation Safety Timeout (50ms limit)...");

    const originalEval = ConditionEvaluator.evaluate;
    ConditionEvaluator.evaluate = () => {
        const start = Date.now();
        while (Date.now() - start < 200) { /* Busy wait 200ms */ }
        return { isEligible: true };
    };

    const cart = { subtotal: 1000, items: [] };
    const start = Date.now();
    const result = await Engine.evaluate(cart, {});
    const duration = Date.now() - start;

    console.log(`[RESULTS] Evaluation returned in ${duration}ms (Applied Promos: ${result.appliedPromotions.length})`);

    // We expect the result to be 0 discount (fallback) and duration to be around 50-70ms
    if (duration < 150 && result.appliedPromotions.length === 0) {
        console.log("✅ [STATUS] SAFETY TIMEOUT VERIFIED: Evaluation killed correctly.");
    } else {
        console.log("❌ [STATUS] TIMEOUT FAILURE: Engine allowed runaway evaluation.");
    }

    // Cleanup
    ConditionEvaluator.evaluate = originalEval;
    await mongoose.connection.close();
    process.exit(0);
}

runSafetyTimeoutTest();
