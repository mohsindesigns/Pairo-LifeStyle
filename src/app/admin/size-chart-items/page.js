"use client";

import React, { useEffect, useState, useCallback } from "react";
import MediaPickerModal from "@/components/admin/MediaPickerModal";
import { toast } from "react-hot-toast";
import { X, Loader2 } from "lucide-react";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import { Page, PageHeader, Notice, Skeleton } from "@/components/admin/ui";

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
      toast.success(isNew ? "Item added." : "Item updated.");
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
          <h2 id="size-chart-item-title" style={{ minWidth: 0, wordBreak: "break-word" }}>{isNew ? "Add size chart item" : "Edit size chart item"}</h2>
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
            {saving ? "Saving..." : (isNew ? "Add item" : "Update")}
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

const VIEWS = [
  { value: "all", label: "All" },
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "trash", label: "Trash" },
];

const errorOf = async (res) => (await res.json().catch(() => ({}))).error || `Request failed (${res.status})`;

export default function SizeChartItemsPage() {
  const { showConfirm } = usePopup();
  const [items, setItems] = useState([]);
  const [trashedItems, setTrashedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const [res, trashRes] = await Promise.all([
        fetch("/api/admin/size-chart-items"),
        fetch("/api/admin/size-chart-items?trash=true"),
      ]);
      const [data, trashData] = await Promise.all([res.json().catch(() => ({})), trashRes.json().catch(() => ({}))]);
      if (res.ok) setItems(Array.isArray(data) ? data : []);
      if (trashRes.ok) setTrashedItems(Array.isArray(trashData) ? trashData : []);
      if (!res.ok || !trashRes.ok) setLoadError((!res.ok ? data?.error : trashData?.error) || "Failed to load size chart items.");
      else setLoadError("");
    } catch {
      setLoadError("Could not reach the server to load size chart items.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchItems());
  }, [fetchItems]);

  // Typing filters live (debounced); Search / Enter applies immediately.
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleSaved = () => {
    setFormOpen(false);
    setEditingItem(null);
    fetchItems();
  };

  const trashItem = (id) => fetch(`/api/admin/size-chart-items/${id}`, { method: "DELETE" });
  const deletePermanently = (id) => fetch(`/api/admin/size-chart-items/${id}?mode=permanent`, { method: "DELETE" });
  const patchItem = (id, body) => fetch(`/api/admin/size-chart-items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const restoreItem = (id) => patchItem(id, { isDeleted: false });
  const duplicateItem = (id) => fetch(`/api/admin/size-chart-items/${id}/duplicate`, { method: "POST" });

  const runSingle = async (fn, okMsg, failMsg) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res.ok) toast.success(okMsg);
      else toast.error(`${failMsg}: ${await errorOf(res)}`);
    } catch {
      toast.error(failMsg);
    } finally {
      setBusy(false);
      fetchItems();
    }
  };

  const handleTrash = async (item) => {
    const ok = await showConfirm(
      `Move "${item.title}" to the trash? It disappears from the /size-chart page. You can restore it from the Trash view.`,
      "Move to Trash",
      { confirmText: "Move to Trash" }
    );
    if (!ok) return;
    runSingle(() => trashItem(item._id), `"${item.title}" moved to the trash`, "Could not move to trash");
  };

  const handleRestore = (item) => runSingle(() => restoreItem(item._id), `"${item.title}" restored`, "Could not restore");

  const handlePermanentDelete = async (item) => {
    const ok = await showConfirm(
      `Permanently delete "${item.title}"? This cannot be undone.`,
      "Delete permanently",
      { confirmText: "Delete permanently", danger: true }
    );
    if (!ok) return;
    runSingle(() => deletePermanently(item._id), `"${item.title}" deleted permanently`, "Could not delete");
  };

  const handleDuplicate = (item) =>
    runSingle(() => duplicateItem(item._id), `Duplicated as "${item.title} (Copy)" (hidden)`, "Could not duplicate");

  const handleToggle = async (item) => {
    setItems(prev => prev.map(i => i._id === item._id ? { ...i, enabled: !item.enabled } : i));
    try {
      const res = await patchItem(item._id, { enabled: !item.enabled });
      if (!res.ok) throw new Error(await errorOf(res));
      toast.success(`"${item.title}" is now ${item.enabled ? "hidden" : "visible"}`);
    } catch (err) {
      setItems(prev => prev.map(i => i._id === item._id ? { ...i, enabled: item.enabled } : i));
      toast.error(err.message || "Failed to update visibility");
    }
  };

  const allSource = view === "trash" ? trashedItems : items;

  const handleBulk = async () => {
    if (bulkAction === "Bulk actions") return toast.error("Choose a bulk action first");
    if (selectedIds.length === 0) return toast.error("Select at least one item");
    const count = selectedIds.length;
    const isPermanent = bulkAction === "Delete Permanently";
    const ok = await showConfirm(
      isPermanent ? `Permanently delete ${count} item${count === 1 ? "" : "s"}? This cannot be undone.` : `${bulkAction}: ${count} item${count === 1 ? "" : "s"}?`,
      isPermanent ? "Delete permanently" : bulkAction,
      isPermanent ? { confirmText: "Delete permanently", danger: true } : { confirmText: bulkAction }
    );
    if (!ok) return;
    setBusy(true);
    let done = 0;
    let failed = 0;
    for (const id of selectedIds) {
      try {
        let res;
        if (bulkAction === "Show") res = await patchItem(id, { enabled: true });
        else if (bulkAction === "Hide") res = await patchItem(id, { enabled: false });
        else if (bulkAction === "Duplicate") res = await duplicateItem(id);
        else if (bulkAction === "Move to Trash") res = await trashItem(id);
        else if (bulkAction === "Restore") res = await restoreItem(id);
        else if (bulkAction === "Delete Permanently") res = await deletePermanently(id);
        if (res?.ok) done += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
    setSelectedIds([]);
    setBulkAction("Bulk actions");
    setBusy(false);
    await fetchItems();
    if (failed === 0) toast.success(`${bulkAction}: ${done} done`);
    else toast.error(`${bulkAction}: ${done} done, ${failed} failed`);
  };

  const changeView = (next) => {
    setView(next);
    setSelectedIds([]);
    setBulkAction("Bulk actions");
  };

  const term = searchTerm.trim().toLowerCase();
  const filtered = allSource.filter(i => {
    if (view === "visible" && !i.enabled) return false;
    if (view === "hidden" && i.enabled) return false;
    if (!term) return true;
    return (i.title || "").toLowerCase().includes(term) || (i.description || "").toLowerCase().includes(term);
  });

  const counts = {
    all: items.length,
    visible: items.filter(i => i.enabled).length,
    hidden: items.filter(i => !i.enabled).length,
    trash: trashedItems.length,
  };

  const allSelected = filtered.length > 0 && filtered.every(i => selectedIds.includes(i._id));
  const someSelected = filtered.some(i => selectedIds.includes(i._id));
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : filtered.map(i => i._id));
  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const openEditor = (item) => { setEditingItem(item); setFormOpen(true); };

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input
          type="checkbox"
          aria-label="Select all items"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={toggleSelectAll}
        />
      </th>
      <th scope="col" style={{ width: 96 }}>Preview</th>
      <th scope="col">Title</th>
      <th scope="col" className="wp-hide-sm wp-num" style={{ width: 80 }}>Order</th>
      <th scope="col" style={{ width: 110 }}>{view === "trash" ? "Status" : "Visible"}</th>
    </tr>
  );

  const emptyText = term
    ? "No items match your search."
    : view === "trash" ? "The trash is empty."
    : view === "visible" ? "No visible items."
    : view === "hidden" ? "No hidden items."
    : "No size chart items yet.";

  return (
    <RequirePermission permission="products.edit">
    <Page>
      <PageHeader
        title="Size Chart Items"
        actions={<button type="button" className="wp-btn" onClick={() => openEditor(null)}>Add new item</button>}
      />
      <p className="wp-desc" style={{ marginTop: 0 }}>
        Size chart images shown on your <strong>/size-chart</strong> page, in display order. Hidden and trashed items are not shown.
      </p>

      {loadError && <Notice type="error" onDismiss={() => setLoadError("")}>{loadError}</Notice>}

      <div className="wp-subsub" role="tablist" aria-label="Filter size chart items">
        {VIEWS.map((v, i) => (
          <React.Fragment key={v.value}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={view === v.value}
              className={view === v.value ? "is-current" : undefined}
              onClick={() => changeView(v.value)}
            >
              {v.label} <span className="wp-count">({counts[v.value]})</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="wp-toolbar">
        <label htmlFor="sci-bulk-action" className="sr-only">Select bulk action</label>
        <select id="sci-bulk-action" className="wp-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
          <option>Bulk actions</option>
          {view === "trash" ? (
            <>
              <option>Restore</option>
              <option>Delete Permanently</option>
            </>
          ) : (
            <>
              <option>Show</option>
              <option>Hide</option>
              <option>Duplicate</option>
              <option>Move to Trash</option>
            </>
          )}
        </select>
        <button type="button" className="wp-btn" onClick={handleBulk} disabled={busy}>Apply</button>
        <span className="wp-spacer" />
        <form className="wp-search" role="search" onSubmit={(e) => { e.preventDefault(); setSearchTerm(searchInput); }}>
          <label htmlFor="sci-search" className="sr-only">Search size chart items</label>
          <input
            id="sci-search"
            type="search"
            className="wp-input"
            placeholder="Search items..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="wp-btn">Search items</button>
        </form>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <span className="wp-pages">{filtered.length} item{filtered.length === 1 ? "" : "s"}</span>
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading && allSource.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td className="wp-check-col"><Skeleton height={16} width={16} /></td>
                  <td><Skeleton height={56} width={80} /></td>
                  <td><Skeleton width="60%" /><Skeleton width="40%" height={12} style={{ marginTop: 6 }} /></td>
                  <td className="wp-hide-sm wp-num"><Skeleton width={24} style={{ marginLeft: "auto" }} /></td>
                  <td><Skeleton width={70} height={28} /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="wp-muted" style={{ padding: 20, textAlign: "center" }}>
                  {emptyText}
                  {view === "all" && !term && (
                    <> <button type="button" className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => openEditor(null)}>Add the first one</button>.</>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map(item => {
                const checked = selectedIds.includes(item._id);
                return (
                  <tr key={item._id} className={checked ? "is-selected" : undefined}>
                    <td className="wp-check-col">
                      <input type="checkbox" aria-label={`Select ${item.title}`} checked={checked} onChange={() => toggleSelect(item._id)} />
                    </td>
                    <td>
                      {item.image ? (
                        <img src={item.image} alt="" style={{ height: 56, width: 80, objectFit: "contain", border: "1px solid #dcdcde", background: "#f6f7f7", opacity: item.enabled ? 1 : 0.5, display: "block" }} />
                      ) : (
                        <div style={{ height: 56, width: 80, border: "1px solid #dcdcde", background: "#f0f0f1" }} />
                      )}
                    </td>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      {view === "trash" ? (
                        <span className="wp-row-title">{item.title}</span>
                      ) : (
                        <button type="button" className="wp-row-title" style={{ background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer" }} onClick={() => openEditor(item)}>
                          {item.title}
                        </button>
                      )}
                      {view !== "trash" && !item.enabled && <span className="wp-muted"> — Hidden</span>}
                      {item.description && <div className="wp-muted wp-small line-clamp-1">{item.description}</div>}
                      <div className="wp-mobile-meta">Order: {item.order}</div>
                      {view === "trash" ? (
                        <div className="wp-row-actions">
                          <span><button type="button" disabled={busy} onClick={() => handleRestore(item)}>Restore</button></span>
                          <span><button type="button" disabled={busy} className="is-danger" style={{ whiteSpace: "nowrap" }} onClick={() => handlePermanentDelete(item)}>Delete permanently</button></span>
                        </div>
                      ) : (
                        <div className="wp-row-actions">
                          <span><button type="button" onClick={() => openEditor(item)}>Edit</button></span>
                          <span><button type="button" disabled={busy} onClick={() => handleDuplicate(item)}>Duplicate</button></span>
                          <span><button type="button" disabled={busy} className="is-danger" onClick={() => handleTrash(item)}>Trash</button></span>
                          {item.enabled && <span><a href="/size-chart" target="_blank" rel="noopener noreferrer">View</a></span>}
                        </div>
                      )}
                    </td>
                    <td className="wp-hide-sm wp-num">{item.order}</td>
                    <td>
                      {view === "trash" ? (
                        <span className="wp-pill wp-pill-sm wp-st-draft">Trashed</span>
                      ) : (
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
