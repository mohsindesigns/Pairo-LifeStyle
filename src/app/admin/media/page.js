"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search, LayoutGrid, List, Upload, Trash2, RotateCcw,
  X, Check, Loader2, Image as ImageIcon, ChevronLeft, ChevronRight
} from "lucide-react";
import { Page, PageHeader, Notice } from "@/components/admin/ui";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import ThemedSelect from "@/components/ui/ThemedSelect";

// WordPress media modal: near full-screen, grey preview pane, 300px details sidebar.
const MEDIA_MODAL_CSS = `
.admin-dashboard-container .media-modal-backdrop { padding: 30px; z-index: 100000; }
.admin-dashboard-container .media-modal { max-width: none; width: 100%; height: calc(100dvh - 60px); max-height: none; display: flex; flex-direction: column; overflow: hidden; }
.media-modal-head { display: flex; align-items: center; justify-content: space-between; height: 50px; padding-left: 16px; border-bottom: 1px solid #dcdcde; flex: none; }
.media-modal-head h2 { font-size: 22px !important; font-weight: 600 !important; margin: 0; color: #1d2327; }
.media-modal-nav { display: flex; height: 100%; }
.media-modal-nav button { width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: none; border: 0; border-left: 1px solid #dcdcde; color: #787c82; cursor: pointer; }
.media-modal-nav button:hover:not(:disabled), .media-modal-nav button:focus-visible { color: #2271b1; background: #f6f7f7; }
.media-modal-nav button:disabled { color: #dcdcde; cursor: default; }
.media-modal-content { display: flex; flex: 1; min-height: 0; }
.media-modal-preview { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; padding: 16px; background: #f0f0f1; overflow: auto; }
.media-modal-preview img { max-width: 100%; max-height: 100%; object-fit: contain; box-shadow: 0 0 0 1px rgba(0,0,0,.1); background: #fff; }
.media-modal-sidebar { width: 336px; flex: none; overflow-y: auto; padding: 0 16px 16px; background: #f6f7f7; border-left: 1px solid #dcdcde; font-size: 13px; color: #3c434a; }
.media-modal-info { padding: 16px 0 12px; border-bottom: 1px solid #dcdcde; line-height: 1.6; }
.media-modal-info p { margin: 0; }
.media-modal-fields { padding-top: 12px; }
.media-setting { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 10px; }
.media-setting > label { flex: 0 0 30%; text-align: right; padding-top: 6px; color: #646970; font-size: 12px; }
.media-setting-ctrl { flex: 1; min-width: 0; }
.admin-dashboard-container .media-setting-ctrl .wp-input, .admin-dashboard-container .media-setting-ctrl .wp-textarea { width: 100% !important; max-width: none !important; }
.media-setting-ctrl .wp-hint { margin: 4px 0 0; font-size: 12px; }
.media-save-status { min-height: 18px; margin: 0 0 0 calc(30% + 8px); display: flex; align-items: center; gap: 4px; color: #646970; font-size: 12px; }
.media-modal-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; padding-top: 12px; margin-top: 8px; border-top: 1px solid #dcdcde; font-size: 13px; }
.media-modal-actions a, .media-modal-actions button { text-decoration: none !important; }
.media-modal-actions a:hover, .media-modal-actions button:hover { text-decoration: underline !important; }
.media-modal-actions a { color: #2271b1; }
.media-modal-actions a:hover { color: #135e96; }
@media (max-width: 782px) {
  .admin-dashboard-container .media-modal-backdrop { padding: 0; }
  .admin-dashboard-container .media-modal { height: 100dvh; }
  .media-modal-head h2 { font-size: 18px !important; }
  .media-modal-content { flex-direction: column; overflow-y: auto; }
  .media-modal-preview { flex: none; min-height: 220px; max-height: 45vh; }
  .media-modal-sidebar { width: auto; border-left: 0; border-top: 1px solid #dcdcde; overflow: visible; }
  .media-setting { flex-direction: column; align-items: stretch; gap: 4px; }
  .media-setting > label { text-align: left; padding-top: 0; flex: none; }
  .media-save-status { margin-left: 0; }
}
`;

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
  const [bulkBusy, setBulkBusy]     = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [copied, setCopied]         = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimer = useRef(null);
  const [counts, setCounts]         = useState({ library: 0, trash: 0 });
  const [loadError, setLoadError]   = useState("");
  const fileInputRef = useRef(null);
  const searchTimeout = useRef(null);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/media?counts=true&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setCounts({ library: data.library || 0, trash: data.trash || 0 });
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchMedia = useCallback(async (q, t = "library") => {
    setLoading(true);
    setLoadError("");
    fetchCounts();
    try {
      const params = new URLSearchParams({
        search: q.search || "", page: String(q.page || 1), limit: "30", trash: (t === "trash").toString(),
        type: q.type || "all", sort: q.sort || "newest", _t: Date.now().toString()
      });
      const res = await fetch(`/api/admin/media?${params}`);
      const data = await res.json();
      if (res.ok && data.success) { setItems(data.items); setPagination(data.pagination); }
      else { setItems([]); setLoadError(data?.error || "Failed to load media."); }
    } catch (e) {
      console.error(e);
      setItems([]);
      setLoadError("Failed to load media. Check your connection and try again.");
    }
    finally { setLoading(false); }
  }, [fetchCounts]);

  useEffect(() => {
    Promise.resolve().then(() => fetchMedia(query, tab));
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

  // Search button / Enter: search immediately instead of waiting for the debounce
  const submitSearch = (e) => {
    e.preventDefault();
    clearTimeout(searchTimeout.current);
    setQuery(q => ({ ...q, search, page: 1 }));
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
      const data = await res.json().catch(() => ({}));
      const uploaded = data?.uploaded?.length ?? data?.count ?? 0;
      if (res.ok && data.success) {
        if (uploaded) toast.success(`${uploaded} file${uploaded === 1 ? "" : "s"} uploaded.`);
        clearTimeout(searchTimeout.current);
        setSearch("");
        setSelected(new Set());
        setDetailItem(null);
        // New query object always triggers a fresh fetch of page 1 (keeps type & sort)
        setQuery(q => ({ ...q, search: "", page: 1 }));
        setTab("library");
      }
      if (data.errors?.length) toast.error(data.errors.map(e => `${e.file}: ${e.error}`).join('\n'));
      else if (!res.ok || !data.success) toast.error(data?.error || "Upload failed.");
    } catch (e) {
      console.error(e);
      toast.error("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isDirty = () => !!editItem && !!detailItem && editItem._id === detailItem._id &&
    ["title", "altText", "caption"].some(k => (editItem[k] || "") !== (detailItem[k] || ""));

  // Fields save when you leave them (like WordPress), so there's no separate save button.
  const saveMetadata = async ({ quiet = false } = {}) => {
    if (!editItem) return true;
    if (quiet && !isDirty()) return true;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/media/${editItem._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editItem.title, altText: editItem.altText, caption: editItem.caption, tags: editItem.tags }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setItems(prev => prev.map(i => i._id === editItem._id ? data.media : i));
        setDetailItem(data.media);
        setEditItem({ ...data.media });
        if (quiet) {
          setSavedFlash(true);
          clearTimeout(savedTimer.current);
          savedTimer.current = setTimeout(() => setSavedFlash(false), 2000);
        } else toast.success("Media details saved.");
        return true;
      }
      toast.error(data?.error || "Failed to save media details.");
      return false;
    } catch (e) {
      console.error(e);
      toast.error("Failed to save media details.");
      return false;
    } finally { setSaving(false); }
  };

  // Leaving the dialog (close or prev/next) saves any field still being typed in first.
  const closeDetail = async () => {
    if (isDirty() && !(await saveMetadata({ quiet: true }))) return;
    setDetailItem(null);
  };
  const openSibling = async (item) => {
    if (!item) return;
    if (isDirty() && !(await saveMetadata({ quiet: true }))) return;
    setDetailItem(item);
    setEditItem({ ...item });
  };
  // Keyboard, as in WordPress: Esc closes, left/right arrows step (not while typing in a field)
  const keyHandler = useRef(null);
  useEffect(() => { keyHandler.current = (e) => {
    if (e.key === "Escape") { e.preventDefault(); closeDetail(); return; }
    if (saving || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "")) return;
    const idx = items.findIndex(i => i._id === detailItem?._id);
    if (e.key === "ArrowLeft" && idx > 0) openSibling(items[idx - 1]);
    if (e.key === "ArrowRight" && idx >= 0 && idx < items.length - 1) openSibling(items[idx + 1]);
  }; });
  const detailOpen = !!detailItem;
  useEffect(() => {
    if (!detailOpen) return;
    const onKey = (e) => keyHandler.current?.(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailOpen]);

  const usageNote = (item) =>
    item?.usageCount > 0 ? ` It is recorded as used in ${item.usageCount} place${item.usageCount === 1 ? "" : "s"}.` : "";

  const softDelete = async (id) => {
    const item = items.find(i => i._id === id) || detailItem;
    const ok = await showConfirm(
      `Move this file to the Trash?${usageNote(item)} The file stays available until it is deleted permanently, so pages using it keep working.`,
      "Move to Trash",
      { confirmText: "Move to Trash" }
    );
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

  const permanentDelete = async (id) => {
    const item = items.find(i => i._id === id) || detailItem;
    const ok = await showConfirm(
      `Permanently delete "${item?.filename || "this file"}"? The file is erased from storage and this cannot be undone.${item?.usageCount > 0 ? ` It is recorded as used in ${item.usageCount} place${item.usageCount === 1 ? "" : "s"}; those image fields will be cleared.` : ""}`,
      "Delete Permanently",
      { confirmText: "Delete Permanently", danger: true }
    );
    if (!ok) return;
    const previousItems = items;
    setItems(prev => prev.filter(item => item._id !== id));
    setDetailItem(null);

    const promise = fetch(`/api/admin/media/${id}?permanent=true`, { method: "DELETE" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
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

  // Bulk actions: Library -> Move to Trash; Trash -> Restore / Delete permanently
  const runBulk = async (kind) => {
    const ids = [...selected];
    if (ids.length === 0) { toast.error("Select at least one file."); return; }
    const n = `${ids.length} file${ids.length === 1 ? "" : "s"}`;
    const cfg = {
      trash:     { msg: `Move ${n} to the Trash?`, title: "Move to Trash", opts: { confirmText: "Move to Trash" }, done: "moved to the Trash",
                   req: (id) => fetch(`/api/admin/media/${id}`, { method: "DELETE" }) },
      restore:   { msg: null, done: "restored",
                   req: (id) => fetch(`/api/admin/media/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restore: true }) }) },
      permanent: { msg: `Permanently delete ${n}? The files are erased from storage and this cannot be undone. Image fields that still point to them will be cleared.`, title: "Delete Permanently", opts: { confirmText: "Delete Permanently", danger: true }, done: "deleted permanently",
                   req: (id) => fetch(`/api/admin/media/${id}?permanent=true`, { method: "DELETE" }) },
    }[kind];
    if (cfg.msg && !(await showConfirm(cfg.msg, cfg.title, cfg.opts))) return;
    setBulkBusy(true);
    const results = [];
    for (const id of ids) {
      try { results.push((await cfg.req(id)).ok); } catch { results.push(false); }
    }
    setBulkBusy(false);
    const succeeded = results.filter(Boolean).length;
    const failed = results.length - succeeded;
    // Keep failed items selected so they can be retried
    setSelected(new Set(ids.filter((_, i) => !results[i])));
    if (failed === 0) setBulkMode(false);
    reload();
    if (failed === 0) toast.success(`${succeeded} file${succeeded === 1 ? "" : "s"} ${cfg.done}.`);
    else toast.error(`${succeeded} ${cfg.done}, ${failed} failed.`);
  };

  const pageIds = items.map(i => i._id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const toggleSelectPage = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach(id => next.delete(id));
      else pageIds.forEach(id => next.add(id));
      return next;
    });
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

  const detailIdx = detailItem ? items.findIndex(i => i._id === detailItem._id) : -1;
  const prevItem = detailIdx > 0 ? items[detailIdx - 1] : null;
  const nextItem = detailIdx >= 0 && detailIdx < items.length - 1 ? items[detailIdx + 1] : null;
  const isImage = !detailItem?.mimeType || detailItem.mimeType.startsWith("image/");
  const editable = !!editItem && !!detailItem && !detailItem.isDeleted;
  const linkBtn = { background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit", textDecoration: "underline" };

  return (
    <RequirePermission permission="media.manage">
    <Page>
      <PageHeader
        title="Media Library"
        actions={
          <label className="wp-btn" style={{ cursor: uploading ? "default" : "pointer" }}>
            <Upload className="w-4 h-4" aria-hidden="true" />
            {uploading ? "Uploading..." : "Add New Media File"}
            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => handleFiles(e.target.files)} disabled={uploading} />
          </label>
        }
      />

      {/* ── Library / Trash ── */}
      <div className="wp-subsub" role="tablist" aria-label="Media views">
        <button type="button" role="tab" aria-selected={tab === "library"} className={tab === "library" ? "is-current" : undefined} onClick={() => changeTab("library")}>
          All media <span className="wp-count">({counts.library})</span>
        </button>
        <span className="wp-sep" aria-hidden="true">|</span>
        <button type="button" role="tab" aria-selected={tab === "trash"} className={tab === "trash" ? "is-current" : undefined} onClick={() => changeTab("trash")}>
          Trash <span className="wp-count">({counts.trash})</span>
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="wp-toolbar" style={{ background: "#fff", border: "1px solid #c3c4c7", padding: "8px 10px", marginBottom: 0, borderBottom: 0 }}>
        <div className="flex items-center gap-0.5" role="group" aria-label="View mode">
          <button type="button" onClick={() => setView("grid")} aria-pressed={view === "grid"} aria-label="Grid view" title="Grid view" style={iconBtn(view === "grid")}><LayoutGrid className="w-4 h-4" aria-hidden="true" /></button>
          <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} aria-label="List view" title="List view" style={iconBtn(view === "list")}><List className="w-4 h-4" aria-hidden="true" /></button>
        </div>

        <label htmlFor="media-filter-type" className="sr-only">Filter by type</label>
        <ThemedSelect
          id="media-filter-type"
          value={query.type}
          onChange={(e) => { const type = e.target.value; setQuery(q => ({ ...q, type, page: 1 })); }}
          className="wp-select"
        >
          <option value="all">All media items</option>
          <option value="image">Images</option>
        </ThemedSelect>

        <label htmlFor="media-sort" className="sr-only">Sort media</label>
        <ThemedSelect
          id="media-sort"
          value={query.sort}
          onChange={(e) => { const sort = e.target.value; setQuery(q => ({ ...q, sort, page: 1 })); }}
          className="wp-select"
        >
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
          <option value="name">Sort: Name A-Z</option>
        </ThemedSelect>

        <button type="button" onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); }}
          aria-pressed={bulkMode}
          className={`wp-btn${bulkMode ? " wp-btn-primary" : ""}`}>
          {bulkMode ? `Cancel bulk select (${selected.size})` : "Bulk select"}
        </button>

        {bulkMode && items.length > 0 && (
          <button type="button" onClick={toggleSelectPage} className="wp-btn">
            {allOnPageSelected ? "Deselect page" : "Select page"}
          </button>
        )}

        {bulkMode && selected.size > 0 && (tab === "trash" ? (
          <>
            <button type="button" onClick={() => runBulk("restore")} disabled={bulkBusy} className="wp-btn">
              <RotateCcw className="w-4 h-4" aria-hidden="true" /> Restore
            </button>
            <button type="button" onClick={() => runBulk("permanent")} disabled={bulkBusy} className="wp-btn" style={{ color: "#b32d2e", borderColor: "#b32d2e" }}>
              <Trash2 className="w-4 h-4" aria-hidden="true" /> Delete permanently
            </button>
          </>
        ) : (
          <button type="button" onClick={() => runBulk("trash")} disabled={bulkBusy} className="wp-btn" style={{ color: "#b32d2e", borderColor: "#b32d2e" }}>
            <Trash2 className="w-4 h-4" aria-hidden="true" /> Move to Trash
          </button>
        ))}

        <span className="wp-spacer" />

        <form className="wp-search" role="search" onSubmit={submitSearch}>
          <label htmlFor="media-search" className="sr-only">Search media</label>
          <Search className="w-4 h-4 wp-hide-sm" aria-hidden="true" style={{ color: "#8c8f94" }} />
          <input id="media-search" type="search" value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search media items..." className="wp-input" />
          <button type="submit" className="wp-btn">Search</button>
        </form>
      </div>

      {loadError && (
        <Notice type="error">
          {loadError}{" "}
          <button type="button" onClick={reload} style={{ background: "none", border: 0, padding: 0, color: "#2271b1", textDecoration: "underline", cursor: "pointer" }}>Try again</button>
        </Notice>
      )}

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

      {/* ── Attachment details (WordPress media modal: preview left, details sidebar right,
           fields save as you leave them, prev/next arrows step through the library) ── */}
      {detailItem && (
        <div className="wp-modal-backdrop media-modal-backdrop">
          <div className="wp-modal media-modal" role="dialog" aria-modal="true" aria-labelledby="media-detail-title">
            <div className="media-modal-head">
              <h2 id="media-detail-title">Attachment details</h2>
              <div className="media-modal-nav">
                <button type="button" aria-label="Previous media item" disabled={!prevItem || saving} onClick={() => openSibling(prevItem)}><ChevronLeft className="w-5 h-5" aria-hidden="true" /></button>
                <button type="button" aria-label="Next media item" disabled={!nextItem || saving} onClick={() => openSibling(nextItem)}><ChevronRight className="w-5 h-5" aria-hidden="true" /></button>
                <button type="button" aria-label="Close dialog" onClick={closeDetail}><X className="w-5 h-5" aria-hidden="true" /></button>
              </div>
            </div>
            <div className="media-modal-content">
              {/* Preview */}
              <div className="media-modal-preview">
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detailItem.url} alt="" />
                ) : (
                  <div className="wp-muted" style={{ textAlign: "center" }}><ImageIcon className="w-12 h-12" aria-hidden="true" style={{ margin: "0 auto 8px" }} />{detailItem.filename}</div>
                )}
              </div>

              {/* Details sidebar */}
              <div className="media-modal-sidebar">
                <div className="media-modal-info">
                  <p><strong>Uploaded on:</strong> {new Date(detailItem.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
                  <p><strong>File name:</strong> <span style={{ wordBreak: "break-all" }}>{detailItem.filename}</span></p>
                  {detailItem.mimeType && <p><strong>File type:</strong> {detailItem.mimeType}</p>}
                  {detailItem.fileSize ? <p><strong>File size:</strong> {(detailItem.fileSize/1024).toFixed(0)} KB</p> : null}
                  {detailItem.width ? <p><strong>Dimensions:</strong> {detailItem.width} by {detailItem.height} pixels</p> : null}
                  <p>
                    <strong>Used in:</strong>{" "}
                    {detailItem.usageCount > 0 ? `${detailItem.usageCount} place${detailItem.usageCount === 1 ? "" : "s"}` : "Not recorded as used"}
                  </p>
                  {detailItem.usageRefs?.length > 0 && (
                    <ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>
                      {detailItem.usageRefs.slice(0, 5).map((r, i) => (
                        <li key={i} style={{ wordBreak: "break-word" }}>{r.label || `${r.entityType} — ${r.fieldName}`}</li>
                      ))}
                      {detailItem.usageRefs.length > 5 && <li className="wp-muted">and {detailItem.usageRefs.length - 5} more</li>}
                    </ul>
                  )}
                  {detailItem.isDeleted && detailItem.deletedAt && (
                    <p><strong>Trashed on:</strong> {new Date(detailItem.deletedAt).toLocaleDateString()}</p>
                  )}
                </div>

                {editable && (
                  <div className="media-modal-fields">
                    {[
                      { key: 'altText', label: 'Alternative Text', hint: 'Describe the purpose of the image. Leave empty if the image is purely decorative.' },
                      { key: 'title', label: 'Title' },
                      { key: 'caption', label: 'Caption', type: 'textarea' },
                    ].map(field => (
                      <div key={field.key} className="media-setting">
                        <label htmlFor={`media-field-${field.key}`}>{field.label}</label>
                        <div className="media-setting-ctrl">
                          {field.type === 'textarea' ? (
                            <textarea id={`media-field-${field.key}`} rows={3} className="wp-textarea" value={editItem[field.key] || ''}
                              onChange={e => setEditItem(p => ({...p, [field.key]: e.target.value}))} onBlur={() => saveMetadata({ quiet: true })} />
                          ) : (
                            <input id={`media-field-${field.key}`} className="wp-input" value={editItem[field.key] || ''}
                              onChange={e => setEditItem(p => ({...p, [field.key]: e.target.value}))} onBlur={() => saveMetadata({ quiet: true })} />
                          )}
                          {field.hint && <p className="wp-hint">{field.hint}</p>}
                        </div>
                      </div>
                    ))}
                    <div className="media-setting">
                      <label htmlFor="media-field-url">File URL</label>
                      <div className="media-setting-ctrl">
                        <input id="media-field-url" readOnly value={detailItem.url} className="wp-input" onFocus={e => e.target.select()} />
                        <button type="button" onClick={() => copyUrl(detailItem.url)} className="wp-btn wp-btn-sm" style={{ marginTop: 6 }}>
                          {copied ? <><Check className="w-4 h-4" aria-hidden="true" /> Copied!</> : "Copy URL to clipboard"}
                        </button>
                        <span className="sr-only" role="status">{copied ? "URL copied to clipboard" : ""}</span>
                      </div>
                    </div>
                    <p className="media-save-status" role="status" aria-live="polite">
                      {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Saving…</> : savedFlash ? "Saved." : ""}
                    </p>
                  </div>
                )}

                {/* Action links, WordPress style */}
                <div className="media-modal-actions">
                  <a href={detailItem.url} target="_blank" rel="noopener noreferrer">View media file</a>
                  <span className="wp-sep" aria-hidden="true">|</span>
                  <a href={detailItem.url} download={detailItem.filename || true}>Download file</a>
                  <span className="wp-sep" aria-hidden="true">|</span>
                  {detailItem.isDeleted ? (
                    <>
                      <button type="button" onClick={() => restore(detailItem._id)} style={{ ...linkBtn, color: "#2271b1" }}>Restore</button>
                      <span className="wp-sep" aria-hidden="true">|</span>
                      <button type="button" onClick={() => permanentDelete(detailItem._id)} style={{ ...linkBtn, color: "#b32d2e" }}>Delete permanently</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => softDelete(detailItem._id)} style={{ ...linkBtn, color: "#b32d2e" }}>Move to Trash</button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <style>{MEDIA_MODAL_CSS}</style>
        </div>
      )}

    </Page>
    </RequirePermission>
  );
}
