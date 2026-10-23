import React, { useState } from 'react';
import { Play, CheckCircle2, XCircle, AlertTriangle, Trash2 } from 'lucide-react';

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
    <section className="wp-postbox" aria-labelledby="promo-simulator-title">
      <div className="wp-postbox-head">
        <h2 id="promo-simulator-title">Simulator</h2>
        <button
          type="button"
          onClick={runSimulation}
          disabled={isSimulating}
          className="wp-btn wp-btn-primary"
        >
          {isSimulating ? "Processing..." : <><Play className="w-4 h-4" aria-hidden="true" /> Run simulation</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Mock Cart Editor */}
        <div className="flex flex-col gap-4 min-w-0 border-b lg:border-b-0" style={{ padding: 12, borderColor: 'var(--wp-border-2)' }}>
          {/* Customer settings */}
          <div className="min-w-0">
            <h3 className="wp-strong" style={{ fontSize: 13, margin: '0 0 8px' }}>Customer</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="block min-w-0">
                <span className="wp-label">Customer type</span>
                <select
                  value={cart.customerType}
                  onChange={(e) => setCart({...cart, customerType: e.target.value})}
                  className="wp-select wp-full"
                >
                  <option value="guest">Guest</option>
                  <option value="logged_in">Logged In</option>
                  <option value="new">New Customer</option>
                  <option value="returning">Returning Customer</option>
                </select>
              </label>
              <label className="block min-w-0">
                <span className="wp-label">Email address</span>
                <input
                  type="text"
                  value={cart.email}
                  onChange={(e) => setCart({...cart, email: e.target.value})}
                  className="wp-input wp-full"
                />
              </label>
            </div>
          </div>

          {/* Add Mock Product Section */}
          <div className="min-w-0" style={{ borderTop: '1px solid var(--wp-border-2)', paddingTop: 12 }}>
            <h3 className="wp-strong" style={{ fontSize: 13, margin: '0 0 8px' }}>Add a test item</h3>
            <div className="grid grid-cols-3 gap-2">
              <label className="block min-w-0 col-span-2">
                <span className="wp-label">Product ID</span>
                <input
                  type="text"
                  value={newItem.id}
                  onChange={(e) => setNewItem({...newItem, id: e.target.value})}
                  className="wp-input wp-full"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                />
              </label>
              <label className="block min-w-0">
                <span className="wp-label">Qty</span>
                <input
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({...newItem, quantity: e.target.value})}
                  className="wp-input wp-full"
                />
              </label>
              <label className="block min-w-0 col-span-3 sm:col-span-1 lg:col-span-3 xl:col-span-1">
                <span className="wp-label">Category IDs</span>
                <input
                  type="text"
                  placeholder="cat-1, cat-2"
                  value={newItem.categories}
                  onChange={(e) => setNewItem({...newItem, categories: e.target.value})}
                  className="wp-input wp-full"
                />
              </label>
              <label className="block min-w-0 col-span-3 sm:col-span-1 lg:col-span-3 xl:col-span-1">
                <span className="wp-label">Collection IDs</span>
                <input
                  type="text"
                  placeholder="col-1, col-2"
                  value={newItem.collections}
                  onChange={(e) => setNewItem({...newItem, collections: e.target.value})}
                  className="wp-input wp-full"
                />
              </label>
              <label className="block min-w-0 col-span-3 sm:col-span-1 lg:col-span-3 xl:col-span-1">
                <span className="wp-label">Price ($)</span>
                <input
                  type="number"
                  value={newItem.price}
                  onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                  className="wp-input wp-full"
                />
              </label>
            </div>
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={addCustomItem} className="wp-btn">
                Add item to cart
              </button>
            </div>
          </div>

          <div className="min-w-0" style={{ borderTop: '1px solid var(--wp-border-2)', paddingTop: 12 }}>
            <div className="wp-kv" style={{ paddingTop: 0 }}>
              <span className="wp-kv-k wp-strong">Test cart</span>
              <span>Subtotal: <span className="wp-kv-v">${cart.subtotal.toFixed(2)}</span></span>
            </div>
            <div className="flex flex-col gap-1.5">
              {cart.items.map((item, idx) => (
                <div key={idx} className="min-w-0" style={{ border: '1px solid var(--wp-border-2)', background: 'var(--wp-alt)', padding: '6px 8px' }}>
                  <div className="flex items-center gap-2">
                    <span className="wp-strong flex-1 min-w-0" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', wordBreak: 'break-all' }}>{item.id} (x{item.quantity})</span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="wp-btn"
                      style={{ borderColor: 'var(--wp-danger)', color: 'var(--wp-danger)', padding: 0, minWidth: 40 }}
                      aria-label={`Remove ${item.id} from test cart`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                  {(item.categories?.length > 0 || item.collections?.length > 0) && (
                    <div className="flex flex-wrap gap-1 wp-small" style={{ marginTop: 4 }}>
                      {item.categories?.map((cat, cIdx) => (
                        <span key={cIdx} className="wp-pill wp-pill-sm wp-st-shipped">Category: {cat}</span>
                      ))}
                      {item.collections?.map((col, cIdx) => (
                        <span key={cIdx} className="wp-pill wp-pill-sm wp-st-packed">Collection: {col}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {cart.items.length === 0 && <p className="wp-empty" style={{ textAlign: 'center' }}>Cart is empty</p>}
            </div>
          </div>
        </div>

        {/* Results / Trace */}
        <div className="min-w-0 lg:border-l" style={{ padding: 12, borderColor: 'var(--wp-border-2)' }} aria-live="polite">
          {results ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3" style={{ border: '1px solid var(--wp-border-2)' }}>
                <div className="min-w-0" style={{ padding: '10px 12px', borderRight: '1px solid var(--wp-border-2)' }}>
                  <div className="wp-muted wp-small">Status</div>
                  <div className="wp-strong" style={{ color: results.isEligible ? 'var(--wp-ok)' : 'var(--wp-danger)' }}>
                    {results.isEligible ? 'Eligible' : 'Rejected'}
                  </div>
                </div>
                <div className="min-w-0" style={{ padding: '10px 12px', borderRight: '1px solid var(--wp-border-2)' }}>
                  <div className="wp-muted wp-small">Discount</div>
                  <div className="wp-strong">${results.discountTotal?.toFixed(2) || '0.00'}</div>
                </div>
                <div className="min-w-0" style={{ padding: '10px 12px' }}>
                  <div className="wp-muted wp-small">Final total</div>
                  <div className="wp-strong">${(cart.subtotal - (results.discountTotal || 0)).toFixed(2)}</div>
                </div>
              </div>

              {!results.isEligible && results.appliedPromotions?.length > 0 && (
                <div className="wp-notice wp-notice-warning" style={{ margin: 0, boxShadow: 'none' }}>
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" style={{ color: '#996800' }} />
                  <p>
                    <strong>Conflict blocked.</strong> This promotion met all conditions but was blocked by:{' '}
                    <span className="wp-strong">{results.appliedPromotions.map(p => p.title).join(', ')}</span>
                  </p>
                </div>
              )}

              <div className="min-w-0">
                <h3 className="wp-strong" style={{ fontSize: 13, margin: '0 0 8px' }}>Execution trace</h3>
                <div className="flex flex-col gap-2" style={{ borderLeft: '1px solid var(--wp-border-2)', marginLeft: 6, paddingLeft: 12 }}>
                  {results.debugMetadata ? (
                    <TraceNode node={results.debugMetadata} />
                  ) : (
                    <p className="wp-muted" style={{ margin: 0 }}>No trace metadata available.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="wp-empty" style={{ textAlign: 'center', padding: '32px 8px' }}>
              <p className="wp-strong" style={{ margin: '0 0 4px' }}>Ready for simulation</p>
              <p style={{ margin: 0 }}>Configure your rules and test cart, then click &quot;Run simulation&quot;.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TraceNode({ node }) {
  if (node.operator) {
    return (
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2">
          {node.passed
            ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--wp-ok)' }} aria-label="Passed" />
            : <XCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--wp-danger)' }} aria-label="Failed" />}
          <span className={`wp-pill wp-pill-sm ${node.passed ? 'wp-st-published' : 'wp-st-cancelled'}`}>
            {node.operator} Group
          </span>
        </div>
        <div className="flex flex-col gap-2" style={{ borderLeft: '1px solid var(--wp-border-2)', marginLeft: 6, paddingLeft: 12 }}>
          {node.results?.map((child, i) => <TraceNode key={i} node={child} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      {node.passed
        ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--wp-ok)' }} aria-label="Passed" />
        : <XCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--wp-danger)' }} aria-label="Failed" />}
      <code
        className="wp-small min-w-0"
        style={{
          padding: '2px 6px',
          border: `1px solid ${node.passed ? '#c6e1c6' : '#eba3a3'}`,
          background: node.passed ? '#f0f8ee' : '#fcf0f1',
          color: 'var(--wp-text)',
          wordBreak: 'break-word',
        }}
      >
        {node.field} {node.op} {Array.isArray(node.value) ? `[${node.value.join(', ')}]` : node.value}
      </code>
      {!node.passed && node.explanation && (
        <span className="wp-muted wp-small">&larr; {node.explanation}</span>
      )}
    </div>
  );
}
