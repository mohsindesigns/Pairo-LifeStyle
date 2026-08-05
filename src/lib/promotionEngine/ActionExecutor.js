/**
 * Executes the actions of a promotion to calculate discount amounts.
 * Supports targeted discounts (products/categories), BXGY, quantity tiers, bundles, and fixed product prices.
 */
export default class ActionExecutor {
  /**
   * @param {Object} promotion - The promotion model instance
   * @param {Object} cart - The cart object
   */
  static execute(promotion, cart) {
    console.log(`[Engine:Executor] Executing actions for: ${promotion.title}`);
    
    let discountAmount = 0;
    let isFreeShipping = false;
    const appliedActions = [];

    if (!promotion.actions || !Array.isArray(promotion.actions)) {
      return { discountAmount, isFreeShipping, appliedActions };
    }

    for (const action of promotion.actions) {
      let currentActionDiscount = 0;

      switch (action.type) {
        case 'percentage_discount':
          if ((action.target === 'product' || action.target === 'category' || action.target === 'collection') && action.targetIds?.length > 0) {
            currentActionDiscount = this.calculateTargetedDiscount(cart, action, 'percentage');
          } else {
            currentActionDiscount = (cart.subtotal * (parseFloat(action.value) || 0)) / 100;
          }
          break;

        case 'fixed_discount':
          if ((action.target === 'product' || action.target === 'category' || action.target === 'collection') && action.targetIds?.length > 0) {
            currentActionDiscount = this.calculateTargetedDiscount(cart, action, 'fixed');
          } else {
            currentActionDiscount = parseFloat(action.value) || 0;
          }
          break;

        case 'free_shipping':
          isFreeShipping = true;
          break;

        case 'bxgy':
          currentActionDiscount = this.calculateBXGY(cart, action);
          break;

        case 'fixed_product_price':
          currentActionDiscount = this.calculateFixedProductPrice(cart, action);
          break;

        case 'quantity_tier':
          currentActionDiscount = this.calculateQuantityTier(cart, action);
          break;

        case 'bundle':
          currentActionDiscount = this.calculateBundle(cart, action);
          break;

        default:
          console.warn(`[Engine:Executor] Action type ${action.type} not supported.`);
      }

      appliedActions.push({ 
        ...action, 
        calculatedValue: parseFloat(currentActionDiscount.toFixed(2)) 
      });
      discountAmount += currentActionDiscount;
    }

    // Guardrail: Cannot discount more than the subtotal
    if (discountAmount > cart.subtotal) {
      discountAmount = cart.subtotal;
    }

    return {
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      isFreeShipping,
      appliedActions
    };
  }

  /**
   * Calculates discount for specific products/categories/collections in the cart.
   */
  static calculateTargetedDiscount(cart, action, type) {
    let totalTargetedDiscount = 0;
    const targetIds = action.targetIds.map(id => id.toString());

    for (const item of cart.items || []) {
      const productId = item.productId?.toString() || item.id?.toString();
      let matches = false;

      if (action.target === 'product' && targetIds.includes(productId)) {
        matches = true;
      } else if (action.target === 'category') {
        const itemCategories = item.categories?.map(c => c.toString()) || [];
        if (itemCategories.some(c => targetIds.includes(c))) {
          matches = true;
        }
      } else if (action.target === 'collection') {
        const itemCollections = item.collections?.map(c => c.toString()) || [];
        if (itemCollections.some(c => targetIds.includes(c))) {
          matches = true;
        }
      }

      if (matches) {
        const itemTotal = item.price * item.quantity;
        if (type === 'percentage') {
          totalTargetedDiscount += (itemTotal * (parseFloat(action.value) || 0)) / 100;
        } else if (type === 'fixed') {
          totalTargetedDiscount += (parseFloat(action.value) || 0) * item.quantity;
        }
      }
    }
    return totalTargetedDiscount;
  }

  /**
   * Calculates Fixed Product Price discount.
   */
  static calculateFixedProductPrice(cart, action) {
    let totalDiscount = 0;
    if (action.target === 'product' && action.targetIds?.length > 0) {
      const targetIds = action.targetIds.map(id => id.toString());
      for (const item of cart.items || []) {
        const productId = item.productId?.toString() || item.id?.toString();
        if (targetIds.includes(productId)) {
          if (item.price > action.value) {
            totalDiscount += (item.price - action.value) * item.quantity;
          }
        }
      }
    }
    return totalDiscount;
  }

