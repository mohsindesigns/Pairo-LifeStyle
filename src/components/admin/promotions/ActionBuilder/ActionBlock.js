import React from 'react';
import { Trash2, ShoppingCart, Tag, Percent, ArrowRight, Plus } from 'lucide-react';

export default function ActionBlock({ action, index, onUpdate, onRemove }) {
  const types = [
    { value: 'percentage_discount', label: 'Percentage Discount' },
    { value: 'fixed_discount', label: 'Fixed Amount Discount' },
    { value: 'free_shipping', label: 'Free Shipping' },
    { value: 'fixed_product_price', label: 'Fixed Product Price' },
    { value: 'bxgy', label: 'Buy X Get Y (BOGO)' },
    { value: 'quantity_tier', label: 'Quantity Break / Tiered Pricing' },
    { value: 'bundle', label: 'Product Bundle' },
  ];

  const targets = [
    { value: 'cart', label: 'Entire Cart' },
    { value: 'product', label: 'Specific Products' },
    { value: 'category', label: 'Specific Categories' },
    { value: 'collection', label: 'Specific Collections' },
    { value: 'shipping', label: 'Shipping Fee' },
  ];

  const bxgyTargetTypes = [
    { value: 'product', label: 'Specific Products' },
    { value: 'category', label: 'Specific Categories' },
    { value: 'collection', label: 'Specific Collections' },
    { value: 'all', label: 'Any Product' },
  ];

  // Helper to add a new quantity break tier
  const handleAddTier = () => {
    const tiers = action.quantityTiers ? [...action.quantityTiers] : [];
    tiers.push({ quantity: 1, priceType: 'per_unit', value: 0 });
    onUpdate(index, 'quantityTiers', tiers);
  };

  // Helper to update a specific tier field
  const handleUpdateTier = (tIdx, field, val) => {
    const tiers = [...action.quantityTiers];
    tiers[tIdx] = { ...tiers[tIdx], [field]: val };
    onUpdate(index, 'quantityTiers', tiers);
  };

  // Helper to remove a tier
  const handleRemoveTier = (tIdx) => {
    const tiers = action.quantityTiers.filter((_, i) => i !== tIdx);
    onUpdate(index, 'quantityTiers', tiers);
  };

  // Helper to add product to bundle
  const handleAddBundleProduct = () => {
    const config = action.bundleConfig || { products: [], priceType: 'fixed_price', value: 0 };
    const prods = config.products ? [...config.products] : [];
    prods.push({ productId: '', quantity: 1 });
    onUpdate(index, 'bundleConfig', { ...config, products: prods });
  };

  // Helper to update bundle product
  const handleUpdateBundleProduct = (pIdx, field, val) => {
    const config = { ...action.bundleConfig };
    const prods = [...config.products];
    prods[pIdx] = { ...prods[pIdx], [field]: val };
    config.products = prods;
    onUpdate(index, 'bundleConfig', config);
  };

  // Helper to remove bundle product
  const handleRemoveBundleProduct = (pIdx) => {
    const config = { ...action.bundleConfig };
    config.products = config.products.filter((_, i) => i !== pIdx);
    onUpdate(index, 'bundleConfig', config);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden mb-3">
      {/* Action Header */}
      <div className="bg-[#f9fafb] border-b border-gray-100 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-emerald-100 text-emerald-700 rounded-sm">
            <Percent className="w-3.5 h-3.5" />
          </div>
          <span className="text-[12px] font-bold text-gray-700 uppercase tracking-tight">Action #{index + 1}</span>
        </div>
        <button onClick={() => onRemove(index)} className="text-gray-400 hover:text-rose-600 p-1">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Action Settings */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase">Discount Type</label>
            <select 
              value={action.type} 
              onChange={(e) => onUpdate(index, 'type', e.target.value)}
              className="w-full text-[13px] border border-gray-300 p-2 rounded-sm outline-none focus:border-[#2271b1]"
            >
              {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {action.type !== 'bxgy' && action.type !== 'bundle' && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-500 uppercase">Target Scope</label>
              <select 
                value={action.target} 
                onChange={(e) => onUpdate(index, 'target', e.target.value)}
                className="w-full text-[13px] border border-gray-300 p-2 rounded-sm outline-none focus:border-[#2271b1]"
              >
                {targets.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* BOGO (Buy X Get Y) UPGRADED BLOCK */}
        {action.type === 'bxgy' && (
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-sm space-y-4">
            <span className="text-[12px] font-bold text-emerald-800 uppercase tracking-wider block">Buy X Get Y (BOGO) Config</span>
            
            {/* Buy X Section */}
            <div className="space-y-3 p-3 bg-white border border-emerald-200 rounded-sm">
              <span className="text-[11px] font-bold text-emerald-700 block">WHEN CUSTOMER BUYS:</span>
              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="space-y-1 col-span-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Quantity</label>
                  <input 
                    type="number" 
                    value={action.bxgyConfig?.buyQty || 1} 
                    onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, buyQty: parseInt(e.target.value) || 1 })}
                    className="w-full border border-gray-300 p-1.5 rounded-sm text-center text-[12px]" 
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">From Target Type</label>
                  <select 
                    value={action.bxgyConfig?.buyType || 'product'} 
                    onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, buyType: e.target.value, buyTargetIds: [] })}
                    className="w-full border border-gray-300 p-1.5 rounded-sm text-[12px]" 
                  >
                    {bxgyTargetTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              {action.bxgyConfig?.buyType !== 'all' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Target IDs (Comma-separated)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. prod_abc, category_xyz..."
                    value={action.bxgyConfig?.buyTargetIds?.join(', ') || ''} 
                    onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, buyTargetIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    className="w-full border border-gray-300 p-1.5 rounded-sm text-[12px]" 
                  />
                </div>
              )}
            </div>

            {/* Get Y Section */}
            <div className="space-y-3 p-3 bg-white border border-emerald-200 rounded-sm">
              <span className="text-[11px] font-bold text-emerald-700 block">THEY GET:</span>
              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="space-y-1 col-span-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Quantity</label>
                  <input 
                    type="number" 
                    value={action.bxgyConfig?.getQty || 1} 
                    onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, getQty: parseInt(e.target.value) || 1 })}
                    className="w-full border border-gray-300 p-1.5 rounded-sm text-center text-[12px]" 
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">From Target Type</label>
                  <select 
                    value={action.bxgyConfig?.getType || 'product'} 
                    onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, getType: e.target.value, getTargetIds: [] })}
                    className="w-full border border-gray-300 p-1.5 rounded-sm text-[12px]" 
                  >
                    {bxgyTargetTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              {action.bxgyConfig?.getType !== 'all' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Target IDs (Comma-separated)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. prod_abc, category_xyz..."
                    value={action.bxgyConfig?.getTargetIds?.join(', ') || ''} 
                    onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, getTargetIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    className="w-full border border-gray-300 p-1.5 rounded-sm text-[12px]" 
                  />
                </div>
              )}
            </div>

            {/* Discount Applied on Y */}
            <div className="bg-white border border-emerald-200 p-3 rounded-sm grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Discount Type</label>
                <select 
                  value={action.bxgyConfig?.discountType || 'free'} 
                  onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, discountType: e.target.value })}
                  className="w-full border border-gray-300 p-1.5 rounded-sm text-[12px]" 
                >
                  <option value="free">Free (100% off)</option>
                  <option value="percentage">Percentage Discount</option>
                  <option value="fixed">Fixed Price Discount</option>
                </select>
              </div>
              {action.bxgyConfig?.discountType !== 'free' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Value</label>
                  <input 
                    type="number" 
                    value={action.bxgyConfig?.discountValue || 0} 
                    onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, discountValue: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-gray-300 p-1.5 rounded-sm text-[12px]" 
                  />
                </div>
              )}
            </div>

            {/* Same Product & Cheapest Options */}
            <div className="flex flex-col gap-2 pl-1">
              <label className="flex items-center gap-2 text-[12px] font-medium text-emerald-800 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={action.bxgyConfig?.mustBeSameProduct || false} 
                  onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, mustBeSameProduct: e.target.checked })}
                  className="rounded text-emerald-600"
                />
                <span>Must be same product (Buy X and Get Y of same product ID)</span>
              </label>
              <label className="flex items-center gap-2 text-[12px] font-medium text-emerald-800 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={action.bxgyConfig?.useCheapest !== false} 
                  onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, useCheapest: e.target.checked })}
                  className="rounded text-emerald-600"
                />
                <span>Cheapest item gets discounted first</span>
              </label>
            </div>
          </div>
        )}

        {/* QUANTITY TIER BLOCK */}
        {action.type === 'quantity_tier' && (
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-blue-800 uppercase tracking-wider">Quantity Breaks Config</span>
              <button 
                type="button" 
                onClick={handleAddTier} 
                className="text-[11px] font-bold text-[#2271b1] hover:underline"
              >
                + ADD TIER
              </button>
            </div>

            <div className="space-y-2">
              {(action.quantityTiers || []).map((tier, tIdx) => (
                <div key={tIdx} className="grid grid-cols-12 gap-2 items-center bg-white border border-blue-200 p-2 rounded-sm shadow-inner">
                  <div className="col-span-3 space-y-0.5">
                    <label className="text-[9px] text-gray-400 font-bold uppercase block">Min Qty</label>
                    <input 
                      type="number"
                      value={tier.quantity}
                      onChange={(e) => handleUpdateTier(tIdx, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full border border-gray-300 rounded-sm p-1 text-[12px] text-center"
                    />
                  </div>
                  <div className="col-span-4 space-y-0.5">
                    <label className="text-[9px] text-gray-400 font-bold uppercase block">Price Type</label>
                    <select
                      value={tier.priceType}
                      onChange={(e) => handleUpdateTier(tIdx, 'priceType', e.target.value)}
                      className="w-full border border-gray-300 rounded-sm p-1 text-[11px]"
                    >
                      <option value="per_unit">Price/Unit</option>
                      <option value="total">Total Price</option>
                      <option value="percentage">% Discount</option>
                      <option value="fixed_discount">$ Discount</option>
                    </select>
                  </div>
                  <div className="col-span-4 space-y-0.5">
                    <label className="text-[9px] text-gray-400 font-bold uppercase block">Value</label>
                    <input 
                      type="number"
                      value={tier.value}
                      onChange={(e) => handleUpdateTier(tIdx, 'value', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-sm p-1 text-[12px] text-center"
                    />
                  </div>
                  <div className="col-span-1 text-center pt-3">
                    <button 
                      type="button" 
                      onClick={() => handleRemoveTier(tIdx)}
                      className="text-gray-400 hover:text-rose-600"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
              {(!action.quantityTiers || action.quantityTiers.length === 0) && (
                <div className="text-[11px] text-blue-500 italic text-center py-4 border border-dashed border-blue-200 rounded-sm">
                  No quantity tiers defined. Click "+ ADD TIER" above.
                </div>
              )}
            </div>

            {(action.target === 'product' || action.target === 'category' || action.target === 'collection') && (
              <div className="space-y-1 bg-white p-3 border border-blue-200 rounded-sm">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Qualifying target IDs (Comma separated)</label>
                <input 
                  type="text" 
                  value={action.targetIds?.join(', ') || ''} 
                  onChange={(e) => onUpdate(index, 'targetIds', e.target.value.split(',').map(s => s.trim()))}
                  placeholder="ID1, ID2..."
                  className="w-full text-[12px] border border-gray-300 p-1.5 rounded-sm outline-none focus:border-[#2271b1]"
                />
              </div>
            )}
          </div>
        )}

        {/* PRODUCT BUNDLE BLOCK */}
        {action.type === 'bundle' && (
          <div className="bg-purple-50 border border-purple-100 p-4 rounded-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-purple-800 uppercase tracking-wider">Bundle Requirements</span>
              <button 
                type="button" 
                onClick={handleAddBundleProduct} 
                className="text-[11px] font-bold text-purple-700 hover:underline"
              >
                + ADD PRODUCT
              </button>
            </div>

            <div className="space-y-2">
              {((action.bundleConfig || {}).products || []).map((prod, pIdx) => (
                <div key={pIdx} className="grid grid-cols-12 gap-2 items-center bg-white border border-purple-200 p-2 rounded-sm shadow-inner">
                  <div className="col-span-8 space-y-0.5">
                    <label className="text-[9px] text-gray-400 font-bold uppercase block">Product ID</label>
                    <input 
                      type="text"
                      placeholder="e.g. prod_abc"
                      value={prod.productId}
                      onChange={(e) => handleUpdateBundleProduct(pIdx, 'productId', e.target.value)}
                      className="w-full border border-gray-300 rounded-sm p-1 text-[12px]"
                    />
                  </div>
                  <div className="col-span-3 space-y-0.5">
                    <label className="text-[9px] text-gray-400 font-bold uppercase block">Quantity</label>
                    <input 
                      type="number"
                      value={prod.quantity}
                      onChange={(e) => handleUpdateBundleProduct(pIdx, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full border border-gray-300 rounded-sm p-1 text-[12px] text-center"
                    />
                  </div>
                  <div className="col-span-1 text-center pt-3">
                    <button 
                      type="button" 
                      onClick={() => handleRemoveBundleProduct(pIdx)}
                      className="text-gray-400 hover:text-rose-600"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
              {(!action.bundleConfig?.products || action.bundleConfig.products.length === 0) && (
                <div className="text-[11px] text-purple-500 italic text-center py-4 border border-dashed border-purple-200 rounded-sm">
                  No bundle products defined. Click "+ ADD PRODUCT" above.
                </div>
              )}
            </div>

            {/* Bundle Discount / Pricing */}
            <div className="bg-white border border-purple-200 p-3 rounded-sm grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Bundle Pricing Type</label>
                <select 
                  value={action.bundleConfig?.priceType || 'fixed_price'} 
                  onChange={(e) => onUpdate(index, 'bundleConfig', { ...action.bundleConfig, priceType: e.target.value })}
                  className="w-full border border-gray-300 p-1.5 rounded-sm text-[12px]" 
                >
                  <option value="fixed_price">Fixed Bundle Price</option>
                  <option value="discount_percentage">Percentage Discount</option>
                  <option value="discount_fixed">Fixed Amount Discount</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Bundle Price/Value</label>
                <input 
                  type="number" 
                  value={action.bundleConfig?.value || 0} 
                  onChange={(e) => onUpdate(index, 'bundleConfig', { ...action.bundleConfig, value: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-gray-300 p-1.5 rounded-sm text-[12px]" 
                />
              </div>
            </div>
          </div>
        )}

        {/* standard discount/fixed pricing inputs for general targets */}
        {action.type !== 'bxgy' && action.type !== 'quantity_tier' && action.type !== 'bundle' && action.type !== 'free_shipping' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-500 uppercase">Discount Value</label>
              <div className="relative">
                <span className="absolute left-2 top-2 text-gray-400 text-sm">
                  {action.type === 'fixed_discount' || action.type === 'fixed_product_price' ? '$' : '%'}
                </span>
                <input 
                  type="number" 
                  value={action.value || 0} 
                  onChange={(e) => onUpdate(index, 'value', parseFloat(e.target.value))}
                  className="w-full text-[13px] border border-gray-300 p-2 pl-6 rounded-sm outline-none focus:border-[#2271b1]"
                />
              </div>
            </div>
            {(action.target === 'product' || action.target === 'category' || action.target === 'collection') && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase">Target IDs (Comma separated)</label>
                <input 
                  type="text" 
                  value={action.targetIds?.join(', ') || ''} 
                  onChange={(e) => onUpdate(index, 'targetIds', e.target.value.split(',').map(s => s.trim()))}
                  placeholder="ID1, ID2..."
                  className="w-full text-[13px] border border-gray-300 p-2 rounded-sm outline-none focus:border-[#2271b1]"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
