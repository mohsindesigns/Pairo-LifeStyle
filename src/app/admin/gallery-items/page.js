"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import MediaPickerModal from "@/components/admin/MediaPickerModal";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, GripVertical, Eye, EyeOff, X, Save, Loader2, Search } from "lucide-react";
import { usePopup } from "@/context/PopupContext";

const inputClass = "border border-[#8c8f94] bg-white text-[13px] px-3 py-2 rounded-[3px] outline-none focus:border-[#2271b1] w-full";

function GalleryItemForm({ item, products, onSave, onClose, isNew }) {
  const [form, setForm] = useState({
    image: item?.image || "",
    title: item?.title || "",
    description: item?.description || "",
    linkedProduct: item?.linkedProduct?._id || item?.linkedProduct || "",
    enabled: item?.enabled !== undefined ? item.enabled : true,
    order: item?.order !== undefined ? item.order : 0
  });
  const [saving, setSaving] = useState(false);
  const [mediaPicker, setMediaPicker] = useState(false);
  const [productSearch, setProductSearch] = useState(
    item?.linkedProduct?.name || ""
  );
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (productSearch.length > 0) {
      const filtered = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.slug.toLowerCase().includes(productSearch.toLowerCase())
      );
      setFilteredProducts(filtered.slice(0, 8));
      setShowDropdown(true);
    } else {
      setFilteredProducts([]);
      setShowDropdown(false);
    }
  }, [productSearch, products]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSave = async () => {
    if (!form.image) return toast.error("Image is required");
    if (!form.title?.trim()) return toast.error("Title is required");

    setSaving(true);
    try {
      const url = isNew
        ? "/api/admin/gallery-items"
        : `/api/admin/gallery-items/${item._id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, linkedProduct: form.linkedProduct || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success(isNew ? "Gallery item added!" : "Gallery item updated!");
      onSave(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-[15px] text-[#1d2327]">{isNew ? "Add Gallery Item" : "Edit Gallery Item"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Image */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-2">Image *</label>
            {form.image && (
              <img src={form.image} alt="Preview" className="w-full aspect-[3/2] object-cover rounded-lg mb-2 border border-[#ccd0d4]" />
            )}
            <button
              type="button"
              onClick={() => setMediaPicker(true)}
              className="w-full border-2 border-dashed border-[#ccd0d4] py-2 text-[13px] text-[#2271b1] hover:border-[#2271b1] rounded-lg font-medium"
            >
              {form.image ? "Change Image" : "Select Image from Media Library"}
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-1.5">Title *</label>
            <input type="text" name="title" value={form.title} onChange={handleChange} placeholder="e.g. A-1 Shearling Flight Jacket" className={inputClass} />
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-1.5">Short Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={2} placeholder="Optional caption..." className={`${inputClass} resize-none`} />
          </div>

          {/* Linked Product */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-1.5">Linked Product</label>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#646970]" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value);
                    if (!e.target.value) setForm(prev => ({ ...prev, linkedProduct: "" }));
                  }}
                  className={`${inputClass} pl-8`}
                />
              </div>
              {showDropdown && filteredProducts.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-white border border-[#ccd0d4] rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                  {filteredProducts.map(p => (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, linkedProduct: p._id }));
                        setProductSearch(p.name);
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-[#f0f6fb] flex items-center gap-3"
                    >
                      {p.image && <img src={p.image} alt={p.name} className="w-8 h-8 object-cover rounded" />}
                      <div>
                        <p className="font-medium text-[#1d2327]">{p.name}</p>
                        <p className="text-[11px] text-[#646970]">/{p.slug}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {form.linkedProduct && (
              <div className="mt-1.5 flex items-center justify-between bg-[#f0f6fb] border border-[#b3d4f0] rounded px-2 py-1">
                <span className="text-[12px] text-[#2271b1] font-medium">Product linked ✓</span>
                <button type="button" onClick={() => { setForm(prev => ({ ...prev, linkedProduct: "" })); setProductSearch(""); }} className="text-[11px] text-red-400 hover:text-red-600">Clear</button>
              </div>
            )}
          </div>

          {/* Order + Enabled */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-1.5">Display Order</label>
              <input type="number" name="order" value={form.order} onChange={handleChange} min={0} className={inputClass} />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-1.5">Visible</label>
              <select name="enabled" value={form.enabled ? "true" : "false"} onChange={e => setForm(prev => ({ ...prev, enabled: e.target.value === "true" }))} className={inputClass}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="border border-[#8c8f94] text-[#3c434a] px-4 py-1.5 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="bg-[#2271b1] text-white px-4 py-1.5 rounded-[3px] text-[13px] font-medium hover:bg-[#135e96] flex items-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving..." : "Save Item"}
          </button>
        </div>
      </div>

      {mediaPicker && (
        <MediaPickerModal
          onSelect={url => { setForm(prev => ({ ...prev, image: url })); setMediaPicker(false); }}
          onClose={() => setMediaPicker(false)}
        />
      )}
    </div>
  );
}

export default function GalleryItemsPage() {
  const { showConfirm } = usePopup();
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, prodsRes] = await Promise.all([
        fetch("/api/admin/gallery-items"),
        fetch("/api/admin/products")
      ]);
      const [itemsData, prodsData] = await Promise.all([itemsRes.json(), prodsRes.json()]);
      setItems(Array.isArray(itemsData) ? itemsData : []);
      const prods = Array.isArray(prodsData) ? prodsData : (prodsData?.products || []);
      setProducts(prods);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaved = (savedItem) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i._id === savedItem._id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = savedItem;
        return copy;
      }
      return [savedItem, ...prev];
    });
    setFormOpen(false);
    setEditingItem(null);
  };

  const handleDelete = async (id) => {
    const ok = await showConfirm("Delete this gallery item?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/gallery-items/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems(prev => prev.filter(i => i._id !== id));
        toast.success("Deleted");
      }
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleToggleEnabled = async (item) => {
    try {
      const res = await fetch(`/api/admin/gallery-items/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !item.enabled })
      });
      if (res.ok) {
        setItems(prev => prev.map(i => i._id === item._id ? { ...i, enabled: !i.enabled } : i));
      }
    } catch {
      toast.error("Failed to toggle");
    }
  };

  return (
    <AdminPageLayout title="Gallery Items" addNewLabel="Add Gallery Item" onAddNew={() => { setEditingItem(null); setFormOpen(true); }}>
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[13px] text-blue-700">
          <strong>Tip:</strong> Gallery items with a linked product will show a "View Product" button on the public gallery page. The link is stored by product ID, so it stays correct even if the product permalink changes.
        </div>

        {/* Items Table */}
        <div className="bg-white border border-[#ccd0d4] overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
            <thead>
              <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4]">
                <th className="px-4 py-2 font-bold text-[#1d2327]">Image</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Title</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Linked Product</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Order</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Visible</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1]">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center italic text-gray-400">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center italic text-gray-400">No gallery items yet. Click "Add Gallery Item" to get started.</td></tr>
              ) : (
                items.map(item => (
                  <tr key={item._id} className={`hover:bg-[#f6f7f7] group transition-colors ${!item.enabled ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      {item.image ? (
                        <img src={item.image} alt={item.title} className="w-14 h-14 object-cover rounded-lg border border-[#ccd0d4]" />
                      ) : (
                        <div className="w-14 h-14 bg-gray-100 rounded-lg border border-[#ccd0d4]" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1d2327]">{item.title}</p>
                      {item.description && <p className="text-[#646970] text-[12px] line-clamp-1">{item.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-[#646970]">
                      {item.linkedProduct?.name ? (
                        <span className="text-[#2271b1] font-medium">{item.linkedProduct.name}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[#646970]">{item.order}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggleEnabled(item)} className={`w-7 h-4 rounded-full transition-colors ${item.enabled ? "bg-[#2271b1]" : "bg-gray-300"}`} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingItem(item); setFormOpen(true); }} className="text-[#2271b1] text-[12px] font-medium hover:text-[#135e96] flex items-center gap-1">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => handleDelete(item._id)} className="text-[#d63638] text-[12px] font-medium hover:text-[#bc0b0d] flex items-center gap-1">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      {formOpen && (
        <GalleryItemForm
          item={editingItem}
          products={products}
          onSave={handleSaved}
          onClose={() => { setFormOpen(false); setEditingItem(null); }}
          isNew={!editingItem}
        />
      )}
    </AdminPageLayout>
  );
}
