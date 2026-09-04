"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import MediaPickerModal from "@/components/admin/MediaPickerModal";
import { toast } from "react-hot-toast";
import { Pencil, Trash2, X, Save, Loader2 } from "lucide-react";
import { usePopup } from "@/context/PopupContext";

const inputClass = "border border-[#8c8f94] bg-white text-[13px] px-3 py-2 rounded-[3px] outline-none focus:border-[#2271b1] w-full";

function SizeChartForm({ item, onSave, onClose, isNew }) {
  const [form, setForm] = useState({
    title: item?.title || "",
    description: item?.description || "",
    image: item?.image || "",
    order: item?.order !== undefined ? item.order : 0,
    enabled: item?.enabled !== undefined ? item.enabled : true
  });
  const [saving, setSaving] = useState(false);
  const [mediaPicker, setMediaPicker] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!form.image) return toast.error("Image is required");
    if (!form.title?.trim()) return toast.error("Title is required");

    setSaving(true);
    try {
      const url = isNew ? "/api/admin/size-chart-items" : `/api/admin/size-chart-items/${item._id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success(isNew ? "Size chart added!" : "Size chart updated!");
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
          <h2 className="font-bold text-[15px] text-[#1d2327]">{isNew ? "Add Size Chart" : "Edit Size Chart"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-1.5">Title *</label>
            <input type="text" name="title" value={form.title} onChange={handleChange} placeholder="e.g. Men's Jacket Size Chart" className={inputClass} />
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-1.5">Description (optional)</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={2} placeholder="Optional description or instructions..." className={`${inputClass} resize-none`} />
          </div>

          {/* Image */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#646970] block mb-2">Size Chart Image *</label>
            {form.image && (
              <img src={form.image} alt="Preview" className="w-full object-contain max-h-48 rounded-lg mb-2 border border-[#ccd0d4] bg-gray-50 p-2" />
            )}
            <button
              type="button"
              onClick={() => setMediaPicker(true)}
              className="w-full border-2 border-dashed border-[#ccd0d4] py-2 text-[13px] text-[#2271b1] hover:border-[#2271b1] rounded-lg font-medium"
            >
              {form.image ? "Change Image" : "Select from Media Library"}
            </button>
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
            {saving ? "Saving..." : "Save Chart"}
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

export default function SizeChartItemsPage() {
  const { showConfirm } = usePopup();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/size-chart-items");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load size charts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSaved = (saved) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i._id === saved._id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
    setFormOpen(false);
    setEditingItem(null);
  };

  const handleDelete = async (id) => {
    const ok = await showConfirm("Delete this size chart?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/size-chart-items/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems(prev => prev.filter(i => i._id !== id));
        toast.success("Deleted");
      }
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleToggle = async (item) => {
    try {
      const res = await fetch(`/api/admin/size-chart-items/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !item.enabled })
      });
      if (res.ok) setItems(prev => prev.map(i => i._id === item._id ? { ...i, enabled: !i.enabled } : i));
    } catch { toast.error("Failed"); }
  };

  return (
    <AdminPageLayout title="Size Chart Items" addNewLabel="Add Size Chart" onAddNew={() => { setEditingItem(null); setFormOpen(true); }}>
      <div className="space-y-4">
        <p className="text-[13px] text-[#646970]">
          Manage the size chart images displayed on your <strong>/size-chart</strong> page. Use the Display Order field to control the sequence.
        </p>

        <div className="bg-white border border-[#ccd0d4] overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse text-[13px] min-w-[600px]">
            <thead>
              <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4]">
                <th className="px-4 py-2 font-bold text-[#1d2327]">Preview</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Title</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Order</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Visible</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1]">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center italic text-gray-400">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center italic text-gray-400">No size charts yet. Click "Add Size Chart" to get started.</td></tr>
              ) : (
                items.map(item => (
                  <tr key={item._id} className={`hover:bg-[#f6f7f7] group transition-colors ${!item.enabled ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      {item.image ? (
                        <img src={item.image} alt={item.title} className="h-14 w-20 object-contain rounded border border-[#ccd0d4] bg-gray-50" />
                      ) : (
                        <div className="h-14 w-20 bg-gray-100 rounded border border-[#ccd0d4]" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1d2327]">{item.title}</p>
                      {item.description && <p className="text-[#646970] text-[12px] line-clamp-1">{item.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-[#646970]">{item.order}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggle(item)} className={`w-7 h-4 rounded-full transition-colors ${item.enabled ? "bg-[#2271b1]" : "bg-gray-300"}`} />
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

      {formOpen && (
        <SizeChartForm
          item={editingItem}
          onSave={handleSaved}
          onClose={() => { setFormOpen(false); setEditingItem(null); }}
          isNew={!editingItem}
        />
      )}
    </AdminPageLayout>
  );
}
