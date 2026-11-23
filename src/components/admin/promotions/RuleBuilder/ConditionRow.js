import React, { useState } from 'react';
import { Trash2, GripVertical, ChevronDown } from 'lucide-react';
import { childRulePath, joinPath } from '../promotionEditorUtils';
import ThemedSelect from "@/components/ui/ThemedSelect";


// Each condition field maps to ONE sensible comparison automatically, so admins never
// have to pick a raw operator (>=, in, contains…). The row reads like a plain sentence:
// "Cart Subtotal   is at least   [$50]".  The op stored on the rule is what the
// ConditionEvaluator still expects — we just hide it behind a friendly field choice.
const FIELD_CONFIG = {
  subtotal:      { label: 'Cart Subtotal',       op: '>=', kind: 'money',        phrase: 'is at least' },
  items_count:   { label: 'Number of Items',     op: '>=', kind: 'number',       phrase: 'is at least' },
  product_id:    { label: 'Specific Products',   op: 'in', kind: 'products',     phrase: 'include any of' },
  category_id:   { label: 'Product Categories',  op: 'in', kind: 'categories',   phrase: 'include any from' },
  collection_id: { label: 'Product Collections', op: 'in', kind: 'collections',  phrase: 'include any from' },
  customer_type: { label: 'Customer',            op: 'in', kind: 'customerType', phrase: 'is any of' },
};

const CUSTOMER_TYPES = [
  { id: 'guest',     label: 'Guest (not logged in)' },
  { id: 'logged_in', label: 'Logged-in customer' },
  { id: 'new',       label: 'New customer (no past orders)' },
  { id: 'returning', label: 'Returning customer' },
];

// A friendly checkbox dropdown that replaces the old ctrl-click <select multiple>.
function MultiSelect({ options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set((Array.isArray(selected) ? selected : []).map(String));

  const toggle = (id) => {
    const key = String(id);
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(Array.from(next));
  };

  const count = selectedSet.size;
  return (
    <div className="relative min-w-0" style={{ flex: '1 1 200px' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="wp-select wp-full flex items-center justify-between gap-2 text-left"
        style={{ paddingRight: 8 }}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className={`truncate ${count ? 'wp-strong' : 'wp-muted'}`}>
          {count ? `${count} selected` : (placeholder || 'Select…')}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute z-20 w-full overflow-y-auto"
            style={{ marginTop: 2, maxHeight: 240, background: '#fff', border: '1px solid var(--wp-border)', boxShadow: '0 3px 8px rgba(0,0,0,0.12)', padding: '4px 0' }}
          >
            {options.length === 0 ? (
              <div className="wp-muted" style={{ padding: '8px 10px' }}>No options available</div>
            ) : (
              options.map((o) => (
                <label key={o.id} className="wp-check hover:bg-[#f0f6fc]" style={{ padding: '4px 10px', minHeight: 40 }}>
                  <input
                    type="checkbox"
                    checked={selectedSet.has(String(o.id))}
                    onChange={() => toggle(o.id)}
                  />
                  <span className="truncate">{o.label}</span>
                </label>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ConditionRow({ rule, path, index, onUpdate, onRemove, catalogData }) {
  const { products = [], categories = [], collections = [] } = catalogData || {};
  const base = childRulePath(path, index);
  const config = FIELD_CONFIG[rule.field] || FIELD_CONFIG.subtotal;
  const isKnownField = Object.prototype.hasOwnProperty.call(FIELD_CONFIG, rule.field);

  // Picking a field auto-sets the right comparison + resets the value to the correct
  // empty shape (blank number vs empty list), so the admin never touches an operator.
  const handleFieldChange = (newField) => {
    const next = FIELD_CONFIG[newField] || FIELD_CONFIG.subtotal;
    const emptyValue = (next.kind === 'money' || next.kind === 'number') ? '' : [];
    onUpdate(joinPath(base, 'field'), newField);
    onUpdate(joinPath(base, 'op'), next.op);
    onUpdate(joinPath(base, 'value'), emptyValue);
  };

  const setValue = (v) => onUpdate(joinPath(base, 'value'), v);
  const arrValue = Array.isArray(rule.value) ? rule.value : [];
  const toOptions = (list) => list.map((x) => ({ id: x._id?.toString() || x.id, label: x.name }));


  const renderValue = () => {
    // A legacy/unknown field saved before this friendly rebuild (e.g. user_id) — preserve its
    // raw value as plain text instead of misbinding it to a money/checkbox control.
    if (!isKnownField) {
      return (
        <input
          type="text"
          value={typeof rule.value === "string" ? rule.value : (Array.isArray(rule.value) ? rule.value.join(", ") : "")}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value"
          aria-label="Condition value"
          className="wp-input min-w-0"
          style={{ flex: '1 1 200px' }}
        />
      );
    }
    switch (config.kind) {
      case 'money':
        return (
          <div className="flex items-center min-w-0 gap-1" style={{ flex: '1 1 200px' }}>
            <span className="wp-muted" aria-hidden="true">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rule.value ?? ''}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0.00"
              aria-label={`${config.label} in dollars`}
              className="wp-input min-w-0 flex-1"
            />
          </div>
        );
      case 'number':
        return (
          <input
            type="number"
            min="0"
            step="1"
            value={rule.value ?? ''}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 2"
            aria-label={config.label}
            className="wp-input min-w-0"
            style={{ flex: '1 1 200px' }}
          />
        );
      case 'products':
        return <MultiSelect options={toOptions(products)} selected={arrValue} onChange={setValue} placeholder="Select products…" />;
      case 'categories':
        return <MultiSelect options={toOptions(categories)} selected={arrValue} onChange={setValue} placeholder="Select categories…" />;
      case 'collections':
        return <MultiSelect options={toOptions(collections)} selected={arrValue} onChange={setValue} placeholder="Select collections…" />;
      case 'customerType':
        return <MultiSelect options={CUSTOMER_TYPES} selected={arrValue} onChange={setValue} placeholder="Select customer types…" />;
      default:
        return null;
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 min-w-0"
      style={{ background: '#fff', border: '1px solid var(--wp-border-2)', padding: 8 }}
    >
      <span className="wp-hide-sm shrink-0" style={{ color: '#a7aaad' }} aria-hidden="true">
        <GripVertical className="w-4 h-4" />
      </span>

      <ThemedSelect
        value={rule.field}
        onChange={(e) => handleFieldChange(e.target.value)}
        aria-label="Condition field"
        className="wp-select min-w-0"
        style={{ flex: '0 1 200px' }}
      >
        {!isKnownField && rule.field && (
          <option value={rule.field}>{`Legacy: ${rule.field}`}</option>
        )}
        {Object.entries(FIELD_CONFIG).map(([value, c]) => (
          <option key={value} value={value}>{c.label}</option>
        ))}
      </ThemedSelect>

      <span className="wp-muted whitespace-nowrap shrink-0">{config.phrase}</span>

      {renderValue()}

      <button
        type="button"
        onClick={() => onRemove(path, index)}
        className="wp-btn shrink-0"
        style={{ borderColor: 'var(--wp-danger)', color: 'var(--wp-danger)', padding: 0, minWidth: 40 }}
        aria-label="Remove condition"
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
