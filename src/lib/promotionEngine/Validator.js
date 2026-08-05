/**
 * Safety and validation layer for Promotions.
 * Detects contradictions, circular logic, and structural errors.
 */
export default class Validator {
  static MAX_DEPTH = 5;
  static MAX_NODES = 50;
  static MAX_PAYLOAD_SIZE = 50 * 1024; // 50KB

  /**
   * Performs a comprehensive check of a promotion definition.
   */
  static validate(promotion) {
    const errors = [];
    const warnings = [];
    
    // 0. Payload Hardening
    try {
      const payloadString = JSON.stringify(promotion.conditions);
      if (payloadString.length > this.MAX_PAYLOAD_SIZE) {
        errors.push({ field: 'conditions', message: `AST payload too large (${Math.round(payloadString.length / 1024)}KB). Max 50KB.` });
      }
    } catch (e) {
      errors.push({ field: 'conditions', message: 'Malformed AST: Circular references or non-serializable nodes detected.' });
    }

    // 1. Basic Metadata
    if (promotion.startDate && promotion.endDate) {
      if (new Date(promotion.startDate) >= new Date(promotion.endDate)) {
        errors.push({ field: 'dates', message: 'Start date must be before end date.' });
      }
    }

    // 2. Recursive Condition Validation & Node Counting
    if (promotion.conditions) {
      let nodeCount = 0;
      const countNodes = (node) => {
        nodeCount++;
        if (node.rules) node.rules.forEach(countNodes);
      };
      countNodes(promotion.conditions);

      if (nodeCount > this.MAX_NODES) {
        errors.push({ field: 'conditions', message: `AST contains too many nodes (${nodeCount}). Max 50.` });
      }

      this.validateConditionGroup(promotion.conditions, errors, warnings, 0);
    }

    // 3. Action Validation
    if (!promotion.actions || promotion.actions.length === 0) {
      errors.push({ field: 'actions', message: 'At least one action is required.' });
    } else {
      promotion.actions.forEach((action, index) => {
        this.validateAction(action, index, errors, warnings);
      });
    }

    // 4. BXGY Specific Checks
    const bxgyActions = promotion.actions?.filter(a => a.type === 'bxgy') || [];
    bxgyActions.forEach((action, index) => {
      const config = action.bxgyConfig || {};
      const buyX = config.buyX || (config.buyTargetIds && config.buyTargetIds[0]);
      const getY = config.getY || (config.getTargetIds && config.getTargetIds[0]);
      if (buyX && getY && buyX === getY) {
        warnings.push({ 
          field: `actions.${index}.bxgyConfig`, 
          message: 'Buy item and Get item are the same. Ensure this is not an infinite loop scenario.' 
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateConditionGroup(group, errors, warnings, depth) {
    if (depth > this.MAX_DEPTH) {
      errors.push({ field: 'conditions', message: `Max condition nesting depth (${this.MAX_DEPTH}) exceeded.` });
      return;
    }

    const { operator, rules = [] } = group;
    
    if (rules.length === 0 && operator) {
      warnings.push({ field: 'conditions', message: 'Empty condition group detected.' });
    }

    // Contradiction Detection (Subtotal)
    const subtotalRules = rules.filter(r => r.field === 'subtotal');
    if (subtotalRules.length >= 2 && operator === 'AND') {
      const gts = subtotalRules.filter(r => r.op === '>' || r.op === '>=').sort((a,b) => b.value - a.value);
      const lts = subtotalRules.filter(r => r.op === '<' || r.op === '<=').sort((a,b) => a.value - b.value);
      
      if (gts.length > 0 && lts.length > 0) {
        if (gts[0].value > lts[0].value) {
          errors.push({ 
            field: 'conditions', 
            message: `Contradiction: Subtotal cannot be both > ${gts[0].value} and < ${lts[0].value}.` 
          });
        }
      }
    }

    rules.forEach(rule => {
      if (rule.operator) {
        this.validateConditionGroup(rule, errors, warnings, depth + 1);
      }
    });
  }

  static validateAction(action, index, errors, warnings) {
    if (action.target === 'product' || action.target === 'category' || action.target === 'collection') {
      if ((!action.targetIds || action.targetIds.length === 0) && action.type !== 'bundle' && action.type !== 'bxgy') {
        errors.push({ 
          field: `actions.${index}.targetIds`, 
          message: `Targeted ${action.target} discount requires at least one ID.` 
        });
      }
    }

    if (action.type === 'percentage_discount' && action.value > 100) {
      errors.push({ field: `actions.${index}.value`, message: 'Percentage discount cannot exceed 100%.' });
    }

    if (action.type === 'fixed_product_price' && (!action.value || action.value <= 0)) {
      errors.push({ field: `actions.${index}.value`, message: 'Fixed product price must be greater than 0.' });
    }

    if (action.type === 'quantity_tier') {
      if (!action.quantityTiers || action.quantityTiers.length === 0) {
        errors.push({ field: `actions.${index}.quantityTiers`, message: 'Quantity tiers cannot be empty.' });
      } else {
        action.quantityTiers.forEach((tier, tIdx) => {
          if (!tier.quantity || tier.quantity <= 0) {
            errors.push({ field: `actions.${index}.quantityTiers.${tIdx}.quantity`, message: 'Tier quantity must be greater than 0.' });
          }
          if (!tier.value || tier.value <= 0) {
            errors.push({ field: `actions.${index}.quantityTiers.${tIdx}.value`, message: 'Tier value must be greater than 0.' });
          }
        });
      }
    }

    if (action.type === 'bundle') {
      const config = action.bundleConfig || {};
      if (!config.products || config.products.length === 0) {
        errors.push({ field: `actions.${index}.bundleConfig.products`, message: 'Bundle products cannot be empty.' });
      } else {
        config.products.forEach((prod, pIdx) => {
          if (!prod.productId) {
            errors.push({ field: `actions.${index}.bundleConfig.products.${pIdx}.productId`, message: 'Bundle product ID is required.' });
          }
          if (!prod.quantity || prod.quantity <= 0) {
            errors.push({ field: `actions.${index}.bundleConfig.products.${pIdx}.quantity`, message: 'Bundle product quantity must be greater than 0.' });
          }
        });
      }
      if (!config.value || config.value <= 0) {
        errors.push({ field: `actions.${index}.bundleConfig.value`, message: 'Bundle value must be greater than 0.' });
      }
    }
  }
}
