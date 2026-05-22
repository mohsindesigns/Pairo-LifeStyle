"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search, LayoutGrid, List, Upload, Trash2, RotateCcw,
  X, Copy, Check, Loader2, Image as ImageIcon, AlertTriangle
} from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";

export default function AdminMedia() {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState("grid");          // grid | list
  const [tab, setTab]               = useState("library");       // library | trash
  const [search, setSearch]         = useState("");
  const [page, setPage]             = useState(1);
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

  const fetchMedia = useCallback(async (q = search, pg = page, t = tab, type = 'all', s = 'newest') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: q, page: pg, limit: 30, trash: t === "trash", type, sort: s
      });
      const res = await fetch(`/api/admin/media?${params}`);
      const data = await res.json();
      if (data.success) { setItems(data.items); setPagination(data.pagination); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, page, tab]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchMedia("", 1, tab);
      setSelected(new Set());
      setDetailItem(null);
    });
  }, [tab, fetchMedia]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setPage(1); fetchMedia(val, 1, tab); }, 400);
  };

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
      if (data.success) { await fetchMedia("", 1, "library"); setSearch(""); setPage(1); setTab("library"); }
      if (data.errors?.length) alert(data.errors.map(e => `${e.file}: ${e.error}`).join('\n'));
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
    await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
    setDetailItem(null);
    fetchMedia(search, page, tab);
  };

  const permanentDelete = async (id) => {
    const res = await fetch(`/api/admin/media/${id}?permanent=true`, { method: "DELETE" });
    const data = await res.json();
    if (data.error === "Image is still in use") {
      alert(`Cannot delete — image is used in ${data.usageCount} place(s).`);
      return;
    }
    setDetailItem(null);
    setDeleteConfirm(null);
    fetchMedia(search, page, tab);
  };

  const restore = async (id) => {
    await fetch(`/api/admin/media/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    setDetailItem(null);
    fetchMedia(search, page, tab);
  };

  const bulkSoftDelete = async () => {
    await Promise.all([...selected].map(id => fetch(`/api/admin/media/${id}`, { method: "DELETE" })));
    setSelected(new Set());
    setBulkMode(false);
    fetchMedia(search, page, tab);
  };

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AdminPageLayout 
      title="Media Library" 
      breadcrumbs={[{ label: "Media", href: "/admin/media" }, { label: tab === "trash" ? "Trash" : "Library" }]}
    >
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center border border-[#8c8f94] rounded-[3px] overflow-hidden shrink-0 shadow-sm">
            <button onClick={() => setView("grid")} className={`p-2 transition-colors ${view === "grid" ? "bg-[#1d2327] text-white" : "bg-white text-[#8c8f94] hover:bg-[#f0f0f1]"}`}><LayoutGrid className="w-4 h-4" /></button>
            <button onClick={() => setView("list")} className={`p-2 border-l border-[#8c8f94] transition-colors ${view === "list" ? "bg-[#1d2327] text-white" : "bg-white text-[#8c8f94] hover:bg-[#f0f0f1]"}`}><List className="w-4 h-4" /></button>
          </div>

          <div className="flex gap-2">
            <select 
              onChange={(e) => fetchMedia(search, 1, tab, e.target.value)}
              className="px-3 py-1.5 text-[13px] border border-[#8c8f94] bg-white outline-none focus:border-[#2271b1] rounded-[3px] shadow-sm cursor-pointer"
            >
              <option value="all">All types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
            </select>

            <select 
              onChange={(e) => fetchMedia(search, 1, tab, 'all', e.target.value)}
              className="px-3 py-1.5 text-[13px] border border-[#8c8f94] bg-white outline-none focus:border-[#2271b1] rounded-[3px] shadow-sm cursor-pointer"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="name">Sort: Name A-Z</option>
            </select>
          </div>

          <button onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); }}
            className={`px-4 py-1.5 text-[13px] font-bold border rounded-[3px] transition-all shadow-sm ${bulkMode ? "bg-[#1d2327] text-white border-[#1d2327]" : "border-[#8c8f94] text-[#2c3338] bg-white hover:bg-[#f6f7f7]"}`}>
            {bulkMode ? `Bulk Mode (${selected.size})` : "Bulk Select"}
          </button>

          {bulkMode && selected.size > 0 && (
            <button onClick={bulkSoftDelete} className="px-4 py-1.5 text-[13px] font-bold border border-[#d63638] text-[#d63638] hover:bg-red-50 rounded-[3px] transition-all shadow-sm flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Move to Trash
            </button>
          )}

          <div className="ml-auto flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c8f94] group-focus-within:text-[#2271b1]" />
              <input value={search} onChange={e => handleSearch(e.target.value)}
                placeholder="Search media..." className="pl-9 pr-3 py-1.5 border border-[#8c8f94] text-[13px] outline-none focus:border-[#2271b1] w-64 bg-white rounded-[3px] shadow-inner" />
            </div>
            
            <label className="flex items-center gap-2 px-4 py-1.5 bg-[#2271b1] text-white text-[13px] font-bold rounded-[3px] hover:bg-[#135e96] cursor-pointer transition-all shadow-sm">
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading..." : "Add New"}
              <input type="file" multiple accept="image/*" className="hidden" onChange={e => handleFiles(e.target.files)} disabled={uploading} />
            </label>
          </div>
        </div>

        {/* ── Sub-Tabs ── */}
        <div className="flex gap-4 text-[13px] border-b border-[#ccd0d4]">
          <button onClick={() => setTab("library")} className={`pb-2 px-1 font-medium transition-colors border-b-2 ${tab === "library" ? "border-[#2271b1] text-black" : "border-transparent text-[#2271b1] hover:text-[#135e96]"}`}>
            All Media ({pagination.total || 0})
          </button>
          <button onClick={() => setTab("trash")} className={`pb-2 px-1 font-medium transition-colors border-b-2 ${tab === "trash" ? "border-[#d63638] text-black" : "border-transparent text-[#2271b1] hover:text-[#135e96]"}`}>
            Trash
          </button>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="flex flex-1 gap-6 min-h-[500px]">

        {/* Left: Library Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div
            className={`flex-1 bg-white border border-[#c3c4c7] overflow-auto relative shadow-sm rounded-[2px] ${dragOver ? "ring-2 ring-[#2271b1] ring-inset" : ""}`}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
          >
            {dragOver && (
              <div className="absolute inset-0 bg-[#2271b1]/5 border-2 border-[#2271b1] border-dashed flex items-center justify-center z-10 pointer-events-none">
                <p className="text-[#2271b1] font-bold text-[16px] bg-white px-6 py-3 rounded shadow-lg border border-[#2271b1]">Drop files to upload</p>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400 font-medium">
                <Loader2 className="w-10 h-10 text-[#2271b1] animate-spin" />
                <p className="text-[14px]">Loading media...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="p-5 bg-[#f0f2f1] rounded-full">
                  <ImageIcon className="w-10 h-10 text-[#c3c4c7]" />
                </div>
                <p className="text-[14px] text-[#8c8f94] italic font-medium">{tab === "trash" ? "Trash is empty." : "No media found. Drop files here to upload."}</p>
              </div>
            ) : view === "grid" ? (
              <div className="p-2 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {items.map(item => (
                  <div key={item._id} onClick={() => handleItemClick(item)}
                    className={`relative aspect-square cursor-pointer group overflow-hidden border-[4px] transition-all rounded-[2px] ${
                      selected.has(item._id) || detailItem?._id === item._id ? "border-[#2271b1]" : "border-transparent hover:border-[#ccd0d4]"
                    }`}
                  >
                    <img 
                      src={item.url.includes('cloudinary.com') ? item.url.replace('/upload/', '/upload/w_400,h_400,c_fill,f_auto,q_auto/') : item.url} 
                      alt={item.altText || ''} 
                      className="w-full h-full object-cover bg-[#f0f2f1]" 
                    />
                    {tab === "trash" && <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center"><span className="bg-red-700 text-white text-[10px] font-bold px-2 py-1 rounded">TRASH</span></div>}
                    {(selected.has(item._id)) && (
                      <div className="absolute top-1 right-1 w-6 h-6 bg-[#2271b1] rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <table className="w-full text-[13px] border-collapse">
                <thead className="bg-[#f6f7f7] border-b border-[#c3c4c7] sticky top-0 z-10">
                  <tr>
                    {bulkMode && <th className="px-4 py-3 w-8" />}
                    <th className="px-6 py-3 text-left font-bold text-[#2c3338] text-[11px] uppercase tracking-widest">File</th>
                    <th className="px-6 py-3 text-left font-bold text-[#2c3338] text-[11px] uppercase tracking-widest">Title</th>
                    <th className="px-6 py-3 text-center font-bold text-[#2c3338] text-[11px] uppercase tracking-widest">Type</th>
                    <th className="px-6 py-3 text-right font-bold text-[#2c3338] text-[11px] uppercase tracking-widest">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f1]">
                  {items.map(item => (
                    <tr key={item._id} onClick={() => handleItemClick(item)} className={`transition-colors hover:bg-[#f6f7f7] ${detailItem?._id === item._id ? "bg-[#f0f6fa]" : ""}`}>
                      {bulkMode && (
                        <td className="px-4 py-3">
                          <input type="checkbox" className="w-4 h-4" checked={selected.has(item._id)} onChange={() => toggleSelect(item._id)} onClick={e => e.stopPropagation()} />
                        </td>
                      )}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-[#f0f2f1] border border-[#e0e0e0] overflow-hidden shrink-0 rounded">
                            <img src={item.url} alt="" className="w-full h-full object-cover" />
                          </div>
                          <span className="font-bold text-[#2271b1] hover:underline cursor-pointer truncate max-w-[200px]">{item.filename}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-gray-700 font-medium">{item.title || '—'}</td>
                      <td className="px-6 py-3 text-center text-gray-400 font-mono text-[11px]">{item.format?.toUpperCase() || 'IMG'}</td>
                      <td className="px-6 py-3 text-right text-gray-500">{item.fileSize ? `${(item.fileSize/1024).toFixed(0)} KB` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between py-4 bg-transparent text-[13px] text-[#646970]">
              <span className="font-medium">{pagination.total} items</span>
              <div className="flex items-center gap-4">
                <button disabled={page <= 1} onClick={() => { const p = page-1; setPage(p); fetchMedia(search, p, tab); }} className="px-4 py-1.5 bg-white border border-[#c3c4c7] font-bold disabled:opacity-30 hover:bg-[#f6f7f7] rounded-[3px] shadow-sm transition-all text-[#2c3338]">Previous</button>
                <span className="font-bold text-[#2c3338]">Page {page} of {pagination.pages}</span>
                <button disabled={page >= pagination.pages} onClick={() => { const p = page+1; setPage(p); fetchMedia(search, p, tab); }} className="px-4 py-1.5 bg-white border border-[#c3c4c7] font-bold disabled:opacity-30 hover:bg-[#f6f7f7] rounded-[3px] shadow-sm transition-all text-[#2c3338]">Next</button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Detail Sidebar */}
        {detailItem && (
          <div className="w-[320px] shrink-0 bg-[#f6f7f7] border border-[#c3c4c7] shadow-sm overflow-y-auto flex flex-col rounded-[2px]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#ccd0d4] bg-white">
              <h3 className="text-[12px] font-bold uppercase tracking-widest text-gray-700">Media Details</h3>
              <button onClick={() => setDetailItem(null)} className="text-gray-400 hover:text-black transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-6 flex-1">
              {/* Preview */}
              <div className="bg-white border border-[#ccd0d4] aspect-square overflow-hidden rounded-[2px] shadow-inner p-2">
                <img src={detailItem.url} alt="" className="w-full h-full object-contain" />
              </div>
              
              {/* File Info */}
              <div className="text-[11px] text-[#646970] space-y-1 bg-white p-3 border border-[#ccd0d4] rounded-[2px]">
                <p className="font-bold text-[#1d2327] text-[13px] break-all leading-tight mb-2">{detailItem.filename}</p>
                <div className="grid grid-cols-2 gap-y-1">
                  <span>Uploaded on:</span> <span className="font-bold text-gray-700">{new Date(detailItem.createdAt).toLocaleDateString()}</span>
                  {detailItem.width && <><span>Dimensions:</span> <span className="font-bold text-gray-700">{detailItem.width}×{detailItem.height} px</span></>}
                  {detailItem.fileSize && <><span>File size:</span> <span className="font-bold text-gray-700">{(detailItem.fileSize/1024).toFixed(0)} KB</span></>}
                </div>
              </div>

              {/* Editable Fields */}
              {editItem && !detailItem.isDeleted && (
                <div className="space-y-4">
                  {[
                    { key: 'altText', label: 'Alt Text', placeholder: 'Describe for accessibility...' },
                    { key: 'title', label: 'Title' },
                    { key: 'caption', label: 'Caption', type: 'textarea' },
                  ].map(field => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block">{field.label}</label>
                      {field.type === 'textarea' ? (
                        <textarea rows={3} value={editItem[field.key] || ''} onChange={e => setEditItem(p => ({...p, [field.key]: e.target.value}))}
                          className="w-full border border-[#8c8f94] p-2 text-[13px] outline-none focus:border-[#2271b1] resize-none bg-white rounded-[2px]" />
                      ) : (
                        <input value={editItem[field.key] || ''} onChange={e => setEditItem(p => ({...p, [field.key]: e.target.value}))}
                          placeholder={field.placeholder} className="w-full border border-[#8c8f94] p-2 text-[13px] outline-none focus:border-[#2271b1] bg-white rounded-[2px]" />
                      )}
                    </div>
                  ))}
                  
                  <button onClick={saveMetadata} disabled={saving}
                    className="w-full bg-[#2271b1] text-white py-2 text-[13px] font-bold hover:bg-[#135e96] transition-all disabled:opacity-60 rounded-[3px] shadow-sm">
                    {saving ? "Saving..." : "Update Metadata"}
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-[#ccd0d4] flex flex-col gap-3">
                {detailItem.isDeleted ? (
                  <>
                    <button onClick={() => restore(detailItem._id)} className="w-full flex items-center justify-center gap-2 bg-white border border-[#2271b1] text-[#2271b1] py-2 text-[13px] font-bold hover:bg-[#f0f6fa] transition-all rounded-[3px] shadow-sm">
                      <RotateCcw className="w-4 h-4" /> Restore
                    </button>
                    <button onClick={() => setDeleteConfirm(detailItem._id)} className="w-full flex items-center justify-center gap-2 bg-white border border-[#d63638] text-[#d63638] py-2 text-[13px] font-bold hover:bg-red-50 transition-all rounded-[3px] shadow-sm">
                      <Trash2 className="w-4 h-4" /> Delete Permanently
                    </button>
                  </>
                ) : (
                  <button onClick={() => softDelete(detailItem._id)} className="w-full flex items-center justify-center gap-2 bg-white border border-[#d63638] text-[#d63638] py-2 text-[13px] font-bold hover:bg-red-50 transition-all rounded-[3px] shadow-sm">
                    <Trash2 className="w-4 h-4" /> Move to Trash
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Permanent Delete Confirmation Modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white border border-[#c3c4c7] shadow-2xl p-8 max-w-sm w-full rounded-[2px] animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 mb-4 text-[#d63638]">
              <div className="p-3 bg-red-50 rounded-full">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-[18px] font-bold">Permanently Delete?</h3>
            </div>
            <p className="text-[14px] text-[#646970] mb-6 leading-relaxed font-medium">This file will be erased from Cloudinary forever. This action <span className="text-red-600 font-bold underline">cannot be undone</span>.</p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 border border-[#c3c4c7] text-[13px] font-bold hover:bg-[#f6f7f7] rounded-[3px] transition-all">Cancel</button>
              <button onClick={() => permanentDelete(deleteConfirm)} className="flex-1 py-2.5 bg-[#d63638] text-white text-[13px] font-bold hover:bg-[#b32d2e] rounded-[3px] transition-all shadow-md">Delete Forever</button>
            </div>
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}
