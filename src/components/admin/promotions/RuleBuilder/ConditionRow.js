import React from 'react';
import { Trash2, GripVertical } from 'lucide-react';

export default function ConditionRow({ rule, path, index, onUpdate, onRemove, catalogData }) {
  const { products = [], categories = [], collections = [] } = catalogData || {};

  const fields = [
    { value: 'subtotal', label: 'Cart Subtotal' },
    { value: 'items_count', label: 'Items Count' },
    { value: 'product_id', label: 'Product ID' },
    { value: 'category_id', label: 'Category ID' },
    { value: 'collection_id', label: 'Collection ID' },
    { value: 'user_id', label: 'User ID' },
    { value: 'customer_type', label: 'Customer Type' },
  ];

  const operators = [
    { value: '>=', label: 'greater than or equal to' },
    { value: '>', label: 'greater than' },
    { value: '<=', label: 'less than or equal to' },
    { value: '<', label: 'less than' },
    { value: '==', label: 'is equal to' },
    { value: 'in', label: 'is in list' },
    { value: 'contains', label: 'contains' },
  ];

  return (
    <div className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-sm shadow-sm hover:border-[#2271b1] transition-colors group">
      <div className="cursor-grab text-gray-300 group-hover:text-gray-400">
        <GripVertical className="w-4 h-4" />
      </div>

      <select 
        value={rule.field} 
        onChange={(e) => onUpdate(`${path}.rules.${index}.field`, e.target.value)}
        className="text-[13px] border border-gray-300 p-1 rounded-sm outline-none focus:border-[#2271b1]"
      >
        {fields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>

      <select 
        value={rule.op} 
        onChange={(e) => onUpdate(`${path}.rules.${index}.op`, e.target.value)}
        className="text-[13px] border border-gray-300 p-1 rounded-sm outline-none focus:border-[#2271b1]"
      >
        {operators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {rule.field === 'customer_type' ? (
        <select
          value={rule.value || 'guest'}
          onChange={(e) => onUpdate(`${path}.rules.${index}.value`, e.target.value)}
          className="text-[13px] border border-gray-300 p-1 rounded-sm outline-none focus:border-[#2271b1] flex-1"
        >
          <option value="guest">Guest Customers</option>
          <option value="logged_in">Logged-in Customers</option>
          <option value="new">New Customers (0 past orders)</option>
          <option value="returning">Returning Customers</option>
        </select>
      ) : rule.field === 'product_id' ? (
        <select
          value={rule.value || ''}
          onChange={(e) => onUpdate(`${path}.rules.${index}.value`, e.target.value)}
          className="text-[13px] border border-gray-300 p-1 rounded-sm outline-none focus:border-[#2271b1] flex-1"
        >
          <option value="">-- Select Product --</option>
          {products.map(p => (
            <option key={p._id || p.id} value={p._id?.toString() || p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : rule.field === 'category_id' ? (
        <select
          value={rule.value || ''}
          onChange={(e) => onUpdate(`${path}.rules.${index}.value`, e.target.value)}
          className="text-[13px] border border-gray-300 p-1 rounded-sm outline-none focus:border-[#2271b1] flex-1"
        >
          <option value="">-- Select Category --</option>
          {categories.map(c => (
            <option key={c._id} value={c._id?.toString() || c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : rule.field === 'collection_id' ? (
        <select
          value={rule.value || ''}
          onChange={(e) => onUpdate(`${path}.rules.${index}.value`, e.target.value)}
          className="text-[13px] border border-gray-300 p-1 rounded-sm outline-none focus:border-[#2271b1] flex-1"
        >
          <option value="">-- Select Collection --</option>
          {collections.map(c => (
            <option key={c._id} value={c._id?.toString() || c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : (
        <input 
          type="text" 
          value={rule.value} 
          onChange={(e) => onUpdate(`${path}.rules.${index}.value`, e.target.value)}
          placeholder="Value"
          className="text-[13px] border border-gray-300 p-1 rounded-sm outline-none focus:border-[#2271b1] flex-1"
        />
      )}

      <button 
        onClick={() => onRemove(path, index)}
        className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
