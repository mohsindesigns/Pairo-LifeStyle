import React from 'react';
import { Trash2, X } from 'lucide-react';

const MultiSelect = ({ selectedIds = [], options = [], onChange, placeholder = "Select item...", label }) => {
  const handleAdd = (id) => {
    if (id && !selectedIds.includes(id)) {
      onChange([...selectedIds, id]);
    }
  };

  const handleRemove = (id) => {
    onChange(selectedIds.filter(selected => selected !== id));
  };

  return (
    <div className="flex flex-col gap-2">
      <select
        value=""
        onChange={(e) => handleAdd(e.target.value)}
        aria-label={label || placeholder}
        className="wp-select wp-full"
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt._id || opt.id} value={opt._id?.toString() || opt.id}>
            {opt.name}
          </option>
        ))}
      </select>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 overflow-y-auto" style={{ maxHeight: 140 }}>
          {selectedIds.map(id => {
            const option = options.find(opt => (opt._id?.toString() || opt.id) === id);
            return (
              <span key={id} className="wp-chip" style={{ maxWidth: '100%' }}>
                <span className="truncate">{option ? option.name : id}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(id)}
                  aria-label={`Remove ${option ? option.name : id}`}
                  className="min-w-6 min-h-6 max-[782px]:min-w-10 max-[782px]:min-h-10"
                  style={{ justifyContent: 'center', alignItems: 'center' }}
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Small presentational helpers (layout only).
const Field = ({ label, children, className = '' }) => (
  <label className={`block min-w-0 ${className}`}>
    <span className="wp-label">{label}</span>
    {children}
  </label>
);

const Group = ({ title, aside, children }) => (
  <div className="min-w-0" style={{ border: '1px solid var(--wp-border-2)', background: 'var(--wp-alt)', padding: 12 }}>
    <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 10 }}>
      <h3 className="wp-strong flex-1" style={{ fontSize: 13, margin: 0 }}>{title}</h3>
      {aside}
    </div>
    <div className="flex flex-col gap-3">{children}</div>
  </div>
);

const iconBtnDanger = { borderColor: 'var(--wp-danger)', color: 'var(--wp-danger)', padding: 0, minWidth: 40 };

export default function ActionBlock({ action, index, onUpdate, onRemove, catalogData }) {
  const { products = [], categories = [], collections = [] } = catalogData || {};
  const types = [
    { value: 'percentage_discount', label: 'Percentage Discount' },
    { value: 'fixed_discount', label: 'Fixed Amount Discount' },
    { value: 'free_shipping', label: 'Free Shipping' },
    { value: 'fixed_product_price', label: 'Fixed Product Price' },
    { value: 'bxgy', label: 'Buy X Get Y (BOGO)' },
    { value: 'quantity_tier', label: 'Quantity Break / Tiered Pricing' },
    { value: 'bundle', label: 'Product Bundle' },
  ];

  // "Shipping Fee" is intentionally not offered here: ActionExecutor only ever
  // reads target as cart/product/category/collection for these action types,
  // so a "shipping" target silently discounted the entire cart subtotal instead
  // (or, for quantity_tier, always computed $0). Free Shipping is its own
  // dedicated action type below, not a target of these actions.
  const targets = action.type === 'fixed_product_price'
    ? [{ value: 'product', label: 'Specific Products' }]
    : [
        { value: 'cart', label: 'Entire Cart' },
        { value: 'product', label: 'Specific Products' },
        { value: 'category', label: 'Specific Categories' },
        { value: 'collection', label: 'Specific Collections' },
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

  const targetNoun = action.target === 'product' ? 'Products' : action.target === 'category' ? 'Categories' : 'Collections';

  return (
    <div className="min-w-0" style={{ border: '1px solid var(--wp-border)', background: '#fff', marginBottom: 12 }}>
      {/* Action Header */}
      <div className="flex items-center gap-2" style={{ minHeight: 40, padding: '0 12px', background: 'var(--wp-alt)', borderBottom: '1px solid var(--wp-border-2)' }}>
        <span className="wp-strong flex-1">Action #{index + 1}</span>
        <button type="button" onClick={() => onRemove(index)} className="wp-btn" style={iconBtnDanger} aria-label={`Remove action ${index + 1}`}>
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Action Settings */}
      <div className="flex flex-col gap-4" style={{ padding: 12 }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Discount type">
            <select
              value={action.type}
              onChange={(e) => onUpdate(index, 'type', e.target.value)}
              className="wp-select wp-full"
            >
              {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>

          {action.type !== 'bxgy' && action.type !== 'bundle' && (
            <Field label="Applies to">
              <select
                value={action.target}
                onChange={(e) => onUpdate(index, 'target', e.target.value)}
                className="wp-select wp-full"
              >
                {targets.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
          )}
        </div>

        {/* BOGO (Buy X Get Y) UPGRADED BLOCK */}
        {action.type === 'bxgy' && (
          <div className="flex flex-col gap-3">
            {/* Buy X Section */}
            <Group title="When the customer buys">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Quantity">
                  <input
                    type="number"
                    value={action.bxgyConfig?.buyQty || 1}
                    onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, buyQty: parseInt(e.target.value) || 1 })}
                    className="wp-input wp-full"
                  />
                </Field>
                <Field label="From" className="sm:col-span-2">
                  <select
                    value={action.bxgyConfig?.buyType || 'product'}
                    onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, buyType: e.target.value, buyTargetIds: [] })}
                    className="wp-select wp-full"
                  >
                    {bxgyTargetTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
              </div>
              {action.bxgyConfig?.buyType !== 'all' && (
                <div className="min-w-0">
                  <span className="wp-label">Qualifying buy targets</span>
                  <MultiSelect
                    selectedIds={action.bxgyConfig?.buyTargetIds || []}
                    options={action.bxgyConfig?.buyType === 'product' ? products : action.bxgyConfig?.buyType === 'category' ? categories : collections}
                    onChange={(vals) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, buyTargetIds: vals })}
                    placeholder={`Choose Buy ${action.bxgyConfig?.buyType === 'product' ? 'Products' : action.bxgyConfig?.buyType === 'category' ? 'Categories' : 'Collections'}...`}
                    label="Add a qualifying buy target"
                  />
                </div>
              )}
            </Group>

            {/* Get Y Section */}
            <Group title="They get">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Quantity">
                  <input
                    type="number"
                    value={action.bxgyConfig?.getQty || 1}
                    onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, getQty: parseInt(e.target.value) || 1 })}
                    className="wp-input wp-full"
                  />
                </Field>
                <Field label="From" className="sm:col-span-2">
                  <select
                    value={action.bxgyConfig?.getType || 'product'}
                    onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, getType: e.target.value, getTargetIds: [] })}
                    className="wp-select wp-full"
                  >
                    {bxgyTargetTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
              </div>
              {action.bxgyConfig?.getType !== 'all' && (
                <div className="min-w-0">
                  <span className="wp-label">Qualifying get targets</span>
                  <MultiSelect
                    selectedIds={action.bxgyConfig?.getTargetIds || []}
                    options={action.bxgyConfig?.getType === 'product' ? products : action.bxgyConfig?.getType === 'category' ? categories : collections}
                    onChange={(vals) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, getTargetIds: vals })}
                    placeholder={`Choose Get ${action.bxgyConfig?.getType === 'product' ? 'Products' : action.bxgyConfig?.getType === 'category' ? 'Categories' : 'Collections'}...`}
                    label="Add a qualifying get target"
                  />
                </div>
              )}

              {/* Discount Applied on Y */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Discount on the Y items">
                  <select
                    value={action.bxgyConfig?.discountType || 'free'}
                    onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, discountType: e.target.value })}
                    className="wp-select wp-full"
                  >
                    <option value="free">Free (100% off)</option>
                    <option value="percentage">Percentage Discount</option>
                    <option value="fixed">Fixed Price Discount</option>
                  </select>
                </Field>
                {action.bxgyConfig?.discountType !== 'free' && (
                  <Field label="Value">
                    <input
                      type="number"
                      value={action.bxgyConfig?.discountValue || 0}
                      onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, discountValue: parseFloat(e.target.value) || 0 })}
                      className="wp-input wp-full"
                    />
                  </Field>
                )}
              </div>
            </Group>

            {/* Same Product & Cheapest Options */}
            <div className="flex flex-col gap-1">
              <label className="wp-check">
                <input
                  type="checkbox"
                  checked={action.bxgyConfig?.mustBeSameProduct || false}
                  onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, mustBeSameProduct: e.target.checked })}
                />
                <span>Must be same product (Buy X and Get Y of same product ID)</span>
              </label>
              <label className="wp-check">
                <input
                  type="checkbox"
                  checked={action.bxgyConfig?.useCheapest !== false}
                  onChange={(e) => onUpdate(index, 'bxgyConfig', { ...action.bxgyConfig, useCheapest: e.target.checked })}
                />
                <span>Cheapest item gets discounted first</span>
              </label>
            </div>
          </div>
        )}

        {/* QUANTITY TIER BLOCK */}
        {action.type === 'quantity_tier' && (
          <Group
            title="Quantity breaks"
            aside={
              <button type="button" onClick={handleAddTier} className="wp-btn">
                Add tier
              </button>
            }
          >
            {(action.quantityTiers || []).map((tier, tIdx) => (
              <div key={tIdx} className="flex flex-wrap items-end gap-2" style={{ background: '#fff', border: '1px solid var(--wp-border-2)', padding: 8 }}>
                <Field label="Min qty" className="flex-1" >
                  <input
                    type="number"
                    value={tier.quantity}
                    onChange={(e) => handleUpdateTier(tIdx, 'quantity', parseInt(e.target.value) || 1)}
                    className="wp-input wp-full"
                    style={{ minWidth: 80 }}
                  />
                </Field>
                <Field label="Price type" className="flex-1">
                  <select
                    value={tier.priceType}
                    onChange={(e) => handleUpdateTier(tIdx, 'priceType', e.target.value)}
                    className="wp-select wp-full"
                    style={{ minWidth: 120 }}
                  >
                    <option value="per_unit">Price/Unit</option>
                    <option value="total">Total Price</option>
                    <option value="percentage">% Discount</option>
                    <option value="fixed_discount">$ Discount</option>
                  </select>
                </Field>
                <Field label="Value" className="flex-1">
                  <input
                    type="number"
                    value={tier.value}
                    onChange={(e) => handleUpdateTier(tIdx, 'value', parseFloat(e.target.value) || 0)}
                    className="wp-input wp-full"
                    style={{ minWidth: 80 }}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => handleRemoveTier(tIdx)}
                  className="wp-btn"
                  style={iconBtnDanger}
                  aria-label={`Remove tier ${tIdx + 1}`}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            {(!action.quantityTiers || action.quantityTiers.length === 0) && (
              <p className="wp-muted" style={{ margin: 0, padding: 12, textAlign: 'center', border: '1px dashed var(--wp-border)', background: '#fff' }}>
                No quantity tiers defined. Click &quot;Add tier&quot; above.
              </p>
            )}

            {(action.target === 'product' || action.target === 'category' || action.target === 'collection') && (
              <div className="min-w-0">
                <span className="wp-label">Qualifying target {targetNoun}</span>
                <MultiSelect
                  selectedIds={action.targetIds || []}
                  options={action.target === 'product' ? products : action.target === 'category' ? categories : collections}
                  onChange={(vals) => onUpdate(index, 'targetIds', vals)}
                  placeholder={`Choose qualifying ${targetNoun}...`}
                />
              </div>
            )}
          </Group>
        )}

        {/* PRODUCT BUNDLE BLOCK */}
        {action.type === 'bundle' && (
          <Group
            title="Bundle requirements"
            aside={
              <button type="button" onClick={handleAddBundleProduct} className="wp-btn">
                Add product
              </button>
            }
          >
            {((action.bundleConfig || {}).products || []).map((prod, pIdx) => (
              <div key={pIdx} className="flex flex-wrap items-end gap-2" style={{ background: '#fff', border: '1px solid var(--wp-border-2)', padding: 8 }}>
                <Field label="Product" className="flex-1" >
                  <select
                    value={prod.productId}
                    onChange={(e) => handleUpdateBundleProduct(pIdx, 'productId', e.target.value)}
                    className="wp-select wp-full"
                    style={{ minWidth: 160 }}
                  >
                    <option value="">-- Select Product --</option>
                    {products.map(p => (
                      <option key={p._id || p.id} value={p._id?.toString() || p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Quantity">
                  <input
                    type="number"
                    value={prod.quantity}
                    onChange={(e) => handleUpdateBundleProduct(pIdx, 'quantity', parseInt(e.target.value) || 1)}
                    className="wp-input"
                    style={{ width: 90 }}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => handleRemoveBundleProduct(pIdx)}
                  className="wp-btn"
                  style={iconBtnDanger}
                  aria-label={`Remove bundle product ${pIdx + 1}`}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            {(!action.bundleConfig?.products || action.bundleConfig.products.length === 0) && (
              <p className="wp-muted" style={{ margin: 0, padding: 12, textAlign: 'center', border: '1px dashed var(--wp-border)', background: '#fff' }}>
                No bundle products defined. Click &quot;Add product&quot; above.
              </p>
            )}

            {/* Bundle Discount / Pricing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Bundle pricing type">
                <select
                  value={action.bundleConfig?.priceType || 'fixed_price'}
                  onChange={(e) => onUpdate(index, 'bundleConfig', { ...action.bundleConfig, priceType: e.target.value })}
                  className="wp-select wp-full"
                >
                  <option value="fixed_price">Fixed Bundle Price</option>
                  <option value="discount_percentage">Percentage Discount</option>
                  <option value="discount_fixed">Fixed Amount Discount</option>
                </select>
              </Field>
              <Field label="Bundle price / value">
                <input
                  type="number"
                  value={action.bundleConfig?.value || 0}
                  onChange={(e) => onUpdate(index, 'bundleConfig', { ...action.bundleConfig, value: parseFloat(e.target.value) || 0 })}
                  className="wp-input wp-full"
                />
              </Field>
            </div>
          </Group>
        )}

        {/* standard discount/fixed pricing inputs for general targets */}
        {action.type !== 'bxgy' && action.type !== 'quantity_tier' && action.type !== 'bundle' && action.type !== 'free_shipping' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={`Discount value (${action.type === 'fixed_discount' || action.type === 'fixed_product_price' ? '$' : '%'})`}>
              <input
                type="number"
                min="0"
                max={action.type === 'percentage_discount' ? 100 : undefined}
                value={action.value || 0}
                onChange={(e) => onUpdate(index, 'value', Math.max(0, parseFloat(e.target.value) || 0))}
                className="wp-input wp-full"
              />
            </Field>
            {(action.target === 'product' || action.target === 'category' || action.target === 'collection') && (
              <div className="min-w-0">
                <span className="wp-label">Target {targetNoun}</span>
                <MultiSelect
                  selectedIds={action.targetIds || []}
                  options={action.target === 'product' ? products : action.target === 'category' ? categories : collections}
                  onChange={(vals) => onUpdate(index, 'targetIds', vals)}
                  placeholder={`Choose target ${targetNoun}...`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
