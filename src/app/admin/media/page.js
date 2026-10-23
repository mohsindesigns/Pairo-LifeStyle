"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search, LayoutGrid, List, Upload, Trash2, RotateCcw,
  X, Check, Loader2, Image as ImageIcon, AlertTriangle, ChevronLeft, ChevronRight
} from "lucide-react";
import { Page, PageHeader } from "@/components/admin/ui";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

export default function AdminMedia() {
  const { showConfirm, showAlert } = usePopup();
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState("grid");          // grid | list
  const [tab, setTab]               = useState("library");       // library | trash
  const [search, setSearch]         = useState("");               // search box text (debounced into query)
  // One source of truth for what the library shows: type filter, sort, search and page
  const [query, setQuery]           = useState({ type: "all", sort: "newest", search: "", page: 1 });
  const page = query.page;
  const [pagination, setPagination] = useState({});
  const [selected, setSelected]     = useState(new Set());
  const [bulkMode, setBulkMode]     = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [editItem, setEditItem]     = useState(null);
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [copied, setCopied]         = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const fileInputRef = useRef(null);
  const searchTimeout = useRef(null);

  const fetchMedia = useCallback(async (q, t = "library") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: q.search || "", page: String(q.page || 1), limit: "30", trash: (t === "trash").toString(),
        type: q.type || "all", sort: q.sort || "newest", _t: Date.now().toString()
      });
      const res = await fetch(`/api/admin/media?${params}`);
      const data = await res.json();
      if (data.success) { setItems(data.items); setPagination(data.pagination); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchMedia(query, tab);
  }, [tab, query, fetchMedia]);

  // Re-fetch the current view (same type, sort, search and page)
  const reload = () => fetchMedia(query, tab);

  const changeTab = (t) => {
    if (t === tab) return;
    clearTimeout(searchTimeout.current);
    setSearch("");
    setQuery(q => ({ ...q, search: "", page: 1 }));
    setSelected(new Set());
    setDetailItem(null);
    setTab(t);
  };

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setQuery(q => ({ ...q, search: val, page: 1 })); }, 400);
  };

  const goToPage = (p) => setQuery(q => ({ ...q, page: p }));

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleItemClick = (item) => {
    if (bulkMode) { toggleSelect(item._id); return; }
    setDetailItem(item);
    setEditItem({ ...item });
  };

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append("file", f));
    try {
      const res = await fetch("/api/admin/media/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        clearTimeout(searchTimeout.current);
        setSearch("");
        setSelected(new Set());
        setDetailItem(null);
        // New query object always triggers a fresh fetch of page 1 (keeps type & sort)
        setQuery(q => ({ ...q, search: "", page: 1 }));
        setTab("library");
      }
      if (data.errors?.length) toast.error(data.errors.map(e => `${e.file}: ${e.error}`).join('\n'));
    } finally { setUploading(false); }
  };

  const saveMetadata = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/media/${editItem._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editItem.title, altText: editItem.altText, caption: editItem.caption, tags: editItem.tags }),
      });
      const data = await res.json();
      if (data.success) {
        setItems(prev => prev.map(i => i._id === editItem._id ? data.media : i));
        setDetailItem(data.media);
        setEditItem({ ...data.media });
      }
    } finally { setSaving(false); }
  };

  const softDelete = async (id) => {
    const ok = await showConfirm("Are you sure you want to move this file to trash?");
    if (!ok) return;
    const previousItems = items;
    setItems(prev => prev.filter(item => item._id !== id));
    setDetailItem(null);
    
    const promise = fetch(`/api/admin/media/${id}`, { method: "DELETE" })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to move file to trash.");
        }
        reload();
      });

    toast.promise(promise, {
      loading: 'Moving file to trash...',
      success: 'File moved to trash.',
      error: (err) => {
        setItems(previousItems);
        return err.message || 'Failed to move file to trash.';
      }
    });
  };

  // Confirmation is the in-page "Permanently Delete?" dialog (deleteConfirm) — no second prompt here.
  const permanentDelete = async (id) => {
    const previousItems = items;
    setItems(prev => prev.filter(item => item._id !== id));
    setDetailItem(null);
    setDeleteConfirm(null);

    const promise = fetch(`/api/admin/media/${id}?permanent=true`, { method: "DELETE" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to delete file permanently.");
        }
        if (data.error === "Image is still in use") {
          throw new Error(`Cannot delete — image is used in ${data.usageCount} place(s).`);
        }
        reload();
      });

    toast.promise(promise, {
      loading: 'Deleting file permanently...',
      success: 'File deleted permanently.',
      error: (err) => {
        setItems(previousItems);
        return err.message || 'Failed to delete file.';
      }
    });
  };

  const restore = async (id) => {
    const previousItems = items;
    setItems(prev => prev.filter(item => item._id !== id));
    setDetailItem(null);
    
    const promise = fetch(`/api/admin/media/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to restore file.");
      }
      reload();
    });

    toast.promise(promise, {
      loading: 'Restoring file...',
      success: 'File restored successfully.',
      error: (err) => {
        setItems(previousItems);
        return err.message || 'Failed to restore file.';
      }
    });
  };

  const bulkSoftDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await showConfirm(
      `Move ${ids.length} file${ids.length === 1 ? "" : "s"} to trash?`,
      "Move to Trash",
      { confirmText: "Move to Trash", danger: true }
    );
    if (!ok) return;
    const results = await Promise.all(ids.map(async (id) => {
      try {
        const res = await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
        return res.ok;
      } catch { return false; }
    }));
    const succeeded = results.filter(Boolean).length;
    const failed = results.length - succeeded;
    // Keep failed items selected so they can be retried
    setSelected(new Set(ids.filter((_, i) => !results[i])));
    if (failed === 0) setBulkMode(false);
    reload();
    if (succeeded) toast.success(`${succeeded} file${succeeded === 1 ? "" : "s"} moved to trash.`);
    if (failed) toast.error(`${failed} file${failed === 1 ? "" : "s"} could not be moved to trash.`);
  };

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showAlert("Could not copy the URL. Select the File URL field and copy it manually.", "Copy failed");
    }
  };

  const thumbUrl = (item) => item.url.includes('cloudinary.com') ? item.url.replace('/upload/', '/upload/w_400,h_400,c_fill,f_auto,q_auto/') : item.url;
  const iconBtn = (active) => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32,
    border: "1px solid", borderColor: active ? "#2271b1" : "transparent", background: active ? "#fff" : "transparent",
    color: active ? "#1d2327" : "#787c82", borderRadius: 3, cursor: "pointer",
  });

  return (
    <RequirePermission permission="media.manage">
    <Page>
      <PageHeader
        title="Media Library"
        actions={
          <label className="wp-btn" style={{ cursor: uploading ? "default" : "pointer" }}>
            <Upload className="w-4 h-4" aria-hidden="true" />
            {uploading ? "Uploading..." : "Add New Media File"}
            <input type="file" multiple accept="image/*" className="hidden" onChange={e => handleFiles(e.target.files)} disabled={uploading} />
          </label>
        }
      />

      {/* ── Library / Trash ── */}
      <div className="wp-subsub" role="tablist" aria-label="Media views">
        <button type="button" role="tab" aria-selected={tab === "library"} className={tab === "library" ? "is-current" : undefined} onClick={() => changeTab("library")}>
          All media <span className="wp-count">({tab === "library" ? (pagination.total || 0) : "-"})</span>
        </button>
        <span className="wp-sep" aria-hidden="true">|</span>
        <button type="button" role="tab" aria-selected={tab === "trash"} className={tab === "trash" ? "is-current" : undefined} onClick={() => changeTab("trash")}>
          Trash {tab === "trash" && <span className="wp-count">({pagination.total || 0})</span>}
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="wp-toolbar" style={{ background: "#fff", border: "1px solid #c3c4c7", padding: "8px 10px", marginBottom: 0, borderBottom: 0 }}>
        <div className="flex items-center gap-0.5" role="group" aria-label="View mode">
          <button type="button" onClick={() => setView("grid")} aria-pressed={view === "grid"} aria-label="Grid view" title="Grid view" style={iconBtn(view === "grid")}><LayoutGrid className="w-4 h-4" aria-hidden="true" /></button>
          <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} aria-label="List view" title="List view" style={iconBtn(view === "list")}><List className="w-4 h-4" aria-hidden="true" /></button>
        </div>

        <label htmlFor="media-filter-type" className="sr-only">Filter by type</label>
        <select
          id="media-filter-type"
          value={query.type}
          onChange={(e) => { const type = e.target.value; setQuery(q => ({ ...q, type, page: 1 })); }}
          className="wp-select"
        >
          <option value="all">All media items</option>
          <option value="image">Images</option>
        </select>

        <label htmlFor="media-sort" className="sr-only">Sort media</label>
        <select
          id="media-sort"
          value={query.sort}
          onChange={(e) => { const sort = e.target.value; setQuery(q => ({ ...q, sort, page: 1 })); }}
          className="wp-select"
        >
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
          <option value="name">Sort: Name A-Z</option>
        </select>

        <button type="button" onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); }}
          aria-pressed={bulkMode}
          className={`wp-btn${bulkMode ? " wp-btn-primary" : ""}`}>
          {bulkMode ? `Cancel bulk select (${selected.size})` : "Bulk select"}
        </button>

        {bulkMode && selected.size > 0 && (
          <button type="button" onClick={bulkSoftDelete} className="wp-btn" style={{ color: "#b32d2e", borderColor: "#b32d2e" }}>
            <Trash2 className="w-4 h-4" aria-hidden="true" /> Move to Trash
          </button>
        )}

        <span className="wp-spacer" />

        <div className="wp-search" role="search">
          <label htmlFor="media-search" className="sr-only">Search media</label>
          <Search className="w-4 h-4 wp-hide-sm" aria-hidden="true" style={{ color: "#8c8f94" }} />
          <input id="media-search" type="search" value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search media items..." className="wp-input" />
        </div>
      </div>

      {/* ── Library Content ── */}
      <div
        className="relative"
        style={{ background: "#fff", border: "1px solid #c3c4c7", minHeight: 320, boxShadow: dragOver ? "inset 0 0 0 2px #2271b1" : undefined }}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none" style={{ background: "rgba(34,113,177,0.06)", border: "2px dashed #2271b1" }}>
            <p style={{ background: "#fff", border: "1px solid #2271b1", padding: "10px 20px", color: "#2271b1", fontSize: 16 }}>Drop files to upload</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 wp-muted" style={{ height: 260 }}>
            <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" style={{ color: "#2271b1" }} />
            <p>Loading media…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="wp-empty flex flex-col items-center justify-center gap-2" style={{ height: 260 }}>
            <ImageIcon className="w-10 h-10" aria-hidden="true" style={{ color: "#c3c4c7" }} />
            <p className="wp-muted">{tab === "trash" ? "Trash is empty." : "No media found. Drop files here to upload."}</p>
          </div>
        ) : view === "grid" ? (
          <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 sm:gap-3" style={{ padding: 12, margin: 0, listStyle: "none" }}>
            {items.map(item => {
              const isSel = selected.has(item._id) || detailItem?._id === item._id;
              return (
                <li key={item._id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(item)}
                    aria-pressed={bulkMode ? selected.has(item._id) : undefined}
                    aria-label={item.title || item.filename || "Media item"}
                    className="relative block w-full aspect-square overflow-hidden cursor-pointer"
                    style={{
                      background: "#f0f0f1",
                      border: 0,
                      padding: 0,
                      boxShadow: isSel
                        ? "inset 0 0 0 3px #fff, inset 0 0 0 7px #2271b1"
                        : "inset 0 0 15px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(0,0,0,0.05)",
                    }}
                  >
                    <img
                      src={thumbUrl(item)}
                      alt={item.altText || ''}
                      className="w-full h-full object-cover"
                      style={{ position: "relative", zIndex: 0, opacity: tab === "trash" ? 0.55 : 1, ...(isSel ? { padding: 7 } : null) }}
                    />
                    {tab === "trash" && <span className="absolute wp-pill wp-st-cancelled" style={{ left: 8, bottom: 8, zIndex: 1 }}>Trash</span>}
                    {(selected.has(item._id)) && (
                      <span aria-hidden="true" className="absolute flex items-center justify-center" style={{ top: 0, right: 0, width: 24, height: 24, background: "#2271b1", boxShadow: "0 0 0 1px #fff, 0 0 0 2px #2271b1", zIndex: 1 }}>
                        <Check className="w-4 h-4" style={{ color: "#fff" }} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="wp-table-box" style={{ border: 0, boxShadow: "none" }}>
            <table className="wp-list-table">
              <thead>
                <tr>
                  {bulkMode && <th scope="col" className="wp-check-col"><span className="sr-only">Select</span></th>}
                  <th scope="col">File</th>
                  <th scope="col" className="wp-hide-sm">Title</th>
                  <th scope="col" className="wp-hide-sm">Type</th>
                  <th scope="col" className="wp-hide-sm">Size</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item._id} onClick={() => handleItemClick(item)} className={detailItem?._id === item._id || selected.has(item._id) ? "is-selected" : undefined} style={{ cursor: "pointer" }}>
                    {bulkMode && (
                      <td className="wp-check-col">
                        <input type="checkbox" aria-label={`Select ${item.filename}`} checked={selected.has(item._id)} onChange={() => toggleSelect(item._id)} onClick={e => e.stopPropagation()} />
                      </td>
                    )}
                    <td>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="wp-thumb" style={{ width: 60, height: 60, flexShrink: 0 }}>
                          <img src={item.url} alt="" />
                        </div>
                        <div className="min-w-0">
                          <button type="button" className="wp-row-title" style={{ background: "none", border: 0, padding: 0, textAlign: "left", wordBreak: "break-all" }} onClick={e => { e.stopPropagation(); handleItemClick(item); }}>{item.filename}</button>
                          <div className="wp-mobile-meta">{item.format?.toUpperCase() || 'IMG'} · {item.fileSize ? `${(item.fileSize/1024).toFixed(0)} KB` : '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="wp-hide-sm">{item.title || '—'}</td>
                    <td className="wp-hide-sm wp-muted">{item.format?.toUpperCase() || 'IMG'}</td>
                    <td className="wp-hide-sm wp-muted">{item.fileSize ? `${(item.fileSize/1024).toFixed(0)} KB` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="wp-toolbar" style={{ marginTop: 10 }}>
          <span className="wp-spacer" />
          <div className="wp-pages">
            <span>{pagination.total} items</span>
            <button type="button" className="wp-pager" aria-label="Previous page" disabled={page <= 1} onClick={() => goToPage(page - 1)}><ChevronLeft className="w-4 h-4" aria-hidden="true" /></button>
            <span>Page {page} of {pagination.pages}</span>
            <button type="button" className="wp-pager" aria-label="Next page" disabled={page >= pagination.pages} onClick={() => goToPage(page + 1)}><ChevronRight className="w-4 h-4" aria-hidden="true" /></button>
          </div>
        </div>
      )}

      {/* ── Attachment Details ── */}
      {detailItem && (
        <div className="wp-modal-backdrop">
          <div className="wp-modal" role="dialog" aria-modal="true" aria-labelledby="media-detail-title" style={{ maxWidth: 960 }}>
            <div className="wp-modal-head">
              <h2 id="media-detail-title">Attachment details</h2>
              <button type="button" onClick={() => setDetailItem(null)} aria-label="Close dialog" className="wp-btn" style={{ border: 0, background: "none", color: "#646970", minWidth: 40, minHeight: 40 }}><X className="w-5 h-5" aria-hidden="true" /></button>
            </div>
            <div className="flex flex-col md:flex-row" style={{ minWidth: 0 }}>
              {/* Preview */}
              <div className="flex items-center justify-center md:flex-1" style={{ background: "#f0f0f1", padding: 16, minHeight: 240, minWidth: 0 }}>
                <img src={detailItem.url} alt="" style={{ maxWidth: "100%", maxHeight: "60vh", objectFit: "contain", boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }} />
              </div>

              <div className="md:w-[360px] shrink-0" style={{ padding: 16, background: "#f6f7f7", borderLeft: "1px solid #dcdcde", minWidth: 0 }}>
                {/* File Info */}
                <div className="wp-small" style={{ color: "#3c434a", paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid #dcdcde" }}>
                  <p className="wp-strong" style={{ margin: "0 0 6px", wordBreak: "break-all" }}>{detailItem.filename}</p>
                  <p style={{ margin: 0 }}><span className="wp-muted">Uploaded on:</span> {new Date(detailItem.createdAt).toLocaleDateString()}</p>
                  {detailItem.width && <p style={{ margin: 0 }}><span className="wp-muted">Dimensions:</span> {detailItem.width} by {detailItem.height} pixels</p>}
                  {detailItem.fileSize && <p style={{ margin: 0 }}><span className="wp-muted">File size:</span> {(detailItem.fileSize/1024).toFixed(0)} KB</p>}
                </div>

                {/* Editable Fields */}
                {editItem && !detailItem.isDeleted && (
                  <div>
                    {[
                      { key: 'altText', label: 'Alternative Text', placeholder: 'Describe for accessibility...' },
                      { key: 'title', label: 'Title' },
                      { key: 'caption', label: 'Caption', type: 'textarea' },
                    ].map(field => (
                      <div key={field.key} className="wp-frow">
                        <label htmlFor={`media-field-${field.key}`} className="wp-flabel" style={{ width: 110 }}>{field.label}</label>
                        {field.type === 'textarea' ? (
                          <textarea id={`media-field-${field.key}`} rows={3} value={editItem[field.key] || ''} onChange={e => setEditItem(p => ({...p, [field.key]: e.target.value}))}
                            className="wp-textarea" style={{ flex: "1 1 180px", minWidth: 0 }} />
                        ) : (
                          <input id={`media-field-${field.key}`} value={editItem[field.key] || ''} onChange={e => setEditItem(p => ({...p, [field.key]: e.target.value}))}
                            placeholder={field.placeholder} className="wp-input" style={{ flex: "1 1 180px", minWidth: 0 }} />
                        )}
                      </div>
                    ))}
                    <div className="wp-frow">
                      <label htmlFor="media-field-url" className="wp-flabel" style={{ width: 110 }}>File URL</label>
                      <input id="media-field-url" readOnly value={detailItem.url} className="wp-input" style={{ flex: "1 1 180px", minWidth: 0 }} onFocus={e => e.target.select()} />
                    </div>
                    <div className="wp-frow">
                      <span className="wp-flabel" style={{ width: 110 }} aria-hidden="true" />
                      <button type="button" onClick={() => copyUrl(detailItem.url)} className="wp-btn">
                        {copied ? <><Check className="w-4 h-4" aria-hidden="true" /> Copied</> : "Copy URL"}
                      </button>
                      <span className="sr-only" role="status">{copied ? "URL copied to clipboard" : ""}</span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #dcdcde" }}>
                  {detailItem.isDeleted ? (
                    <>
                      <button type="button" onClick={() => restore(detailItem._id)} className="wp-btn">
                        <RotateCcw className="w-4 h-4" aria-hidden="true" /> Restore
                      </button>
                      <button type="button" onClick={() => setDeleteConfirm(detailItem._id)} style={{ background: "none", border: 0, padding: 0, color: "#b32d2e", textDecoration: "underline", cursor: "pointer", minHeight: 30 }}>
                        Delete permanently
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => softDelete(detailItem._id)} style={{ background: "none", border: 0, padding: 0, color: "#b32d2e", textDecoration: "underline", cursor: "pointer", minHeight: 30 }}>
                        Move to Trash
                      </button>
                      <span aria-hidden="true" style={{ color: "#a7aaad" }}>|</span>
                      <button type="button" onClick={() => setDeleteConfirm(detailItem._id)} style={{ background: "none", border: 0, padding: 0, color: "#b32d2e", textDecoration: "underline", cursor: "pointer", minHeight: 30 }}>
                        Delete permanently
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            {editItem && !detailItem.isDeleted && (
              <div className="wp-modal-foot">
                <button type="button" onClick={() => setDetailItem(null)} className="wp-btn">Close</button>
                <button type="button" onClick={saveMetadata} disabled={saving} className="wp-btn wp-btn-primary">
                  {saving ? "Saving..." : "Update Metadata"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Permanent Delete Confirmation Modal ── */}
      {deleteConfirm && (
        <div className="wp-modal-backdrop" style={{ zIndex: 600 }}>
          <div className="wp-modal" role="alertdialog" aria-modal="true" aria-labelledby="media-delete-title" aria-describedby="media-delete-desc" style={{ maxWidth: 440 }}>
            <div className="wp-modal-head">
              <h2 id="media-delete-title" className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" style={{ color: "#d63638" }} /> Permanently Delete?
              </h2>
            </div>
            <div className="wp-modal-body">
              <p id="media-delete-desc" style={{ margin: 0 }}>This file will be erased from Cloudinary forever. This action <strong style={{ color: "#b32d2e" }}>cannot be undone</strong>.</p>
            </div>
            <div className="wp-modal-foot">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="wp-btn">Cancel</button>
              <button type="button" onClick={() => permanentDelete(deleteConfirm)} className="wp-btn wp-btn-primary" style={{ background: "#d63638", borderColor: "#d63638" }}>Delete Forever</button>
            </div>
          </div>
        </div>
      )}
    </Page>
    </RequirePermission>
  );
}
