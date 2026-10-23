"use client";

import { useEffect, useState, useCallback } from "react";
import { Page, PageHeader } from "@/components/admin/ui";
import MediaPickerModal from "@/components/admin/MediaPickerModal";
import { toast } from "react-hot-toast";
import { X, Loader2 } from "lucide-react";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

const inputClass = "wp-input wp-full";

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
    <>
    <div className="wp-modal-backdrop" onClick={onClose}>
      <div
        className="wp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-item-form-title"
        style={{ maxWidth: 560 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="wp-modal-head">
          <h2 id="gallery-item-form-title">{isNew ? "Add Gallery Item" : "Edit Gallery Item"}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="flex items-center justify-center" style={{ width: 40, height: 40, background: "none", border: 0, color: "#646970", cursor: "pointer" }}>
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="wp-modal-body">
          {/* Image */}
          <div className="wp-field">
            <span className="wp-label">Image <span aria-hidden="true" style={{ color: "#d63638" }}>*</span></span>
            {form.image && (
              <img src={form.image} alt="Preview" className="w-full aspect-[3/2] object-cover" style={{ marginBottom: 8, border: "1px solid #dcdcde" }} />
            )}
            <button
              type="button"
              onClick={() => setMediaPicker(true)}
              className="wp-btn"
            >
              {form.image ? "Change Image" : "Select Image from Media Library"}
            </button>
          </div>

          {/* Title */}
          <div className="wp-field">
            <label htmlFor="gi-title" className="wp-label">Title <span aria-hidden="true" style={{ color: "#d63638" }}>*</span></label>
            <input id="gi-title" type="text" name="title" value={form.title} onChange={handleChange} placeholder="e.g. A-1 Shearling Flight Jacket" className={inputClass} />
          </div>

          {/* Description */}
          <div className="wp-field">
            <label htmlFor="gi-description" className="wp-label">Short Description</label>
            <textarea id="gi-description" name="description" value={form.description} onChange={handleChange} rows={2} placeholder="Optional caption..." className="wp-textarea wp-full" />
          </div>

          {/* Linked Product */}
          <div className="wp-field">
            <label htmlFor="gi-product-search" className="wp-label">Linked Product</label>
            <div className="relative">
              <input
                id="gi-product-search"
                type="search"
                placeholder="Search products..."
                value={productSearch}
                onChange={e => {
                  setProductSearch(e.target.value);
                  if (!e.target.value) setForm(prev => ({ ...prev, linkedProduct: "" }));
                }}
                className={inputClass}
                autoComplete="off"
              />
              {showDropdown && filteredProducts.length > 0 && (
                <div className="absolute w-full overflow-y-auto" style={{ top: "100%", marginTop: 2, background: "#fff", border: "1px solid #c3c4c7", boxShadow: "0 3px 6px rgba(0,0,0,0.1)", zIndex: 10, maxHeight: 192 }}>
                  {filteredProducts.map(p => (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, linkedProduct: p._id }));
                        setProductSearch(p.name);
                        setShowDropdown(false);
                      }}
                      className="w-full text-left flex items-center gap-3 hover:bg-[#f0f6fc]"
                      style={{ padding: "6px 10px", minHeight: 40, background: "none", border: 0, borderBottom: "1px solid #f0f0f1", cursor: "pointer" }}
                    >
                      {p.image && <img src={p.image} alt={p.name} className="w-8 h-8 object-cover" />}
                      <div className="min-w-0">
                        <p className="wp-strong" style={{ margin: 0 }}>{p.name}</p>
                        <p className="wp-muted wp-small" style={{ margin: 0 }}>/{p.slug}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {form.linkedProduct && (
              <p className="wp-desc flex flex-wrap items-center gap-2">
                <span style={{ color: "#00a32a" }}>Product linked ✓</span>
                <button type="button" onClick={() => { setForm(prev => ({ ...prev, linkedProduct: "" })); setProductSearch(""); }} style={{ background: "none", border: 0, padding: 0, color: "#b32d2e", textDecoration: "underline", cursor: "pointer" }}>Clear</button>
              </p>
            )}
          </div>

          {/* Order + Enabled */}
          <div className="grid grid-cols-2 gap-3">
            <div className="wp-field">
              <label htmlFor="gi-order" className="wp-label">Display Order</label>
              <input id="gi-order" type="number" name="order" value={form.order} onChange={handleChange} min={0} className={inputClass} />
            </div>
            <div className="wp-field">
              <label htmlFor="gi-enabled" className="wp-label">Visible</label>
              <select id="gi-enabled" name="enabled" value={form.enabled ? "true" : "false"} onChange={e => setForm(prev => ({ ...prev, enabled: e.target.value === "true" }))} className="wp-select wp-full">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        </div>

        <div className="wp-modal-foot">
          <button type="button" onClick={onClose} className="wp-btn">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="wp-btn wp-btn-primary">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : null}
            {saving ? "Saving..." : "Save Item"}
          </button>
        </div>
      </div>
    </div>

      {/* Rendered outside the form backdrop so clicks in the picker don't close the form */}
      <MediaPickerModal
        open={mediaPicker}
        title="Select Image"
        onSelect={media => {
          const picked = Array.isArray(media) ? media[0] : media;
          const url = typeof picked === "string" ? picked : picked?.url;
          if (url) setForm(prev => ({ ...prev, image: url }));
          setMediaPicker(false);
        }}
        onClose={() => setMediaPicker(false)}
      />
    </>
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
    <RequirePermission permission="pages.edit">
    <Page>
      <PageHeader
        title="Gallery Items"
        actions={<button type="button" onClick={() => { setEditingItem(null); setFormOpen(true); }} className="wp-btn">Add Gallery Item</button>}
      />
      <div className="wp-notice wp-notice-info">
        <p><strong>Tip:</strong> Gallery items with a linked product will show a &quot;View Product&quot; button on the public gallery page. The link is stored by product ID, so it stays correct even if the product permalink changes.</p>
      </div>

      {/* Items Table */}
      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: 76 }}>Image</th>
              <th scope="col">Title</th>
              <th scope="col" className="wp-hide-sm">Linked Product</th>
              <th scope="col" className="wp-hide-sm" style={{ width: 70 }}>Order</th>
              <th scope="col" style={{ width: 80 }}>Visible</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="wp-muted">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="wp-muted">No gallery items yet. Click &quot;Add Gallery Item&quot; to get started.</td></tr>
            ) : (
              items.map(item => (
                <tr key={item._id}>
                  <td>
                    <div className="wp-thumb" style={{ width: 56, height: 56, opacity: item.enabled ? 1 : 0.5 }}>
                      {item.image ? <img src={item.image} alt={item.title} /> : null}
                    </div>
                  </td>
                  <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                    <button type="button" onClick={() => { setEditingItem(item); setFormOpen(true); }} className="wp-row-title" style={{ background: "none", border: 0, padding: 0, textAlign: "left" }}>{item.title}</button>
                    {!item.enabled && <span className="wp-strong"> — Hidden</span>}
                    {item.description && <p className="wp-muted line-clamp-1" style={{ margin: "2px 0 0" }}>{item.description}</p>}
                    <div className="wp-mobile-meta">
                      {item.linkedProduct?.name ? item.linkedProduct.name : "No linked product"} · Order {item.order}
                    </div>
                    <div className="wp-row-actions">
                      <span><button type="button" onClick={() => { setEditingItem(item); setFormOpen(true); }}>Edit</button></span>
                      <span><button type="button" onClick={() => handleDelete(item._id)} className="is-danger">Delete</button></span>
                    </div>
                  </td>
                  <td className="wp-hide-sm">
                    {item.linkedProduct?.name ? (
                      <span>{item.linkedProduct.name}</span>
                    ) : <span className="wp-muted">—</span>}
                  </td>
                  <td className="wp-hide-sm wp-num">{item.order}</td>
                  <td>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!item.enabled}
                      aria-label={`Visible: ${item.title}`}
                      onClick={() => handleToggleEnabled(item)}
                      className="inline-flex items-center"
                      style={{ background: "none", border: 0, padding: "8px 0", cursor: "pointer" }}
                    >
                      <span aria-hidden="true" style={{ position: "relative", width: 36, height: 20, borderRadius: 10, background: item.enabled ? "#2271b1" : "#c3c4c7", transition: "background .15s" }}>
                        <span style={{ position: "absolute", top: 2, left: item.enabled ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                      </span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
    </Page>
    </RequirePermission>
  );
}