  /**
   * Calculates Quantity Tier / Break / Buy More Save More discount.
   */
  static calculateQuantityTier(cart, action) {
    const { quantityTiers = [], target, targetIds = [] } = action;
    if (quantityTiers.length === 0) return 0;

    // Filter qualifying items in the cart
    const qualifyingItems = [];
    const formattedTargetIds = targetIds.map(id => id.toString());

    for (const item of cart.items || []) {
      const productId = item.productId?.toString() || item.id?.toString();
      let matches = false;
      if (target === 'cart' || !target) {
        matches = true;
      } else if (target === 'product' && formattedTargetIds.includes(productId)) {
        matches = true;
      } else if (target === 'category') {
        const itemCategories = item.categories?.map(c => c.toString()) || [];
        if (itemCategories.some(c => formattedTargetIds.includes(c))) {
          matches = true;
        }
      } else if (target === 'collection') {
        const itemCollections = item.collections?.map(c => c.toString()) || [];
        if (itemCollections.some(c => formattedTargetIds.includes(c))) {
          matches = true;
        }
      }

      if (matches) {
        qualifyingItems.push(item);
      }
    }

    const totalQty = qualifyingItems.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQty === 0) return 0;

    // Find highest applicable tier
    const sortedTiers = [...quantityTiers].sort((a, b) => b.quantity - a.quantity);
    const applicableTier = sortedTiers.find(t => totalQty >= t.quantity);
    if (!applicableTier) return 0;

    const originalTotal = qualifyingItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (applicableTier.priceType === 'per_unit') {
      const discountedTotal = totalQty * applicableTier.value;
      return Math.max(0, originalTotal - discountedTotal);
    } else if (applicableTier.priceType === 'total') {
      const expandedPrices = [];
      for (const item of qualifyingItems) {
        for (let i = 0; i < item.quantity; i++) {
          expandedPrices.push(item.price);
        }
      }
      expandedPrices.sort((a, b) => b - a);

      const itemsInTier = expandedPrices.slice(0, applicableTier.quantity);
      const originalPriceOfTierSet = itemsInTier.reduce((sum, p) => sum + p, 0);
      const discountForTierSet = Math.max(0, originalPriceOfTierSet - applicableTier.value);
      return discountForTierSet;
    } else if (applicableTier.priceType === 'percentage') {
      return (originalTotal * applicableTier.value) / 100;
    } else if (applicableTier.priceType === 'fixed_discount') {
      return Math.min(applicableTier.value, originalTotal);
    }

