"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  ArrowLeft, Plus, Trash2, Upload, Loader2, Save, Gift,
  ToggleLeft, ToggleRight, ImageIcon, DollarSign, Hash,
} from "lucide-react";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import RequirePermission from "@/components/admin/RequirePermission";

function Toggle({ on, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex items-center gap-2 select-none"
    >
      {on ? (
        <ToggleRight className="w-9 h-9 text-emerald-500" />
      ) : (
        <ToggleLeft className="w-9 h-9 text-[#c3c4c7]" />
      )}
      {label && <span className="text-[13px] font-semibold text-[#1d2327]">{label}</span>}
    </button>
  );
}

function ItemRow({ item, onChange, onRemove }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "corporate-gifting");
      const res = await fetch("/api/admin/media/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.uploaded?.[0]?.url) {
        onChange({ ...item, image: data.uploaded[0].url });
      } else {
        toast.error(data.errors?.[0]?.error || data.error || "Upload failed");
      }
    } catch {
      toast.error("Network error during upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-black/5 bg-white hover:border-black/10 transition-colors">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative w-14 h-14 rounded-lg overflow-hidden bg-black/5 shrink-0 flex items-center justify-center group"
      >
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-5 h-5 text-black/20" />
        )}
        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          {uploading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Upload className="w-4 h-4 text-white" />}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <input
        value={item.name}
        onChange={(e) => onChange({ ...item, name: e.target.value })}
        placeholder="Item name (e.g. Belt, Bottle, Bag)"
        className="flex-1 min-w-0 text-[13px] font-semibold text-[#1d2327] border border-[#ccd0d4] rounded-lg px-3 py-2 outline-none focus:border-[#2271b1]"
      />

      <div className="relative w-28 shrink-0">
        <DollarSign className="w-3.5 h-3.5 text-[#8c8f94] absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="number"
          step="0.01"
          min="0"
          value={item.priceDelta}
          onChange={(e) => onChange({ ...item, priceDelta: e.target.value })}
          className="w-full text-[13px] font-semibold text-[#1d2327] border border-[#ccd0d4] rounded-lg pl-7 pr-2 py-2 outline-none focus:border-[#2271b1]"
        />
      </div>

      <Toggle on={item.active !== false} onChange={(v) => onChange({ ...item, active: v })} />

      <button
        type="button"
        onClick={onRemove}
        className="text-[#8c8f94] hover:text-red-600 transition-colors shrink-0 p-1.5"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function CorporateGiftingProductEditor() {
  const { id } = useParams();
  const router = useRouter();

  const [product, setProduct] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [minSelections, setMinSelections] = useState(3);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/corporate-gifting/${id}`);
      const data = await res.json();
      if (res.ok) {
        setProduct(data.product);
        setEnabled(!!data.product.corporateGifting?.enabled);
        setMinSelections(data.product.corporateGifting?.minSelections || 3);
        setItems(data.product.corporateGifting?.items || []);
      } else {
        toast.error(data.error || "Product not found");
      }
    } catch {
      toast.error("Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  const addItem = () => {
    setItems((prev) => [...prev, { name: "", image: "", priceDelta: 0, active: true, _localKey: Date.now() + Math.random() }]);
  };

  const updateItem = (idx, updated) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? updated : it)));
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    const cleanItems = items
      .filter((it) => String(it.name || "").trim())
      .map(({ _localKey, ...rest }) => ({ ...rest, priceDelta: Number(rest.priceDelta) || 0 }));

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/corporate-gifting/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, minSelections: Number(minSelections) || 3, items: cleanItems }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Corporate Gifting settings saved");
        setItems(data.product.corporateGifting?.items || []);
      } else {
        toast.error(data.error || "Save failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RequirePermission permission={["corporate_gifting.view", "corporate_gifting.edit"]}>
      <AdminPageLayout
        title="Manage Corporate Gifting"
        subtitle={product?.name}
        breadcrumbs={[{ label: "Products", href: "/admin/products" }, { label: "Corporate Gifting", href: "/admin/corporate-gifting" }, { label: product?.name || "..." }]}
      >
        {loading ? (
          <div className="p-10 text-center text-[13px] text-[#8c8f94] italic">Loading...</div>
        ) : !product ? (
          <div className="p-10 text-center text-[13px] text-[#8c8f94] italic">Product not found.</div>
        ) : (
          <div className="space-y-6">
            <Link href="/admin/corporate-gifting" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2271b1] hover:text-[#135e96]">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Corporate Gifting
            </Link>

            {/* Header card */}
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 flex items-center gap-4 flex-wrap">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-black/5 shrink-0">
                {(product.images?.[0] || product.image) && (
                  <img src={product.images?.[0] || product.image} alt={product.name} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-[160px]">
                <p className="text-[16px] font-bold text-[#1d2327]">{product.name}</p>
                <p className="text-[12px] text-[#8c8f94]">Base price ${Number(product.price || 0).toFixed(2)}</p>
              </div>
              <Toggle on={enabled} onChange={setEnabled} label={enabled ? "Corporate Gifting Enabled" : "Corporate Gifting Disabled"} />
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-[#8c8f94]" />
                <label className="text-[12px] font-semibold text-[#646970] whitespace-nowrap">Min selections</label>
                <input
                  type="number"
                  min="1"
                  value={minSelections}
                  onChange={(e) => setMinSelections(e.target.value)}
                  className="w-16 text-[13px] font-bold text-center border border-[#ccd0d4] rounded-lg px-2 py-1.5 outline-none focus:border-[#2271b1]"
                />
              </div>
            </div>

            {/* Items manager */}
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-[#2271b1]" />
                  <p className="text-[14px] font-bold text-[#1d2327]">Selectable Items</p>
                </div>
                <button
                  onClick={addItem}
                  className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-[#2271b1] hover:bg-[#135e96] px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              {items.length === 0 ? (
                <p className="text-[13px] text-[#8c8f94] italic py-6 text-center">No items yet — add at least {minSelections} for the storefront minimum-selection gate to be satisfiable.</p>
              ) : (
                <>
                  {items.filter((i) => i.active !== false).length < minSelections && (
                    <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-semibold">
                      Only {items.filter((i) => i.active !== false).length} active item{items.filter((i) => i.active !== false).length === 1 ? "" : "s"} configured, but the minimum selection is {minSelections} — no customer will be able to meet the gate until more active items are added.
                    </p>
                  )}
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <ItemRow
                        key={item._id || item._localKey || idx}
                        item={item}
                        onChange={(updated) => updateItem(idx, updated)}
                        onRemove={() => removeItem(idx)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-gradient-to-r from-[#2271b1] to-[#135e96] text-white px-5 py-3 rounded-xl text-[13px] font-bold shadow-md hover:shadow-lg hover:brightness-105 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        )}
      </AdminPageLayout>
    </RequirePermission>
  );
}
