/**
 * Resolves conflicts between multiple eligible promotions.
 * Handles exclusivity, stacking rules, and "Best Discount Wins" logic.
 */
export default class ConflictResolver {
  /**
   * Resolves conflicts and returns a filtered/sorted list of promotions to apply.
   * @param {Array} eligiblePromotions - Array of { promotion, evaluation, execution }
   * @returns {Array} List of promotions that should actually be applied.
   */
  static resolve(eligiblePromotions) {
    if (eligiblePromotions.length <= 1) return eligiblePromotions;

    console.log(`[Engine:ConflictResolver] Resolving conflicts for ${eligiblePromotions.length} eligible promotions`);

    // 1. Deterministic Sort Hierarchy:
    // Tier 1: Priority (DESC) - Highest business priority wins
    // Tier 2: Discount Amount (DESC) - Best value for customer wins
    // Tier 3: Promotion ID (ASC) - Immutable tie-breaker for distributed consistency
    const sorted = [...eligiblePromotions].sort((a, b) => {
        // Priority check
        if (b.promotion.priority !== a.promotion.priority) {
            return b.promotion.priority - a.promotion.priority;
        }
        
        // Discount amount check
        if (b.execution.discountAmount !== a.execution.discountAmount) {
            return b.execution.discountAmount - a.execution.discountAmount;
        }

        // Final Tie-breaker: ID string comparison
        const idA = a.promotion._id?.toString() || '';
        const idB = b.promotion._id?.toString() || '';
        return idA.localeCompare(idB);
    });

    const applied = [];
    let hasAppliedExclusive = false;
    let hasAppliedNonStackable = false;

    for (const item of sorted) {
      const { promotion } = item;

      // Rule: If an exclusive promotion has already been applied, stop.
      if (hasAppliedExclusive) {
          console.log(`[Engine:ConflictResolver] Skipping "${promotion.title}" - Exclusive promotion already applied.`);
          continue;
      }

      // Rule: If this promotion is exclusive, it can only be applied if it's the FIRST one.
      // Since we sorted by priority, if this is exclusive, we stop after applying it.
      if (promotion.exclusive) {
          if (applied.length === 0) {
              applied.push(item);
              hasAppliedExclusive = true;
              console.log(`[Engine:ConflictResolver] Applying EXCLUSIVE: "${promotion.title}"`);
          } else {
              console.log(`[Engine:ConflictResolver] Skipping EXCLUSIVE "${promotion.title}" - Other promotions already applied.`);
          }
          continue;
      }

      // Rule: Stacking Logic
      // Enterprise rule: To stack, BOTH the already-applied promotion(s) and this
      // one must be stackable. So once anything has applied, a non-stackable
      // promotion (already applied or being considered now) blocks combining.
      if (applied.length > 0 && (hasAppliedNonStackable || !promotion.stackable)) {
          console.log(`[Engine:ConflictResolver] Skipping "${promotion.title}" - Stacking conflict (Non-stackable already applied or this promotion is not stackable).`);
          continue;
      }

      // Apply the promotion
      applied.push(item);
      if (!promotion.stackable) {
          hasAppliedNonStackable = true;
      }
      
      console.log(`[Engine:ConflictResolver] Applied: "${promotion.title}" (Stackable: ${promotion.stackable})`);
    }

    return applied;
  }
}
