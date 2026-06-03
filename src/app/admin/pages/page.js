"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Plus, 
  FileText, 
  Search, 
  Settings,
  Layout,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { useRBAC } from "@/hooks/useRBAC";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function PagesManagementPage() {
  const { can } = useRBAC();
  const router = useRouter();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pages");
      const data = await res.json();
      if (res.ok) setPages(data);
    } catch (err) {
      toast.error("Failed to load pages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchPages();
    });
  }, [fetchPages]);

  const deletePage = async (id, isSystem) => {
    if (isSystem) return toast.error("System pages cannot be deleted");
    if (!confirm("Are you sure you want to move this page to trash?")) return;
    
    try {
      const res = await fetch(`/api/admin/pages/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Page deleted");
        fetchPages();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const handleDuplicate = async (page) => {
    if (page.isSystem) return toast.error("System pages cannot be duplicated");
    try {
      const { _id, createdAt, updatedAt, ...rest } = page;
      const copy = {
        ...rest,
        title: `${page.title} (Copy)`,
        slug: `${page.slug}-copy-${Math.floor(Math.random() * 1000)}`,
        status: "Draft",
        isSystem: false
      };
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copy)
      });
      if (res.ok) {
         toast.success("Page duplicated");
         fetchPages();
      }
    } catch (err) {
      console.error("Duplicate failed:", err);
      toast.error("Failed to duplicate page");
    }
  };

  const handleBulkAction = async () => {
     if (bulkAction === "Bulk actions" || selectedIds.length === 0) return;
     if (confirm(`Apply "${bulkAction}" to ${selectedIds.length} pages?`)) {
        try {
           for (const id of selectedIds) {
              const page = pages.find(p => p._id === id);
              if (page?.isSystem) continue; // Skip system pages for bulk actions
              
              if (bulkAction === "Move to Trash" || bulkAction === "Delete Permanently") {
                  await fetch(`/api/admin/pages/${id}`, { method: "DELETE" });
              } else if (bulkAction === "Duplicate") {
                  await handleDuplicate(page);
              }
           }
           setSelectedIds([]);
           fetchPages();
        } catch (err) {
           console.error("Bulk action failed:", err);
        }
     }
  };

  const toggleSelect = (id, isSystem) => {
     if (isSystem) return; // Prevent selecting system pages for bulk deletion
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
     const selectable = filteredPages.filter(p => !p.isSystem);
     if (selectedIds.length === selectable.length) setSelectedIds([]);
     else setSelectedIds(selectable.map(p => p._id));
  };

  const filteredPages = pages.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminPageLayout 
      title="Pages" 
      addNewLink="/admin/pages/new"
      addNewLabel="Add New"
    >
      <div className="space-y-4">
        {/* View Tabs */}
        <ul className="flex items-center gap-2 text-[13px] text-[#2271b1]">
           <li className="text-[#1d2327] font-semibold cursor-pointer">
              All <span className="text-[#646970] font-normal">({pages.length})</span>
           </li>
           <span className="text-[#c3c4c7]">|</span>
           <li className="cursor-pointer hover:text-[#135e96]">
              Published <span className="text-[#646970] font-normal">({pages.filter(p => p.status === 'Published').length})</span>
           </li>
        </ul>

        {/* Filter Bar */}
        <div className="bg-white border border-[#ccd0d4] p-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
           <div className="flex items-center gap-2">
              <select className="border border-[#8c8f94] bg-white text-[13px] px-2 py-1 rounded-[3px] outline-none" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
                 <option>Bulk actions</option>
                 <option>Duplicate</option>
                 <option>Move to Trash</option>
                 <option>Delete Permanently</option>
              </select>
              <button onClick={handleBulkAction} className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">Apply</button>
           </div>
           <div className="flex items-center gap-2 w-full md:w-auto">
              <input 
                type="text" 
                placeholder="Search pages..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-[#8c8f94] outline-none px-3 py-1 text-[13px] flex-1 md:w-64 bg-white focus:border-[#2271b1] rounded-[3px]"
              />
              <button className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">Search Pages</button>
           </div>
        </div>

        {/* WP Data Table */}
        <div className="bg-white border border-[#ccd0d4] overflow-x-auto shadow-sm">
           <table className="w-full text-left border-collapse text-[13px] min-w-[800px]">
              <thead>
                 <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4]">
                    <th className="px-3 py-2 w-8 text-center"><input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === filteredPages.filter(p => !p.isSystem).length} onChange={toggleSelectAll} /></th>
                    <th className="px-3 py-2 font-bold text-[#1d2327]">Title</th>
                    <th className="px-3 py-2 font-bold text-[#1d2327]">Author</th>
                    <th className="px-3 py-2 font-bold text-[#1d2327]">Date</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f1]">
                 {loading ? (
                    <tr><td colSpan={4} className="p-8 text-center italic text-gray-400">Loading pages...</td></tr>
                 ) : filteredPages.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center italic text-gray-400">No pages found.</td></tr>
                 ) : (
                    filteredPages.map((p) => (
                       <tr key={p._id} className={`hover:bg-[#f6f7f7] group transition-colors ${selectedIds.includes(p._id) ? "bg-[#f0f6fa]" : ""}`}>
                          <td className="px-3 py-4 text-center align-top">
                             <input type="checkbox" checked={selectedIds.includes(p._id)} onChange={() => toggleSelect(p._id, p.isSystem)} disabled={p.isSystem} className={p.isSystem ? 'opacity-30 cursor-not-allowed' : ''} />
                          </td>
                          <td className="px-3 py-4 align-top">
                             <div className="flex items-center gap-2 mb-1">
                                <Link href={`/admin/pages/${p._id}`} className="font-bold text-[#2271b1] hover:underline text-[14px]">
                                   {p.title}
                                </Link>
                                {p.status === 'Draft' && <span className="text-[#1d2327] font-bold">— Draft</span>}
                                {p.isSystem && <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-tight">System Page</span>}
                             </div>
                             
                             <div className="flex flex-wrap items-center gap-x-2 gap-y-1 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-[#2271b1] font-medium">
                                <Link href={`/admin/pages/${p._id}`} className="hover:text-[#135e96]">Edit</Link>
                                {!p.isSystem && (
                                   <>
                                      <span className="text-[#c3c4c7]">|</span>
                                      <button onClick={() => handleDuplicate(p)} className="hover:text-[#135e96]">Duplicate</button>
                                      <span className="text-[#c3c4c7]">|</span>
                                      <button onClick={() => deletePage(p._id, p.isSystem)} className="text-[#d63638] hover:text-[#bc0b0d]">Trash</button>
                                   </>
                                )}
                                <span className="text-[#c3c4c7]">|</span>
                                <Link href={p.slug === 'home' ? '/' : `/${p.slug}`} target="_blank" className="hover:text-[#135e96]">View</Link>
                             </div>
                          </td>
                          <td className="px-3 py-4 align-top text-[#2271b1] hover:underline cursor-pointer">
                             Admin
                          </td>
                          <td className="px-3 py-4 align-top text-[#646970]">
                             {p.status === 'Published' ? 'Published' : 'Last Modified'}<br />
                             {new Date(p.updatedAt).toLocaleDateString()}
                          </td>
                       </tr>
                    ))
                 )}
              </tbody>
           </table>
        </div>
      </div>
    </AdminPageLayout>
  );
}
