"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Upload, Check, Loader2, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * MediaPickerModal — WordPress-style global media picker
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   onSelect: (items) => void   — returns array of selected media objects
 *   multiple: boolean           — allow multi-select
 *   title: string               — modal header title
 */
export default function MediaPickerModal({ open, onClose, onSelect, multiple = false, title = "Select Media" }) {
  const [tab, setTab]             = useState("library"); // "library" | "upload"
  const [items, setItems]         = useState([]);
  const [selected, setSelected]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [pagination, setPagination] = useState({});
  const [detailItem, setDetailItem] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const fileInputRef              = useRef(null);
  const searchTimeout             = useRef(null);

  const fetchMedia = useCallback(async (searchVal, pg) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search: searchVal || "", page: String(pg || 1), limit: "30", _t: String(Date.now()) });
      const res = await fetch(`/api/admin/media?${params}`);
      if (!res.ok) throw new Error("Failed to fetch media");
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
        setPagination(data.pagination);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      Promise.resolve().then(() => {
        fetchMedia("", 1);
        setSelected([]);
        setTab("library");
        setDetailItem(null);
      });
    } else {
      document.body.style.overflow = "auto";
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [open, fetchMedia]);

  const gridUrl = (url) => {
    if (!url || !url.includes('cloudinary.com')) return url;
    return url.replace('/upload/', '/upload/w_300,h_300,c_fill,f_auto,q_auto/');
  };

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { fetchMedia(val, 1); setPage(1); }, 400);
  };

  const toggleSelect = (item) => {
    if (multiple) {
      setSelected(prev =>
        prev.find(s => s._id === item._id)
          ? prev.filter(s => s._id !== item._id)
          : [...prev, item]
      );
    } else {
      setSelected([item]);
      setDetailItem(item);
    }
  };

  const isSelected = (item) => selected.some(s => s._id === item._id);

  const handleInsert = () => {
    if (selected.length === 0) return;
    onSelect(multiple ? selected : selected[0]);
    onClose();
  };

  // Double-click: insert the clicked item directly (state from toggleSelect isn't updated yet)
  const insertItem = (item) => {
    if (multiple) {
      const merged = selected.some(s => s._id === item._id) ? selected : [...selected, item];
      onSelect(merged);
    } else {
      onSelect(item);
    }
    onClose();
  };

  // Upload handling
  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append("file", f));
    try {
      const res = await fetch("/api/admin/media/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success && data.uploaded.length > 0) {
        setTab("library");
        await fetchMedia("", 1);
        // Auto-select just-uploaded items
        setSelected(data.uploaded);
      }
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // Save metadata inline
  const saveMetadata = async () => {
    if (!detailItem) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/media/${detailItem._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: detailItem.title,
          altText: detailItem.altText,
          caption: detailItem.caption,
          tags: detailItem.tags,
        })
      });
      const data = await res.json();
      if (data.success) {
        setItems(prev => prev.map(i => i._id === detailItem._id ? data.media : i));
      }
    } finally { setSaving(false); }
  };

  if (!open) return null;

  const tile = (sel) => ({
    background: "#f0f0f1", border: 0, padding: 0, cursor: "pointer",
    boxShadow: sel
      ? "inset 0 0 0 3px #fff, inset 0 0 0 7px #2271b1"
      : "inset 0 0 15px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(0,0,0,0.05)",
  });

  return (
    <div className="wp-modal-backdrop" style={{ zIndex: 500, padding: 8 }}>
      <div
        className="wp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-picker-title"
        style={{ maxWidth: 1100, height: "min(85vh, 900px)", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >

        {/* ── Header ── */}
        <div className="wp-modal-head shrink-0" style={{ borderBottom: 0, paddingBottom: 4 }}>
          <h2 id="media-picker-title" className="truncate">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex items-center justify-center shrink-0"
            style={{ width: 40, height: 40, background: "none", border: 0, color: "#646970", cursor: "pointer" }}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="wp-tabs shrink-0" role="tablist" aria-label="Media source" style={{ margin: 0, padding: "0 16px" }}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "upload"}
            onClick={() => setTab("upload")}
            className="wp-tab"
          >
            Upload files
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "library"}
            onClick={() => setTab("library")}
            className="wp-tab"
          >
            Media Library
          </button>
        </div>

        {tab === "upload" ? (
          /* ── Upload Tab ── */
          <div className="flex-1 flex items-center justify-center overflow-y-auto" style={{ padding: 16 }}>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className="w-full text-center cursor-pointer"
              style={{
                maxWidth: 640,
                border: `4px dashed ${dragOver ? "#2271b1" : "#c3c4c7"}`,
                background: dragOver ? "#f0f6fc" : "#fff",
                padding: "48px 16px",
              }}
            >
              <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => handleFiles(e.target.files)} />
              {uploading ? (
                <div className="flex flex-col items-center gap-3" role="status">
                  <Loader2 className="w-8 h-8 animate-spin" aria-hidden="true" style={{ color: "#2271b1" }} />
                  <p className="wp-muted" style={{ margin: 0 }}>Uploading to Cloudinary...</p>
                </div>
              ) : (
                <>
                  <h3 style={{ fontSize: 20, fontWeight: 400, color: "#1d2327", margin: "0 0 8px" }}>Drop files to upload</h3>
                  <p className="wp-muted" style={{ margin: "0 0 12px" }}>or</p>
                  <span className="wp-btn" style={{ minHeight: 40, padding: "0 16px" }}>
                    <Upload className="w-4 h-4" aria-hidden="true" /> Select Files
                  </span>
                  <p className="wp-desc" style={{ marginTop: 16 }}>JPG, PNG, GIF, WebP, SVG — Max 8MB</p>
                </>
              )}
            </div>
          </div>
        ) : (
          /* ── Library Tab ── */
          <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">

            {/* Left: Grid */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2 shrink-0" style={{ padding: "10px 16px" }}>
                {multiple && selected.length > 0 && (
                  <span className="wp-muted">{selected.length} selected</span>
                )}
                <span style={{ flex: 1 }} />
                <label htmlFor="media-picker-search" className="sr-only">Search media</label>
                <input
                  id="media-picker-search"
                  type="search"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search media items..."
                  className="wp-input"
                  style={{ width: "100%", maxWidth: 260 }}
                />
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-y-auto" style={{ padding: "0 16px 16px" }}>
                {loading ? (
                  <div className="flex items-center justify-center h-40" role="status" aria-label="Loading media">
                    <Loader2 className="w-7 h-7 animate-spin" aria-hidden="true" style={{ color: "#2271b1" }} />
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2">
                    <ImageIcon className="w-9 h-9" aria-hidden="true" style={{ color: "#c3c4c7" }} />
                    <p className="wp-muted text-center" style={{ margin: 0 }}>No media found. Upload files to get started.</p>
                  </div>
                ) : (
                  <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {items.map(item => (
                      <li key={item._id}>
                        <button
                          type="button"
                          onClick={() => toggleSelect(item)}
                          onDoubleClick={() => insertItem(item)}
                          aria-pressed={isSelected(item)}
                          aria-label={item.filename || item.title || "Media item"}
                          title={item.filename}
                          className="relative block w-full aspect-square overflow-hidden"
                          style={tile(isSelected(item))}
                        >
                          <img
                            src={gridUrl(item.url)}
                            alt={item.altText || item.filename}
                            className="w-full h-full object-cover"
                            style={isSelected(item) ? { padding: 7 } : undefined}
                            loading="lazy"
                          />
                          {isSelected(item) && (
                            <span aria-hidden="true" className="absolute flex items-center justify-center" style={{ top: 0, right: 0, width: 24, height: 24, background: "#2271b1", boxShadow: "0 0 0 1px #fff, 0 0 0 2px #2271b1" }}>
                              <Check className="w-4 h-4" style={{ color: "#fff" }} />
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="wp-pages shrink-0" style={{ justifyContent: "center", padding: "8px 16px", borderTop: "1px solid #dcdcde" }}>
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => { setPage(p => p-1); fetchMedia(search, page-1); }}
                    className="wp-pager"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <span>Page {page} of {pagination.pages}</span>
                  <button
                    type="button"
                    disabled={page >= pagination.pages}
                    onClick={() => { setPage(p => p+1); fetchMedia(search, page+1); }}
                    className="wp-pager"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

            {/* Right: Detail Panel */}
            {(detailItem || (selected.length === 1 && !multiple)) && (
              <aside aria-labelledby="media-picker-details-title" className="w-full md:w-[280px] max-h-[35vh] md:max-h-none shrink-0 overflow-y-auto border-t md:border-t-0 md:border-l border-[#dcdcde]" style={{ background: "#f6f7f7" }}>
                {(() => {
                  const item = detailItem || selected[0];
                  if (!item) return null;
                  return (
                    <div style={{ padding: 16 }}>
                      <h3 id="media-picker-details-title" style={{ fontSize: 12, fontWeight: 600, color: "#646970", margin: "0 0 10px", textTransform: "uppercase" }}>Attachment details</h3>
                      <div className="flex gap-3" style={{ paddingBottom: 12, marginBottom: 8, borderBottom: "1px solid #dcdcde" }}>
                        <div style={{ width: 120, height: 120, flexShrink: 0, background: "#fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>
                          <img src={item.url} alt="" className="w-full h-full object-contain" />
                        </div>
                        <div className="wp-small min-w-0" style={{ color: "#3c434a" }}>
                          <p className="wp-strong" style={{ margin: "0 0 4px", wordBreak: "break-all" }}>{item.filename}</p>
                          <p style={{ margin: 0 }}>{new Date(item.createdAt).toLocaleDateString()}</p>
                          {item.fileSize && <p style={{ margin: 0 }}>{(item.fileSize / 1024).toFixed(0)} KB</p>}
                          {item.width && <p style={{ margin: 0 }}>{item.width} by {item.height} pixels</p>}
                        </div>
                      </div>

                      <div className="wp-frow">
                        <label htmlFor="mp-alt" className="wp-flabel" style={{ width: "100%" }}>Alternative Text</label>
                        <input
                          id="mp-alt"
                          value={detailItem?.altText ?? item.altText ?? ''}
                          onChange={e => setDetailItem(prev => ({ ...(prev || item), altText: e.target.value }))}
                          className="wp-input"
                          style={{ flex: "1 1 100%", minWidth: 0 }}
                          placeholder="Describe this image..."
                        />
                      </div>
                      <div className="wp-frow">
                        <label htmlFor="mp-title" className="wp-flabel" style={{ width: "100%" }}>Title</label>
                        <input
                          id="mp-title"
                          value={detailItem?.title ?? item.title ?? ''}
                          onChange={e => setDetailItem(prev => ({ ...(prev || item), title: e.target.value }))}
                          className="wp-input"
                          style={{ flex: "1 1 100%", minWidth: 0 }}
                        />
                      </div>
                      <div className="wp-frow">
                        <label htmlFor="mp-caption" className="wp-flabel" style={{ width: "100%" }}>Caption</label>
                        <textarea
                          id="mp-caption"
                          rows={2}
                          value={detailItem?.caption ?? item.caption ?? ''}
                          onChange={e => setDetailItem(prev => ({ ...(prev || item), caption: e.target.value }))}
                          className="wp-textarea"
                          style={{ flex: "1 1 100%", minWidth: 0 }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={saveMetadata}
                        disabled={saving}
                        className="wp-btn"
                        style={{ marginTop: 8 }}
                      >
                        {saving ? "Saving..." : "Save Metadata"}
                      </button>
                    </div>
                  );
                })()}
              </aside>
            )}
          </div>
        )}

        {/* ── Footer Action Bar ── */}
        <div className="wp-modal-foot shrink-0" style={{ alignItems: "center" }}>
          <p className="wp-muted truncate" style={{ margin: 0, marginRight: "auto", minWidth: 0 }}>
            {selected.length > 0
              ? `${selected.length} item${selected.length > 1 ? 's' : ''} selected`
              : "Select an image"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="wp-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={selected.length === 0}
            className="wp-btn wp-btn-primary"
            style={{ minHeight: 36 }}
          >
            {multiple ? `Select (${selected.length})` : "Select"}
          </button>
        </div>
      </div>
    </div>
  );
}
