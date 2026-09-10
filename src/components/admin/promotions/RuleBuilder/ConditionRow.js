import React, { useState } from 'react';
import { Trash2, GripVertical, ChevronDown } from 'lucide-react';

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
    <div className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-[13px] border border-gray-300 px-2 py-1 rounded-sm bg-white outline-none focus:border-[#2271b1]"
      >
        <span className={`truncate ${count ? 'text-[#1d2327]' : 'text-gray-400'}`}>
          {count ? `${count} selected` : (placeholder || 'Select…')}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-sm shadow-lg py-1">
            {options.length === 0 ? (
              <div className="px-2.5 py-2 text-[12px] text-gray-400">No options available</div>
            ) : (
              options.map((o) => (
                <label key={o.id} className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] hover:bg-[#f0f6fa] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(String(o.id))}
                    onChange={() => toggle(o.id)}
                    className="accent-[#2271b1]"
                  />
                  <span className="truncate text-[#1d2327]">{o.label}</span>
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
  const base = `${path}.rules.${index}`;
  const config = FIELD_CONFIG[rule.field] || FIELD_CONFIG.subtotal;
  const isKnownField = Object.prototype.hasOwnProperty.call(FIELD_CONFIG, rule.field);

  // Picking a field auto-sets the right comparison + resets the value to the correct
  // empty shape (blank number vs empty list), so the admin never touches an operator.
  const handleFieldChange = (newField) => {
    const next = FIELD_CONFIG[newField] || FIELD_CONFIG.subtotal;
    const emptyValue = (next.kind === 'money' || next.kind === 'number') ? '' : [];
    onUpdate(`${base}.field`, newField);
    onUpdate(`${base}.op`, next.op);
    onUpdate(`${base}.value`, emptyValue);
  };

  const setValue = (v) => onUpdate(`${base}.value`, v);
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
          className="flex-1 min-w-0 text-[13px] border border-gray-300 px-2 py-1 rounded-sm outline-none focus:border-[#2271b1]"
        />
      );
    }
    switch (config.kind) {
      case 'money':
        return (
          <div className="flex items-center flex-1 min-w-0 border border-gray-300 rounded-sm bg-white focus-within:border-[#2271b1]">
            <span className="px-2 text-gray-400 text-[13px]">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rule.value ?? ''}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0.00"
              className="flex-1 min-w-0 text-[13px] px-1 py-1 outline-none bg-transparent"
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
            className="flex-1 min-w-0 text-[13px] border border-gray-300 px-2 py-1 rounded-sm outline-none focus:border-[#2271b1]"
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
    <div className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-sm shadow-sm hover:border-[#2271b1] transition-colors group">
      <div className="cursor-grab text-gray-300 group-hover:text-gray-400 shrink-0">
        <GripVertical className="w-4 h-4" />
      </div>

      <select
        value={rule.field}
        onChange={(e) => handleFieldChange(e.target.value)}
        className="text-[13px] border border-gray-300 p-1 rounded-sm outline-none focus:border-[#2271b1] bg-white shrink-0"
      >
        {!isKnownField && rule.field && (
          <option value={rule.field}>{`Legacy: ${rule.field}`}</option>
        )}
        {Object.entries(FIELD_CONFIG).map(([value, c]) => (
          <option key={value} value={value}>{c.label}</option>
        ))}
      </select>

      <span className="text-[12px] text-gray-500 italic whitespace-nowrap shrink-0">{config.phrase}</span>

      {renderValue()}

      <button
        onClick={() => onRemove(path, index)}
        className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition-all shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