    return 0;
  }

  /**
   * Calculates Bundle discount.
   */
  static calculateBundle(cart, action) {
    const { bundleConfig } = action;
    if (!bundleConfig || !bundleConfig.products || bundleConfig.products.length === 0) return 0;

    let sets = Infinity;
    const requiredProductsMap = new Map();

    for (const reqProduct of bundleConfig.products) {
      const reqId = reqProduct.productId?.toString();
      requiredProductsMap.set(reqId, (requiredProductsMap.get(reqId) || 0) + (reqProduct.quantity || 1));
    }

    for (const [reqId, reqQty] of requiredProductsMap.entries()) {
      const cartItemsForProduct = cart.items?.filter(item => (item.productId?.toString() || item.id?.toString()) === reqId) || [];
      const totalCartQty = cartItemsForProduct.reduce((sum, item) => sum + item.quantity, 0);
      
      if (totalCartQty < reqQty) {
        return 0;
      }
      
      const productSets = Math.floor(totalCartQty / reqQty);
      if (productSets < sets) {
        sets = productSets;
      }
    }

    if (sets === 0 || sets === Infinity) return 0;

    let originalPriceOfBundleSet = 0;
    for (const [reqId, reqQty] of requiredProductsMap.entries()) {
      const cartItemsForProduct = cart.items?.filter(item => (item.productId?.toString() || item.id?.toString()) === reqId) || [];
      const price = cartItemsForProduct[0]?.price || 0;
      originalPriceOfBundleSet += price * reqQty;
    }

    const totalOriginalBundlesPrice = originalPriceOfBundleSet * sets;

    if (bundleConfig.priceType === 'fixed_price') {
      const totalBundledPrice = bundleConfig.value * sets;
      return Math.max(0, totalOriginalBundlesPrice - totalBundledPrice);
    } else if (bundleConfig.priceType === 'discount_percentage') {
      return (totalOriginalBundlesPrice * bundleConfig.value) / 100;
    } else if (bundleConfig.priceType === 'discount_fixed') {
      return Math.min(bundleConfig.value * sets, totalOriginalBundlesPrice);
    }

    return 0;
  }

  /**
   * Calculates Buy X Get Y (BXGY) discount.
   */
  static calculateBXGY(cart, action) {
    const config = action.bxgyConfig || {};
    const buyType = config.buyType || 'product';
    const buyTargetIds = (config.buyTargetIds && config.buyTargetIds.length > 0) 
      ? config.buyTargetIds.map(id => id.toString())
      : (config.buyX ? [config.buyX.toString()] : []);
    const buyQty = config.buyQty || 1;

    const getType = config.getType || 'product';
    const getTargetIds = (config.getTargetIds && config.getTargetIds.length > 0)
      ? config.getTargetIds.map(id => id.toString())
      : (config.getY ? [config.getY.toString()] : []);
    const getQty = config.getQty || 1;

    const discountType = config.discountType || 'free';
    const discountValue = config.discountValue !== undefined ? config.discountValue : 100;
    const mustBeSameProduct = !!config.mustBeSameProduct;
    const useCheapest = config.useCheapest !== undefined ? config.useCheapest : true;

    if (
      (buyType !== 'all' && buyTargetIds.length === 0) ||
      (getType !== 'all' && getTargetIds.length === 0)
    ) {
      return 0;
    }

    const isItemMatch = (item, type, targetIds) => {
      const productId = item.productId?.toString() || item.id?.toString();
      if (type === 'product' && targetIds.includes(productId)) {
        return true;
      } else if (type === 'category') {
        const itemCategories = item.categories?.map(c => c.toString()) || [];
        if (itemCategories.some(c => targetIds.includes(c))) {
          return true;
        }
      } else if (type === 'collection') {
        const itemCollections = item.collections?.map(c => c.toString()) || [];
        if (itemCollections.some(c => targetIds.includes(c))) {
          return true;
        }
      } else if (type === 'all') {
        return true;
      }
      return false;
    };

    if (mustBeSameProduct) {
      let totalDiscount = 0;
      const processedProductIds = new Set();

      for (const item of cart.items || []) {
        const productId = item.productId?.toString() || item.id?.toString();
        if (processedProductIds.has(productId)) continue;
        processedProductIds.add(productId);

        const matchesBuy = isItemMatch(item, buyType, buyTargetIds);
        const matchesGet = isItemMatch(item, getType, getTargetIds);

        if (matchesBuy && matchesGet) {
          const itemsOfProduct = cart.items.filter(i => (i.productId?.toString() || i.id?.toString()) === productId);
          const qty = itemsOfProduct.reduce((sum, i) => sum + i.quantity, 0);

          const step = buyQty + getQty;
          const sets = Math.floor(qty / step);
          if (sets > 0) {
            const discountQty = sets * getQty;
            const price = item.price;
            if (discountType === 'free') {
              totalDiscount += price * discountQty;
            } else if (discountType === 'percentage') {
              totalDiscount += (price * discountQty * discountValue) / 100;
            } else if (discountType === 'fixed') {
              totalDiscount += discountValue * discountQty;
            }
          }
        }
      }
      return totalDiscount;
    } else {
      const buyPool = [];
      const getPool = [];

      for (const item of cart.items || []) {
        if (isItemMatch(item, buyType, buyTargetIds)) {
          buyPool.push(item);
        }
        if (isItemMatch(item, getType, getTargetIds)) {
          getPool.push(item);
        }
      }

      const totalBuyQty = buyPool.reduce((sum, item) => sum + item.quantity, 0);
      if (totalBuyQty < buyQty) return 0;

      const sets = Math.floor(totalBuyQty / buyQty);
      const totalGetQtyAllowed = sets * getQty;

      const expandedGetPool = [];
      for (const item of getPool) {
        for (let i = 0; i < item.quantity; i++) {
          expandedGetPool.push({ price: item.price });
        }
      }

      if (expandedGetPool.length === 0) return 0;

      if (useCheapest) {
        expandedGetPool.sort((a, b) => a.price - b.price);
      } else {
        expandedGetPool.sort((a, b) => b.price - a.price);
      }

      const itemsToDiscount = expandedGetPool.slice(0, totalGetQtyAllowed);
      let totalDiscount = 0;

      for (const item of itemsToDiscount) {
        if (discountType === 'free') {
          totalDiscount += item.price;
        } else if (discountType === 'percentage') {
          totalDiscount += (item.price * discountValue) / 100;
        } else if (discountType === 'fixed') {
          totalDiscount += discountValue;
        }
      }

      return totalDiscount;
    }
  }
}
