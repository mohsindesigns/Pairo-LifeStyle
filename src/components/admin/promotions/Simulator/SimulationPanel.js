import React, { useState, useEffect } from 'react';
import { Play, ShoppingCart, Info, CheckCircle2, XCircle, Calculator, ChevronRight, AlertTriangle } from 'lucide-react';

export default function SimulationPanel({ promotionData }) {
  const [cart, setCart] = useState({
    subtotal: 100,
    items: [],
    userId: "mock-user-123"
  });
  const [results, setResults] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const runSimulation = async () => {
    setIsSimulating(true);
    try {
      // We'll call a dedicated simulation API or import the engine logic directly if possible
      // For now, we'll use a fetch to the actual evaluation API with a "simulate" flag
      const res = await fetch('/api/admin/promotions/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promotion: promotionData, cart })
      });
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  const addMockItem = () => {
    const newItem = { id: `prod-${Math.floor(Math.random() * 1000)}`, price: 50, quantity: 1 };
    setCart(prev => ({ 
        ...prev, 
        items: [...prev.items, newItem],
        subtotal: prev.subtotal + newItem.price
    }));
  };

  return (
    <div className="bg-[#1e293b] text-slate-200 rounded-sm shadow-xl overflow-hidden flex flex-col h-full border border-slate-700">
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

      <div className="flex flex-1 overflow-hidden">
        {/* Mock Cart Editor */}
        <div className="w-1/3 border-r border-slate-800 p-4 overflow-y-auto space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Cart Subtotal</label>
            <div className="flex items-center bg-[#0f172a] border border-slate-700 rounded-sm p-2">
                <span className="text-slate-500 mr-2">$</span>
                <input 
                  type="number" 
                  value={cart.subtotal} 
                  onChange={(e) => setCart({...cart, subtotal: parseFloat(e.target.value)})}
                  className="bg-transparent outline-none w-full text-sm font-mono"
                />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Cart Items ({cart.items.length})</label>
                <button onClick={addMockItem} className="text-[10px] text-[#2271b1] hover:underline">+ Add Item</button>
            </div>
            <div className="space-y-1">
              {cart.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between bg-[#0f172a] p-2 rounded-sm border border-slate-800 text-[11px]">
                  <span className="font-mono text-slate-400">{item.id}</span>
                  <div className="flex items-center gap-2">
                     <span className="text-slate-500">${item.price}</span>
                     <button className="text-slate-600 hover:text-rose-400" onClick={() => {
                        const newItems = cart.items.filter((_, i) => i !== idx);
                        setCart({...cart, items: newItems, subtotal: cart.subtotal - item.price});
                     }}>&times;</button>
                  </div>
                </div>
              ))}
              {cart.items.length === 0 && <div className="text-[11px] text-slate-600 italic text-center py-4 border border-dashed border-slate-800">Cart is empty</div>}
            </div>
          </div>
        </div>

        {/* Results / Trace */}
        <div className="flex-1 bg-[#0f172a] p-4 overflow-y-auto">
          {results ? (
            <div className="space-y-6">
              {/* Summary Bar */}
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

              {/* Conflict Warning */}
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

              {/* Trace Log */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                   <Info className="w-3 h-3" /> Execution Trace
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
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${node.passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
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
            <div className={`text-[11px] font-mono p-1.5 rounded-sm border ${node.passed ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300' : 'border-rose-500/20 bg-rose-500/5 text-rose-300'}`}>
                {node.field} {node.op} {node.value}
            </div>
            {!node.passed && node.explanation && (
                <span className="text-[10px] text-slate-500 italic opacity-0 group-hover:opacity-100 transition-opacity">
                    &larr; {node.explanation}
                </span>
            )}
        </div>
    );
}
