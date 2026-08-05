import React, { useState } from 'react';
import { Play, ShoppingCart, Info, CheckCircle2, XCircle, Calculator, AlertTriangle, Trash2, Plus } from 'lucide-react';

export default function SimulationPanel({ promotionData }) {
  const [cart, setCart] = useState({
    subtotal: 0,
    items: [],
    userId: "mock-user-123",
    customerType: "guest",
    email: "mock-guest@example.com"
  });

  const [newItem, setNewItem] = useState({
    id: 'prod-123',
    price: 100,
    quantity: 1,
    categories: 'category-abc',
    collections: 'collection-xyz'
  });

  const [results, setResults] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const runSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/admin/promotions/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          promotion: promotionData, 
          cart: {
            subtotal: cart.subtotal,
            items: cart.items,
            userId: cart.customerType !== 'guest' ? cart.userId : null,
            customerType: cart.customerType,
            email: cart.email
          } 
        })
      });
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  const addCustomItem = () => {
    const item = {
      id: newItem.id || `prod-${Math.floor(Math.random() * 1000)}`,
      price: parseFloat(newItem.price) || 0,
      quantity: parseInt(newItem.quantity) || 1,
      categories: newItem.categories ? newItem.categories.split(',').map(s => s.trim()) : [],
      collections: newItem.collections ? newItem.collections.split(',').map(s => s.trim()) : []
    };

    setCart(prev => {
      const updatedItems = [...prev.items, item];
      const newSubtotal = updatedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      return {
        ...prev,
        items: updatedItems,
        subtotal: parseFloat(newSubtotal.toFixed(2))
      };
    });
  };

  const removeItem = (idx) => {
    setCart(prev => {
      const updatedItems = prev.items.filter((_, i) => i !== idx);
      const newSubtotal = updatedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      return {
        ...prev,
        items: updatedItems,
        subtotal: parseFloat(newSubtotal.toFixed(2))
      };
    });
  };

  return (
    <div className="bg-[#1e293b] text-slate-200 rounded-sm shadow-xl overflow-hidden flex flex-col h-full border border-slate-700 font-sans">
      {/* Header */}
      <div className="bg-[#0f172a] px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-[#2271b1]" />
          <span className="text-[12px] font-bold uppercase tracking-widest text-slate-400">Live Simulator</span>
        </div>
        <button 
          onClick={runSimulation}
          disabled={isSimulating}
          className="flex items-center gap-2 bg-[#2271b1] hover:bg-[#135e96] text-white px-4 py-1.5 rounded-sm text-[12px] font-bold transition-all disabled:opacity-50"
        >
          {isSimulating ? "Processing..." : <><Play className="w-3.5 h-3.5" /> Run Simulation</>}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden h-[500px]">
        {/* Mock Cart Editor */}
        <div className="w-2/5 border-r border-slate-800 p-4 overflow-y-auto space-y-4">
          {/* Customer settings */}
          <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-800 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer Context</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 uppercase block">Customer Type</label>
                <select
                  value={cart.customerType}
                  onChange={(e) => setCart({...cart, customerType: e.target.value})}
                  className="bg-[#0f172a] border border-slate-700 rounded-sm p-1 text-[11px] text-slate-200 outline-none w-full"
                >
                  <option value="guest">Guest</option>
                  <option value="logged_in">Logged In</option>
                  <option value="new">New Customer</option>
                  <option value="returning">Returning Customer</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 uppercase block">Email Address</label>
                <input 
                  type="text"
                  value={cart.email}
                  onChange={(e) => setCart({...cart, email: e.target.value})}
                  className="bg-[#0f172a] border border-slate-700 rounded-sm p-1 text-[11px] text-slate-200 outline-none w-full font-mono"
                />
              </div>
            </div>
          </div>

          {/* Add Mock Product Section */}
          <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-800 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Add Mock Item</span>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1 col-span-2">
                <label className="text-[9px] text-slate-500 uppercase block">Product ID</label>
                <input 
                  type="text"
                  value={newItem.id}
                  onChange={(e) => setNewItem({...newItem, id: e.target.value})}
                  className="bg-[#0f172a] border border-slate-700 rounded-sm p-1 text-[11px] text-slate-200 outline-none w-full font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 uppercase block">Qty</label>
                <input 
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({...newItem, quantity: e.target.value})}
                  className="bg-[#0f172a] border border-slate-700 rounded-sm p-1 text-[11px] text-slate-200 outline-none w-full text-center"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 uppercase block">Category IDs</label>
                <input 
                  type="text"
                  placeholder="cat-1, cat-2"
                  value={newItem.categories}
                  onChange={(e) => setNewItem({...newItem, categories: e.target.value})}
                  className="bg-[#0f172a] border border-slate-700 rounded-sm p-1 text-[11px] text-slate-200 outline-none w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 uppercase block">Collection IDs</label>
                <input 
                  type="text"
                  placeholder="col-1, col-2"
                  value={newItem.collections}
                  onChange={(e) => setNewItem({...newItem, collections: e.target.value})}
                  className="bg-[#0f172a] border border-slate-700 rounded-sm p-1 text-[11px] text-slate-200 outline-none w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="space-y-1 col-span-2">
                <label className="text-[9px] text-slate-500 uppercase block">Price ($)</label>
                <input 
                  type="number"
                  value={newItem.price}
                  onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                  className="bg-[#0f172a] border border-slate-700 rounded-sm p-1 text-[11px] text-slate-200 outline-none w-full text-center font-mono"
                />
              </div>
              <button
                type="button"
                onClick={addCustomItem}
                className="bg-[#2271b1] hover:bg-[#135e96] text-white p-1 rounded-sm text-[11px] font-bold h-[28px] flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" /> ADD
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Cart Subtotal: <span className="font-mono text-white ml-1">${cart.subtotal.toFixed(2)}</span></label>
            </div>
            <div className="space-y-1">
              {cart.items.map((item, idx) => (
                <div key={idx} className="bg-[#0f172a] p-2.5 rounded-sm border border-slate-800 text-[11px] space-y-1.5 relative group">
                  <div className="flex justify-between items-center">
                    <span className="font-bold font-mono text-slate-300">{item.id} (x{item.quantity})</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-mono">${(item.price * item.quantity).toFixed(2)}</span>
                      <button 
                        onClick={() => removeItem(idx)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {(item.categories?.length > 0 || item.collections?.length > 0) && (
                    <div className="flex flex-wrap gap-1 text-[9px]">
                      {item.categories?.map((cat, cIdx) => (
                        <span key={cIdx} className="bg-blue-900/30 text-blue-300 border border-blue-800/40 px-1 py-0.5 rounded-sm">Category: {cat}</span>
                      ))}
                      {item.collections?.map((col, cIdx) => (
                        <span key={cIdx} className="bg-purple-900/30 text-purple-300 border border-purple-800/40 px-1 py-0.5 rounded-sm">Collection: {col}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {cart.items.length === 0 && <div className="text-[11px] text-slate-600 italic text-center py-6 border border-dashed border-slate-800">Cart is empty</div>}
            </div>
          </div>
        </div>

        {/* Results / Trace */}
        <div className="flex-1 bg-[#0f172a] p-4 overflow-y-auto">
          {results ? (
            <div className="space-y-6">
              <div className="flex items-center justify-around bg-[#1e293b] p-4 rounded-sm border border-slate-700">
                <div className="text-center">
                    <div className="text-[10px] text-slate-500 uppercase mb-1">Status</div>
                    <div className={`text-sm font-bold ${results.isEligible ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {results.isEligible ? 'ELIGIBLE' : 'REJECTED'}
                    </div>
                </div>
                <div className="w-[1px] h-8 bg-slate-700"></div>
                <div className="text-center">
                    <div className="text-[10px] text-slate-500 uppercase mb-1">Discount</div>
                    <div className="text-sm font-bold text-white">${results.discountTotal?.toFixed(2) || '0.00'}</div>
                </div>
                <div className="w-[1px] h-8 bg-slate-700"></div>
                <div className="text-center">
                    <div className="text-[10px] text-slate-500 uppercase mb-1">Final Total</div>
                    <div className="text-sm font-bold text-[#2271b1]">${(cart.subtotal - (results.discountTotal || 0)).toFixed(2)}</div>
                </div>
              </div>

              {!results.isEligible && results.appliedPromotions?.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-sm flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                    <div className="text-[11px] text-amber-200">
                        <span className="font-bold block">CONFLICT BLOCKED</span>
                        This promotion met all conditions but was blocked by: 
                        <span className="text-white ml-1">
                          {results.appliedPromotions.map(p => p.title).join(', ')}
                        </span>
                    </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                   <Info className="w-3.5 h-3.5" /> Execution Trace
                </h4>
                <div className="space-y-2 border-l border-slate-800 ml-2 pl-4">
                   {results.debugMetadata ? (
                      <TraceNode node={results.debugMetadata} />
                   ) : (
                      <div className="text-[11px] text-slate-500 italic">No trace metadata available.</div>
                   )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                <div className="p-4 bg-slate-900 rounded-full border border-slate-800">
                  <Play className="w-8 h-8 opacity-20" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium">Ready for simulation</div>
                  <div className="text-[11px] opacity-60">Configure your rules and mock cart, then hit &quot;Run Simulation&quot;</div>
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TraceNode({ node }) {
  if (node.operator) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {node.passed ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-rose-500" />}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${node.passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {node.operator} Group
          </span>
        </div>
        <div className="border-l border-slate-800 ml-2 pl-4 space-y-2">
          {node.results?.map((child, i) => <TraceNode key={i} node={child} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      {node.passed ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-rose-500" />}
      <div className={`text-[11px] font-mono p-1 rounded-sm border ${node.passed ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300' : 'border-rose-500/20 bg-rose-500/5 text-rose-300'}`}>
        {node.field} {node.op} {Array.isArray(node.value) ? `[${node.value.join(', ')}]` : node.value}
      </div>
      {!node.passed && node.explanation && (
        <span className="text-[10px] text-slate-500 italic opacity-0 group-hover:opacity-100 transition-opacity">
          &larr; {node.explanation}
        </span>
      )}
    </div>
  );
}
