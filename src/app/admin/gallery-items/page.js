"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Page, PageHeader, Notice, Skeleton } from "@/components/admin/ui";
import MediaPickerModal from "@/components/admin/MediaPickerModal";
import { toast } from "react-hot-toast";
import { X, Loader2, ArrowUp, ArrowDown, Image as ImageIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import { paginate } from "@/lib/admin-products-utils";
import { moveItem } from "@/app/api/admin/gallery-items/helpers";
import ThemedSelect from "@/components/ui/ThemedSelect";

const inputClass = "wp-input wp-full";

function GalleryItemForm({ item, products, onSave, onClose, isNew }) {
  const [form, setForm] = useState({
    image: item?.image || "",
    title: item?.title || "",
    description: item?.description || "",
    linkedProduct: item?.linkedProduct?._id || item?.linkedProduct || "",
    enabled: item?.enabled !== undefined ? item.enabled : true,
    // New items: blank order = placed at the end of the gallery
    order: item?.order !== undefined ? item.order : ""
  });
  const [saving, setSaving] = useState(false);
  const [mediaPicker, setMediaPicker] = useState(false);
  const [productSearch, setProductSearch] = useState(
    item?.linkedProduct?.name || ""
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const productTerm = productSearch.trim().toLowerCase();
  const filteredProducts = productTerm
    ? products.filter(p =>
        (p.name || "").toLowerCase().includes(productTerm) ||
        (p.slug || "").toLowerCase().includes(productTerm)
      ).slice(0, 8)
    : [];

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
        body: JSON.stringify({
          ...form,
          linkedProduct: form.linkedProduct || null,
          order: form.order === "" ? undefined : Number(form.order)
        })
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
    <div className="wp-modal-backdrop" onClick={() => !saving && onClose()}>
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
                  setShowDropdown(!!e.target.value.trim());
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            <div className="wp-field">
              <label htmlFor="gi-order" className="wp-label">Display Order</label>
              <input id="gi-order" type="number" name="order" value={form.order} onChange={handleChange} min={0} placeholder={isNew ? "Last" : undefined} inputMode="numeric" className={inputClass} />
            </div>
            <div className="wp-field">
              <label htmlFor="gi-enabled" className="wp-label">Visible</label>
              <ThemedSelect id="gi-enabled" name="enabled" value={form.enabled ? "true" : "false"} onChange={e => setForm(prev => ({ ...prev, enabled: e.target.value === "true" }))} className="wp-select wp-full">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </ThemedSelect>
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

const VIEWS = [
  { key: "all", label: "All" },
  { key: "visible", label: "Visible" },
  { key: "hidden", label: "Hidden" },
  { key: "trash", label: "Trash" },
];

const errorFrom = async (res, fallback) => {
  const data = await res.json().catch(() => ({}));
  return data?.error || fallback;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const linkBtn = { background: "none", border: 0, padding: 0, color: "#2271b1", textDecoration: "underline", cursor: "pointer" };

export default function GalleryItemsPage() {
  const { showConfirm } = usePopup();
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [view, setView] = useState("all");
  const [counts, setCounts] = useState({ all: 0, visible: 0, hidden: 0, trash: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/gallery-items?counts=true");
      if (res.ok) {
        const d = await res.json();
        setCounts({ all: d.all || 0, visible: d.visible || 0, hidden: d.hidden || 0, trash: d.trash || 0 });
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/admin/gallery-items?view=${view}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      } else {
        setItems([]);
        setLoadError(await errorFrom(res, "Failed to load gallery items."));
      }
    } catch {
      setItems([]);
      setLoadError("Failed to load gallery items. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
    fetchCounts();
  }, [view, fetchCounts]);

  // Products are only needed for the "Linked Product" picker in the form
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/products")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (!cancelled) setProducts(Array.isArray(d) ? d : (d?.products || [])); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    Promise.resolve().then(fetchItems);
  }, [fetchItems]);

  const openEdit = (item) => { setEditingItem(item); setFormOpen(true); };

  const handleSaved = () => {
    setFormOpen(false);
    setEditingItem(null);
    fetchItems();
  };

  // ---- Requests ----
  const trashRequest = (id) => fetch(`/api/admin/gallery-items/${id}`, { method: "DELETE" });
  const permanentRequest = (id) => fetch(`/api/admin/gallery-items/${id}?permanent=true`, { method: "DELETE" });
  const duplicateRequest = (id) => fetch(`/api/admin/gallery-items/${id}/duplicate`, { method: "POST" });
  const patchRequest = (id, body) =>
    fetch(`/api/admin/gallery-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const restoreRequest = (id) => patchRequest(id, { restore: true });

  const runSingle = async (request, success, failure, after) => {
    setBusy(true);
    try {
      const res = await request();
      if (res.ok) {
        toast.success(success);
        if (after) await after(res);
        else fetchItems();
      } else {
        toast.error(await errorFrom(res, failure));
      }
    } catch {
      toast.error(failure);
    } finally {
      setBusy(false);
    }
  };

  const handleTrash = async (item) => {
    if (!(await showConfirm(`Move "${item.title}" to the Trash? It is hidden from the gallery right away and can be restored.`, "Move to Trash", { confirmText: "Move to Trash" }))) return;
    runSingle(() => trashRequest(item._id), "Gallery item moved to the Trash.", "Failed to move the item to the Trash.");
  };

  const handleRestore = (item) =>
    runSingle(() => restoreRequest(item._id), "Gallery item restored.", "Failed to restore the item.");

  const handlePermanentDelete = async (item) => {
    if (!(await showConfirm(`Permanently delete "${item.title}"? This cannot be undone. The image file stays in the Media Library.`, "Delete Permanently", { confirmText: "Delete Permanently", danger: true }))) return;
    runSingle(() => permanentRequest(item._id), "Gallery item permanently deleted.", "Failed to delete the item.");
  };

  // Duplicate opens the hidden copy in the editor so it can be adjusted and made visible
  const handleDuplicate = (item) =>
    runSingle(() => duplicateRequest(item._id), "Duplicated as a hidden copy.", "Failed to duplicate the item.", async (res) => {
      const copy = await res.json().catch(() => null);
      await fetchItems();
      if (copy?._id) openEdit({ ...copy, linkedProduct: item.linkedProduct || null });
    });

  const handleToggleEnabled = async (item) => {
    const next = !item.enabled;
    setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, enabled: next } : i)));
    try {
      const res = await patchRequest(item._id, { enabled: next });
      if (res.ok) {
        fetchCounts();
        if (view === "visible" || view === "hidden") fetchItems();
        return;
      }
      toast.error(await errorFrom(res, "Failed to change visibility."));
    } catch {
      toast.error("Failed to change visibility.");
    }
    setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, enabled: item.enabled } : i)));
  };

  // ---- Reorder (All view, no search): move one step and save the whole order ----
  const term = searchTerm.trim().toLowerCase();
  const canReorder = view === "all" && !term;

  const handleMove = async (index, delta) => {
    const previous = items;
    const next = moveItem(items, index, index + delta);
    if (next === items || next[index] === items[index]) return;
    setItems(next.map((i, idx) => ({ ...i, order: idx })));
    try {
      const res = await fetch("/api/admin/gallery-items/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((i) => i._id) }),
      });
      if (res.ok) return;
      toast.error(await errorFrom(res, "Failed to save the new order."));
    } catch {
      toast.error("Failed to save the new order.");
    }
    setItems(previous);
  };

  // ---- Bulk ----
  const bulkOptions = view === "trash" ? ["Restore", "Delete Permanently"] : ["Show", "Hide", "Duplicate", "Move to Trash"];

  const handleBulkAction = async () => {
    if (!bulkOptions.includes(bulkAction)) { toast.error("Choose a bulk action first."); return; }
    if (selectedIds.length === 0) { toast.error("Select at least one item."); return; }
    const n = selectedIds.length;
    const isPermanent = bulkAction === "Delete Permanently";
    const ok = isPermanent
      ? await showConfirm(`Permanently delete ${plural(n, "item")}? This cannot be undone.`, "Delete Permanently", { confirmText: "Delete Permanently", danger: true })
      : await showConfirm(`Apply "${bulkAction}" to ${plural(n, "item")}?`, "Bulk action", { confirmText: bulkAction });
    if (!ok) return;

    const request = {
      Show: (id) => patchRequest(id, { enabled: true }),
      Hide: (id) => patchRequest(id, { enabled: false }),
      Duplicate: duplicateRequest,
      "Move to Trash": trashRequest,
      Restore: restoreRequest,
      "Delete Permanently": permanentRequest,
    }[bulkAction];

    setBusy(true);
    const ids = [...selectedIds];
    const results = [];
    for (const id of ids) {
      try { results.push((await request(id)).ok); } catch { results.push(false); }
    }
    setBusy(false);
    const succeeded = results.filter(Boolean).length;
    const failed = results.length - succeeded;
    setSelectedIds(ids.filter((_, i) => !results[i]));
    fetchItems();
    if (failed === 0) toast.success(`${bulkAction}: ${plural(succeeded, "item")} done.`);
    else toast.error(`${bulkAction}: ${succeeded} done, ${failed} failed.`);
  };

  // ---- Filtering / paging / selection ----
  const filtered = items.filter((i) =>
    !term
    || (i.title || "").toLowerCase().includes(term)
    || (i.description || "").toLowerCase().includes(term)
    || (i.linkedProduct?.name || "").toLowerCase().includes(term)
  );
  const { items: pageItems, page: currentPage, totalPages } = paginate(filtered, page);
  const pageOffset = (currentPage - 1) * 20;
  const visibleIds = pageItems.map((i) => i._id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someSelected = visibleIds.some((id) => selectedIds.includes(id));
  const toggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    else setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
  };
  const resetPaging = () => { setPage(1); setSelectedIds([]); };
  const changeView = (v) => { setView(v); setBulkAction("Bulk actions"); resetPaging(); };
  const goToPage = (p) => { setPage(Math.min(Math.max(1, p), totalPages)); setSelectedIds([]); };

  const pagination = (
    <div className="wp-pages">
      <span>{plural(filtered.length, "item")}</span>
      <button type="button" className="wp-pager" aria-label="First page" disabled={currentPage <= 1} onClick={() => goToPage(1)}><ChevronsLeft className="w-4 h-4" aria-hidden="true" /></button>
      <button type="button" className="wp-pager" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}><ChevronLeft className="w-4 h-4" aria-hidden="true" /></button>
      <span>{currentPage} of {totalPages}</span>
      <button type="button" className="wp-pager" aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}><ChevronRight className="w-4 h-4" aria-hidden="true" /></button>
      <button type="button" className="wp-pager" aria-label="Last page" disabled={currentPage >= totalPages} onClick={() => goToPage(totalPages)}><ChevronsRight className="w-4 h-4" aria-hidden="true" /></button>
    </div>
  );

  const arrowBtn = { width: 32, height: 32, minHeight: 32, padding: 0, justifyContent: "center" };

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input
          type="checkbox"
          aria-label="Select all items on this page"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={toggleSelectAll}
        />
      </th>
      <th scope="col" style={{ width: 68 }}>
        <ImageIcon className="w-4 h-4" aria-hidden="true" style={{ color: "#8c8f94" }} />
        <span className="sr-only">Image</span>
      </th>
      <th scope="col">Title</th>
      <th scope="col" className="wp-hide-sm">Linked Product</th>
      <th scope="col" className="wp-hide-sm wp-num" style={{ width: 120 }}>Order</th>
      <th scope="col" style={{ width: 76 }}>Visible</th>
    </tr>
  );

  return (
    <RequirePermission permission="pages.edit">
    <Page>
      <PageHeader
        title="Gallery Items"
        actions={<button type="button" onClick={() => openEdit(null)} className="wp-btn">Add Gallery Item</button>}
      />
      <div className="wp-notice wp-notice-info">
        <p><strong>Tip:</strong> Gallery items with a linked product show a &quot;View Product&quot; button on the public gallery page. Use the arrows in the All view to change the display order.</p>
      </div>

      <div className="wp-subsub" role="tablist" aria-label="Filter gallery items">
        {VIEWS.map((v, i) => (
          <React.Fragment key={v.key}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button type="button" role="tab" aria-selected={view === v.key} className={view === v.key ? "is-current" : undefined} onClick={() => changeView(v.key)}>
              {v.label} <span className="wp-count">({counts[v.key] || 0})</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="wp-toolbar">
        <label htmlFor="gallery-bulk-action" className="sr-only">Select bulk action</label>
        <ThemedSelect id="gallery-bulk-action" className="wp-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
          <option>Bulk actions</option>
          {bulkOptions.map((o) => <option key={o}>{o}</option>)}
        </ThemedSelect>
        <button type="button" className="wp-btn" onClick={handleBulkAction} disabled={busy}>Apply</button>

        <span className="wp-spacer" />

        <form className="wp-search" role="search" onSubmit={(e) => { e.preventDefault(); resetPaging(); }}>
          <label htmlFor="gallery-search" className="sr-only">Search gallery items</label>
          <input
            id="gallery-search"
            type="search"
            placeholder="Search gallery items..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); resetPaging(); }}
            className="wp-input"
          />
          <button type="submit" className="wp-btn">Search items</button>
        </form>
      </div>

      {loadError && (
        <Notice type="error">
          {loadError}{" "}
          <button type="button" onClick={fetchItems} style={linkBtn}>Try again</button>
        </Notice>
      )}

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pagination}
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <tr key={i}><td colSpan={6}><Skeleton height={18} width={i === 1 ? "60%" : "80%"} /></td></tr>
              ))
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="wp-muted">
                  {term ? "No gallery items match your search."
                    : view === "trash" ? "No gallery items in the Trash."
                    : view === "all" ? <>No gallery items yet. <button type="button" onClick={() => openEdit(null)} style={linkBtn}>Add the first one</button>.</>
                    : `No ${view} gallery items.`}
                </td>
              </tr>
            ) : (
              pageItems.map((item, i) => {
                const index = pageOffset + i;
                const isTrash = view === "trash";
                return (
                  <tr key={item._id} className={selectedIds.includes(item._id) ? "is-selected" : undefined}>
                    <td className="wp-check-col">
                      <input type="checkbox" aria-label={`Select ${item.title}`} checked={selectedIds.includes(item._id)} onChange={() => toggleSelect(item._id)} />
                    </td>
                    <td>
                      <div className="wp-thumb" style={{ opacity: item.enabled && !isTrash ? 1 : 0.5 }}>
                        {item.image ? <img src={item.image} alt="" /> : <ImageIcon className="w-5 h-5" aria-hidden="true" style={{ color: "#a7aaad" }} />}
                      </div>
                    </td>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      {isTrash ? (
                        <span className="wp-row-title" style={{ color: "#1d2327" }}>{item.title}</span>
                      ) : (
                        <button type="button" onClick={() => openEdit(item)} className="wp-row-title" style={{ background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer" }}>{item.title}</button>
                      )}
                      {!isTrash && !item.enabled && <span className="wp-strong"> — Hidden</span>}
                      {item.description && <p className="wp-muted line-clamp-1" style={{ margin: "2px 0 0" }}>{item.description}</p>}
                      <div className="wp-mobile-meta">
                        {item.linkedProduct?.name ? item.linkedProduct.name : "No linked product"} · Order {item.order}
                        {canReorder && (
                          <span style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            <button type="button" className="wp-btn" style={{ ...arrowBtn, width: 40, height: 40, minHeight: 40 }} aria-label={`Move ${item.title} up`} disabled={index === 0} onClick={() => handleMove(index, -1)}>
                              <ArrowUp className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button type="button" className="wp-btn" style={{ ...arrowBtn, width: 40, height: 40, minHeight: 40 }} aria-label={`Move ${item.title} down`} disabled={index === filtered.length - 1} onClick={() => handleMove(index, 1)}>
                              <ArrowDown className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </span>
                        )}
                      </div>
                      <div className="wp-row-actions">
                        {isTrash ? (
                          <>
                            <span><button type="button" disabled={busy} onClick={() => handleRestore(item)}>Restore</button></span>
                            <span><button type="button" disabled={busy} onClick={() => handlePermanentDelete(item)} className="is-danger">Delete Permanently</button></span>
                          </>
                        ) : (
                          <>
                            <span><button type="button" onClick={() => openEdit(item)}>Edit</button></span>
                            <span><button type="button" disabled={busy} onClick={() => handleDuplicate(item)}>Duplicate</button></span>
                            <span><button type="button" disabled={busy} onClick={() => handleTrash(item)} className="is-danger">Trash</button></span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>
                      {item.linkedProduct?.name ? <span>{item.linkedProduct.name}</span> : <span className="wp-muted">—</span>}
                    </td>
                    <td className="wp-hide-sm wp-num">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {canReorder && (
                          <>
                            <button type="button" className="wp-btn" style={arrowBtn} aria-label={`Move ${item.title} up`} title="Move up" disabled={index === 0} onClick={() => handleMove(index, -1)}>
                              <ArrowUp className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button type="button" className="wp-btn" style={arrowBtn} aria-label={`Move ${item.title} down`} title="Move down" disabled={index === filtered.length - 1} onClick={() => handleMove(index, 1)}>
                              <ArrowDown className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </>
                        )}
                        <span style={{ minWidth: 20, textAlign: "right" }}>{item.order}</span>
                      </span>
                    </td>
                    <td>
                      {isTrash ? (
                        <span className="wp-muted">—</span>
                      ) : (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!!item.enabled}
                          aria-label={`Visible: ${item.title}`}
                          onClick={() => handleToggleEnabled(item)}
                          className="inline-flex items-center"
                          style={{ background: "none", border: 0, padding: "10px 0", cursor: "pointer" }}
                        >
                          <span aria-hidden="true" style={{ position: "relative", width: 36, height: 20, borderRadius: 10, background: item.enabled ? "#2271b1" : "#c3c4c7", transition: "background .15s" }}>
                            <span style={{ position: "absolute", top: 2, left: item.enabled ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                          </span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pagination}
      </div>

      {formOpen && (
        <GalleryItemForm
          key={editingItem?._id || "new"}
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
