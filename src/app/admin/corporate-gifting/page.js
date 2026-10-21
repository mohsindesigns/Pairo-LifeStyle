"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import {
  Gift, Search, Package, Sparkles, ArrowRight, ListChecks,
  ShoppingBag, X, Loader2, Plus,
} from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import RequirePermission from "@/components/admin/RequirePermission";

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 ${accent}`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#646970]">{label}</p>
          <p className="text-[28px] font-extrabold text-[#1d2327] mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent} bg-opacity-15`}>
          <Icon className="w-5 h-5 text-[#1d2327]" />
        </div>
      </div>
    </div>
  );
}

function EnablePicker({ onClose, onEnabled }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [enabling, setEnabling] = useState(null);

  const runSearch = useCallback(async (q) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ enabledOnly: "false" });
      if (q) params.set("search", q);
      const res = await fetch(`/api/admin/corporate-gifting?${params}`);
      const data = await res.json();
      if (res.ok) setResults((data.products || []).filter((p) => !p.corporateGifting?.enabled));
    } catch {
      toast.error("Failed to search products");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced — fire once per settled query, not per keystroke (matches the pattern used
  // elsewhere in the app, e.g. SearchModal.js's GA4 search tracking).
  useEffect(() => {
    const t = setTimeout(() => runSearch(search), search ? 350 : 0);
    return () => clearTimeout(t);
  }, [search, runSearch]);

  const handleEnable = async (product) => {
    setEnabling(product._id);
    try {
      const res = await fetch(`/api/admin/corporate-gifting/${product._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Corporate Gifting enabled for "${product.name}"`);
        onEnabled(data.product);
      } else {
        toast.error(data.error || "Failed to enable");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setEnabling(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <p className="text-[15px] font-bold text-[#1d2327]">Enable Corporate Gifting for a product</p>
          <button onClick={onClose} className="text-[#646970] hover:text-[#1d2327]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 border-b border-black/5">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8c8f94] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name..."
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#ccd0d4] rounded-lg outline-none focus:border-[#2271b1]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-[13px] text-[#8c8f94] italic">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-[#8c8f94] italic">No eligible products found.</div>
          ) : (
            results.map((p) => (
              <div key={p._id} className="flex items-center gap-3 px-5 py-3 border-b border-black/5 hover:bg-black/[0.02]">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/5 shrink-0">
                  {(p.images?.[0] || p.image) && (
                    <img src={p.images?.[0] || p.image} alt={p.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1d2327] truncate">{p.name}</p>
                  <p className="text-[11px] text-[#8c8f94]">${Number(p.price || 0).toFixed(2)}</p>
                </div>
                <button
                  onClick={() => handleEnable(p)}
                  disabled={enabling === p._id}
                  className="shrink-0 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-white bg-[#2271b1] hover:bg-[#135e96] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {enabling === p._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Enable
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function CorporateGiftingDashboard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/corporate-gifting?enabledOnly=true");
      const data = await res.json();
      if (res.ok) setProducts(data.products || []);
    } catch {
      toast.error("Failed to load Corporate Gifting products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const totalItems = products.reduce((sum, p) => sum + (p.corporateGifting?.items?.length || 0), 0);

  return (
    <RequirePermission permission="corporate_gifting.view">
      <AdminPageLayout
        title="Corporate Gifting"
        subtitle="Manage customizable corporate-gifting products and their selectable items"
        breadcrumbs={[{ label: "Products", href: "/admin/products" }, { label: "Corporate Gifting" }]}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 xs:grid-cols-3 gap-3 sm:gap-4">
            <StatCard icon={Gift} label="Enabled Products" value={products.length} accent="bg-indigo-400" />
            <StatCard icon={ListChecks} label="Configured Items" value={totalItems} accent="bg-emerald-400" />
            <StatCard icon={ShoppingBag} label="Orders" value={
              <Link href="/admin/corporate-gifting/orders" className="hover:underline">View all</Link>
            } accent="bg-amber-400" />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-[13px] text-[#646970]">
              Products shoppers can personalize with a multi-select grid of gift items (belt, bottle, bag, etc.), each with its own price and logo upload.
            </p>
            <button
              onClick={() => setPickerOpen(true)}
              className="shrink-0 flex items-center gap-2 bg-gradient-to-r from-[#2271b1] to-[#135e96] text-white px-4 py-2.5 rounded-xl text-[13px] font-bold shadow-md hover:shadow-lg hover:brightness-105 transition-all"
            >
              <Sparkles className="w-4 h-4" /> Enable for a product
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-[13px] text-[#8c8f94] italic">Loading...</div>
            ) : products.length === 0 ? (
              <div className="p-10 text-center">
                <Package className="w-10 h-10 text-black/10 mx-auto mb-3" />
                <p className="text-[14px] font-semibold text-[#1d2327]">No Corporate Gifting products yet</p>
                <p className="text-[13px] text-[#8c8f94] mt-1">Enable the feature on an existing product to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-black/5">
                {products.map((p) => (
                  <Link
                    key={p._id}
                    href={`/admin/corporate-gifting/${p._id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-black/[0.02] transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/5 shrink-0">
                      {(p.images?.[0] || p.image) && (
                        <img src={p.images?.[0] || p.image} alt={p.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-[#1d2327] truncate">{p.name}</p>
                      <p className="text-[12px] text-[#8c8f94]">
                        ${Number(p.price || 0).toFixed(2)} base &middot; {p.corporateGifting?.items?.length || 0} items &middot; min {p.corporateGifting?.minSelections || 3} selections
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Enabled
                    </span>
                    <ArrowRight className="w-4 h-4 text-black/20 group-hover:text-[#2271b1] group-hover:translate-x-0.5 transition-all" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {pickerOpen && (
          <EnablePicker
            onClose={() => setPickerOpen(false)}
            onEnabled={() => { setPickerOpen(false); fetchProducts(); }}
          />
        )}
      </AdminPageLayout>
    </RequirePermission>
  );
}
