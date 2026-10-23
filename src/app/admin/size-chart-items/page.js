"use client";

import { useEffect, useState, useCallback } from "react";
import MediaPickerModal from "@/components/admin/MediaPickerModal";
import { toast } from "react-hot-toast";
import { X, Loader2 } from "lucide-react";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import { Page, PageHeader } from "@/components/admin/ui";

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
    <div className="wp-modal-backdrop" onClick={onClose}>
      <div
        className="wp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="size-chart-item-title"
        style={{ maxWidth: 520 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="wp-modal-head">
          <h2 id="size-chart-item-title" style={{ minWidth: 0, wordBreak: "break-word" }}>{isNew ? "Add Size Chart" : "Edit Size Chart"}</h2>
          <button type="button" onClick={onClose} className="wp-notice-dismiss" aria-label="Close dialog">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="wp-modal-body">
          <div className="wp-field">
            <label htmlFor="sci-title" className="wp-label">Title <span style={{ color: "#d63638" }}>*</span></label>
            <input id="sci-title" type="text" name="title" value={form.title} onChange={handleChange} placeholder="e.g. Men's Jacket Size Chart" className="wp-input wp-full" />
          </div>

          <div className="wp-field">
            <label htmlFor="sci-description" className="wp-label">Description <span className="wp-muted">(optional)</span></label>
            <textarea id="sci-description" name="description" value={form.description} onChange={handleChange} rows={2} placeholder="Optional description or instructions..." className="wp-textarea wp-full" />
          </div>

          <div className="wp-field">
            <span className="wp-label">Size chart image <span style={{ color: "#d63638" }}>*</span></span>
            {form.image && (
              <img src={form.image} alt="Preview" style={{ width: "100%", maxHeight: 192, objectFit: "contain", border: "1px solid #dcdcde", background: "#f6f7f7", padding: 8, marginBottom: 8 }} />
            )}
            <button type="button" onClick={() => setMediaPicker(true)} className="wp-btn">
              {form.image ? "Change Image" : "Select from Media Library"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <div className="wp-field">
              <label htmlFor="sci-order" className="wp-label">Display order</label>
              <input id="sci-order" type="number" name="order" value={form.order} onChange={handleChange} min={0} className="wp-input wp-full" />
            </div>
            <div className="wp-field">
              <label htmlFor="sci-enabled" className="wp-label">Visible</label>
              <select id="sci-enabled" name="enabled" value={form.enabled ? "true" : "false"} onChange={e => setForm(prev => ({ ...prev, enabled: e.target.value === "true" }))} className="wp-select wp-full">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        </div>

        <div className="wp-modal-foot">
          <button type="button" onClick={onClose} className="wp-btn">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="wp-btn wp-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
    <RequirePermission permission="products.edit">
    <Page>
      <PageHeader title="Size Chart Items" />
      <p className="wp-desc" style={{ marginTop: 0 }}>
        Manage the size chart images displayed on your <strong>/size-chart</strong> page. Use the Display Order field to control the sequence.
      </p>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <span className="wp-pages">{items.length} item{items.length === 1 ? "" : "s"}</span>
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: 100 }}>Preview</th>
              <th scope="col">Title</th>
              <th scope="col" className="wp-hide-sm wp-num">Order</th>
              <th scope="col" style={{ width: 120 }}>Visible</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="wp-muted">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="wp-muted">No size charts yet. Click &ldquo;Add Size Chart&rdquo; to get started.</td></tr>
            ) : (
              items.map(item => (
                <tr key={item._id}>
                  <td>
                    {item.image ? (
                      <img src={item.image} alt={item.title} style={{ height: 56, width: 80, objectFit: "contain", border: "1px solid #dcdcde", background: "#f6f7f7", opacity: item.enabled ? 1 : 0.5 }} />
                    ) : (
                      <div style={{ height: 56, width: 80, border: "1px solid #dcdcde", background: "#f0f0f1" }} />
                    )}
                  </td>
                  <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                    <button type="button" className="wp-row-title" style={{ background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer" }} onClick={() => { setEditingItem(item); setFormOpen(true); }}>
                      {item.title}
                    </button>
                    {!item.enabled && <span className="wp-muted"> — Hidden</span>}
                    {item.description && <div className="wp-muted wp-small line-clamp-1">{item.description}</div>}
                    <div className="wp-mobile-meta">Order: {item.order}</div>
                    <div className="wp-row-actions">
                      <span><button type="button" onClick={() => { setEditingItem(item); setFormOpen(true); }}>Edit</button></span>
                      <span><button type="button" onClick={() => handleDelete(item._id)} className="is-danger">Delete</button></span>
                    </div>
                  </td>
                  <td className="wp-hide-sm wp-num">{item.order}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleToggle(item)}
                      role="switch"
                      aria-checked={!!item.enabled}
                      aria-label={`${item.title}: ${item.enabled ? "visible" : "hidden"}`}
                      className="wp-btn"
                      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                    >
                      <span aria-hidden="true" style={{ position: "relative", width: 28, height: 16, borderRadius: 8, background: item.enabled ? "#2271b1" : "#c3c4c7", flex: "none" }}>
                        <span style={{ position: "absolute", top: 2, left: item.enabled ? 14 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff" }} />
                      </span>
                      {item.enabled ? "Yes" : "No"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <SizeChartForm
          item={editingItem}
          onSave={handleSaved}
          onClose={() => { setFormOpen(false); setEditingItem(null); }}
          isNew={!editingItem}
        />
      )}
    </Page>
    </RequirePermission>
  );
}
