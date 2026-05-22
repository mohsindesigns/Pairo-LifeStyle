"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Search, Upload, Check, Loader2, Image as ImageIcon, LayoutGrid, List, ChevronLeft, ChevronRight } from "lucide-react";

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
      const params = new URLSearchParams({ search: searchVal || "", page: String(pg || 1), limit: "30" });
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

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-[1100px] h-[85vh] flex flex-col shadow-2xl border border-[#c3c4c7] rounded-sm overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#c3c4c7] bg-[#f6f7f7] shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-[15px] font-semibold text-[#1d2327]">{title}</h2>
            <div className="flex rounded-sm overflow-hidden border border-[#8c8f94]">
              <button 
                type="button"
                onClick={() => setTab("library")} 
                className={`px-3 py-1 text-[12px] font-medium transition-colors ${tab === "library" ? "bg-[#2271b1] text-white" : "bg-white text-[#646970] hover:bg-[#f0f0f1]"}`}
              >
                Library
              </button>
              <button 
                type="button"
                onClick={() => setTab("upload")} 
                className={`px-3 py-1 text-[12px] font-medium border-l border-[#8c8f94] transition-colors ${tab === "upload" ? "bg-[#2271b1] text-white" : "bg-white text-[#646970] hover:bg-[#f0f0f1]"}`}
              >
                Upload Files
              </button>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 hover:bg-[#e0e0e0] rounded-sm transition-colors"
          >
            <X className="w-5 h-5 text-[#646970]" />
          </button>
        </div>

        {tab === "upload" ? (
          /* ── Upload Tab ── */
          <div className="flex-1 flex items-center justify-center p-10">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full max-w-xl border-2 border-dashed rounded-sm p-16 text-center cursor-pointer transition-all ${dragOver ? "border-[#2271b1] bg-[#f0f6fa]" : "border-[#c3c4c7] hover:border-[#2271b1] bg-[#f9f9f9]"}`}
            >
              <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => handleFiles(e.target.files)} />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-[#2271b1] animate-spin" />
                  <p className="text-[14px] text-[#646970]">Uploading to Cloudinary...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-[#8c8f94] mx-auto mb-4" />
                  <h3 className="text-[20px] font-light text-[#1d2327] mb-2">Drop files to upload</h3>
                  <p className="text-[13px] text-[#646970] mb-4">or</p>
                  <span className="bg-white border border-[#2271b1] text-[#2271b1] px-4 py-2 text-[13px] font-medium rounded-sm hover:bg-[#f0f6fa]">
                    Select Files
                  </span>
                  <p className="mt-4 text-[11px] text-[#8c8f94]">JPG, PNG, GIF, WebP, SVG — Max 8MB</p>
                </>
              )}
            </div>
          </div>
        ) : (
          /* ── Library Tab ── */
          <div className="flex flex-1 min-h-0">

            {/* Left: Grid */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Toolbar */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#f0f0f1] bg-[#fcfcfc] shrink-0">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8c8f94]" />
                  <input
                    value={search}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder="Search media..."
                    className="w-full pl-8 pr-3 py-1.5 border border-[#c3c4c7] text-[13px] outline-none focus:border-[#2271b1] rounded-sm bg-white"
                  />
                </div>
                {multiple && selected.length > 0 && (
                  <span className="text-[12px] text-[#646970]">{selected.length} selected</span>
                )}
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-y-auto p-2 bg-[#f0f0f1]">
                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-8 h-8 text-[#2271b1] animate-spin" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2">
                    <ImageIcon className="w-10 h-10 text-[#c3c4c7]" />
                    <p className="text-[13px] text-[#8c8f94] italic">No media found. Upload some files to get started.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-1">
                    {items.map(item => (
                      <div
                        key={item._id}
                        onClick={() => toggleSelect(item)}
                        onDoubleClick={() => { toggleSelect(item); handleInsert(); }}
                        className={`relative aspect-square cursor-pointer group overflow-hidden border-[3px] transition-all ${
                          isSelected(item)
                            ? "border-[#2271b1]"
                            : "border-transparent hover:border-[#2271b1]/40"
                        }`}
                      >
                        <img
                          src={gridUrl(item.url)}
                          alt={item.altText || item.filename}
                          className="w-full h-full object-cover bg-white"
                          loading="lazy"
                        />
                        {isSelected(item) && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-[#2271b1] rounded-full flex items-center justify-center shadow">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[9px] px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                          {item.filename}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-center gap-3 py-2 border-t border-[#f0f0f1] bg-white shrink-0">
                  <button 
                    type="button"
                    disabled={page <= 1} 
                    onClick={() => { setPage(p => p-1); fetchMedia(search, page-1); }} 
                    className="p-1 disabled:opacity-30 hover:bg-[#f0f0f1] rounded"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[12px] text-[#646970]">Page {page} of {pagination.pages}</span>
                  <button 
                    type="button"
                    disabled={page >= pagination.pages} 
                    onClick={() => { setPage(p => p+1); fetchMedia(search, page+1); }} 
                    className="p-1 disabled:opacity-30 hover:bg-[#f0f0f1] rounded"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Right: Detail Panel */}
            {(detailItem || (selected.length === 1 && !multiple)) && (
              <div className="w-[260px] border-l border-[#c3c4c7] bg-white flex flex-col shrink-0 overflow-y-auto">
                {(() => {
                  const item = detailItem || selected[0];
                  if (!item) return null;
                  return (
                    <div className="p-4 space-y-4">
                      <h3 className="text-[11px] font-bold text-[#1d2327] uppercase tracking-wider">Attachment Details</h3>
                      <div className="aspect-square bg-[#f0f0f1] overflow-hidden rounded-sm">
                        <img src={item.url} alt="" className="w-full h-full object-contain" />
                      </div>
                      <div className="text-[11px] text-[#646970] space-y-0.5">
                        <p className="font-medium text-[#1d2327] truncate">{item.filename}</p>
                        {item.width && <p>{item.width} × {item.height}px</p>}
                        {item.fileSize && <p>{(item.fileSize / 1024).toFixed(0)} KB</p>}
                        <p>{new Date(item.createdAt).toLocaleDateString()}</p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-bold text-[#1d2327] block mb-1">Alt Text</label>
                          <input
                            value={detailItem?.altText ?? item.altText ?? ''}
                            onChange={e => setDetailItem(prev => ({ ...(prev || item), altText: e.target.value }))}
                            className="w-full border border-[#8c8f94] p-1.5 text-[12px] outline-none focus:border-[#2271b1] rounded-sm"
                            placeholder="Describe this image..."
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-[#1d2327] block mb-1">Title</label>
                          <input
                            value={detailItem?.title ?? item.title ?? ''}
                            onChange={e => setDetailItem(prev => ({ ...(prev || item), title: e.target.value }))}
                            className="w-full border border-[#8c8f94] p-1.5 text-[12px] outline-none focus:border-[#2271b1] rounded-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-[#1d2327] block mb-1">Caption</label>
                          <textarea
                            value={detailItem?.caption ?? item.caption ?? ''}
                            onChange={e => setDetailItem(prev => ({ ...(prev || item), caption: e.target.value }))}
                            rows={2}
                            className="w-full border border-[#8c8f94] p-1.5 text-[12px] outline-none focus:border-[#2271b1] rounded-sm resize-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-[#1d2327] block mb-1">File URL</label>
                          <div className="flex gap-1">
                            <input readOnly value={item.url} className="flex-1 border border-[#c3c4c7] p-1.5 text-[10px] bg-[#f6f7f7] outline-none rounded-sm truncate" />
                            <button 
                              type="button"
                              onClick={() => navigator.clipboard.writeText(item.url)} 
                              className="px-2 border border-[#c3c4c7] text-[10px] text-[#2271b1] hover:bg-[#f0f6fa] rounded-sm whitespace-nowrap"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                        {item.usageCount > 0 && (
                          <p className="text-[11px] text-[#646970] bg-[#f0f0f1] px-2 py-1.5 rounded-sm">
                            Used in <strong>{item.usageCount}</strong> place{item.usageCount !== 1 ? 's' : ''}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={saveMetadata}
                          disabled={saving}
                          className="w-full bg-[#2271b1] text-white py-1.5 text-[12px] font-semibold rounded-sm hover:bg-[#135e96] transition-colors disabled:opacity-60"
                        >
                          {saving ? "Saving..." : "Save Metadata"}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── Footer Action Bar ── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#c3c4c7] bg-[#f6f7f7] shrink-0">
          <p className="text-[12px] text-[#646970]">
            {selected.length > 0
              ? `${selected.length} item${selected.length > 1 ? 's' : ''} selected`
              : "Select an image from the library"}
          </p>
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={onClose} 
              className="px-4 py-1.5 text-[13px] text-[#646970] border border-[#c3c4c7] hover:bg-[#f0f0f1] rounded-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInsert}
              disabled={selected.length === 0}
              className="px-4 py-1.5 text-[13px] font-semibold bg-[#2271b1] text-white rounded-sm hover:bg-[#135e96] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {multiple ? `Insert ${selected.length > 0 ? selected.length : ''} Image${selected.length !== 1 ? 's' : ''}` : "Select Image"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
