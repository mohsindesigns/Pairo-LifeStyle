/**
 * Evaluates whether a promotion is applicable to a specific cart and user context.
 * Supports recursive rule groups (AND/OR/NOT) and detailed eligibility explanations.
 */
export default class ConditionEvaluator {
  static MAX_DEPTH = 5;

  /**
   * @param {Object} promotion - The promotion model instance
   * @param {Object} cart - The cart object (subtotal, items, etc.)
   * @param {Object} context - Additional context (user, IP, date, etc.)
   */
  static evaluate(promotion, cart, context) {
    console.log(`[Engine:Evaluator] Evaluating: "${promotion.title}"`);
    
    // If no conditions defined, it's eligible by default
    if (!promotion.conditions || Object.keys(promotion.conditions).length === 0) {
      return { isEligible: true, explanation: "No conditions required." };
    }

    // Support both Legacy flat conditions (Phase 1) and Recursive trees (Phase 2)
    if (promotion.conditions.minCartValue && !promotion.conditions.operator) {
      const isEligible = cart.subtotal >= promotion.conditions.minCartValue;
      return {
        isEligible,
        explanation: isEligible 
          ? "Eligible for application" 
          : `Minimum subtotal of $${promotion.conditions.minCartValue} required.`
      };
    }

    try {
      // If it's a single rule (has field/op) but not wrapped in a group
      if (promotion.conditions.field && promotion.conditions.op && !promotion.conditions.rules) {
        const result = this.evaluateRule(promotion.conditions, cart, context);
        return {
          isEligible: result.passed,
          explanation: result.explanation,
          debugMetadata: result
        };
      }

      const result = this.evaluateGroup(promotion.conditions, cart, context, 0);
      return {
        isEligible: result.passed,
        explanation: result.explanation,
        debugMetadata: result.debugMetadata // Useful for Phase 3/4 Debugger
      };
    } catch (error) {
      console.error(`[Engine:Evaluator] Error in recursive evaluation:`, error);
      return { 
        isEligible: false, 
        explanation: "Error evaluating promotion conditions (Safety Guard triggered)." 
      };
    }
  }

  /**
   * Recursively evaluates a group of rules.
   */
  static evaluateGroup(group, cart, context, depth) {
    if (depth > this.MAX_DEPTH) throw new Error("Max recursion depth exceeded");

    const { operator = 'AND', rules = [] } = group;
    const results = rules.map(rule => {
      if (rule.operator) {
        return this.evaluateGroup(rule, cart, context, depth + 1);
      }
      return this.evaluateRule(rule, cart, context);
    });

    if (operator === 'AND') {
      const failed = results.find(r => !r.passed);
      return {
        passed: !failed,
        explanation: failed ? failed.explanation : "All conditions met.",
        debugMetadata: { operator: 'AND', passed: !failed, results }
      };
    }

    if (operator === 'OR') {
      const passed = results.find(r => r.passed);
      return {
        passed: !!passed,
        explanation: passed ? "One of the required conditions met." : "None of the required conditions met.",
        debugMetadata: { operator: 'OR', passed: !!passed, results }
      };
    }

    if (operator === 'NOT') {
        const passed = results.some(r => r.passed);
        return {
            passed: !passed,
            explanation: passed ? "Restricted condition matched." : "Exclusion criteria met.",
            debugMetadata: { operator: 'NOT', passed: !passed, results }
        };
    }

    return { passed: false, explanation: `Unknown operator: ${operator}`, debugMetadata: {} };
  }

  /**
   * Evaluates a single terminal rule.
   */
  static evaluateRule(rule, cart, context) {
    const { field, op, value } = rule;
    let actualValue;

    switch (field) {
      case 'subtotal':
        actualValue = cart.subtotal;
        break;
      case 'items_count':
        actualValue = cart.items?.reduce((acc, i) => acc + i.quantity, 0) || 0;
        break;
      case 'product_id':
        actualValue = cart.items?.map(i => i.productId?.toString() || i.id?.toString()) || [];
        break;
      case 'category_id':
        actualValue = cart.items?.flatMap(i => i.categories || []) || [];
        break;
      case 'collection_id':
        actualValue = cart.items?.flatMap(i => i.collections || []) || [];
        break;
      case 'user_id':
        actualValue = context.userId;
        break;
      case 'customer_type':
        actualValue = context.customerType || 'guest';
        break;
      default:
        return { passed: false, explanation: `Invalid field: ${field}` };
    }

    let passed = false;
    switch (op) {
      case '>': passed = actualValue > value; break;
      case '>=': passed = actualValue >= value; break;
      case '<': passed = actualValue < value; break;
      case '<=': passed = actualValue <= value; break;
      case '==': passed = actualValue == value; break;
      case 'in': 
        passed = Array.isArray(value) 
            ? (Array.isArray(actualValue) ? actualValue.some(v => value.includes(v)) : value.includes(actualValue))
            : false;
        break;
      case 'contains':
        passed = Array.isArray(actualValue) ? actualValue.includes(value) : false;
        break;
      default:
        return { passed: false, explanation: `Invalid operator: ${op}` };
    }

    return {
      passed,
      explanation: passed ? `Rule met: ${field} ${op} ${value}` : `Rule failed: ${field} ${op} ${value}`,
      rule
    };
  }
}
