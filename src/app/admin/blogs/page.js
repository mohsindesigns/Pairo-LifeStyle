"use client";

import React, { useEffect, useState } from "react";
import { 
  Plus, 
  Image as ImageIcon,
  ChevronDown,
  Edit,
  Trash2,
  ExternalLink,
  Check,
  FileText,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/AdminPageLayout";

export default function AdminBlogs() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState("all"); 
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  const [counts, setCounts] = useState({ all: 0, published: 0, trash: 0 });

  const fetchBlogs = async () => {
    setLoading(true);
    try {
      let url = "/api/admin/blogs";
      if (view === "trash") url += "?isDeleted=true";
      else if (view === "published") url += "?status=Published";
      
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
         const list = Array.isArray(data) ? data : [];
         setBlogs(list);
         if (view === "all") {
            const all = list.length;
            const published = list.filter(b => b.status === "Published").length;
            setCounts(prev => ({ ...prev, all, published }));
         }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchBlogs();
    });
  }, [view]);

  const handleTrash = async (id) => {
    if (!confirm("Move to trash?")) return;
    try {
      const res = await fetch(`/api/admin/blogs?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchBlogs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkAction = async () => {
     if (bulkAction === "Bulk actions" || selectedIds.length === 0) return;
     if (confirm(`Apply to ${selectedIds.length} items?`)) {
        try {
           for (const id of selectedIds) {
              if (bulkAction === "Move to Trash") {
                 await fetch(`/api/admin/blogs?id=${id}`, { method: "DELETE" });
              }
           }
           setSelectedIds([]);
           fetchBlogs();
        } catch (err) {
           console.error(err);
        }
     }
  };

  const toggleSelect = (id) => {
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const filteredBlogs = blogs.filter(b => 
     b.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminPageLayout 
      title="Blog" 
      addNewLink="/admin/blogs/new"
      addNewLabel="Add New"
      breadcrumbs={[{ label: "Blog", href: "/admin/blogs" }, { label: "All Posts" }]}
    >
      <div className="space-y-4">
        {/* View Tabs */}
        <ul className="flex items-center gap-2 text-[13px] text-[#2271b1]">
           <li className={`${view === "all" ? "text-[#1d2327] font-semibold" : "cursor-pointer hover:text-[#135e96]"}`} onClick={() => setView("all")}>
              All <span className="text-[#646970] font-normal">({counts.all})</span>
           </li>
           <span className="text-[#c3c4c7]">|</span>
           <li className={`${view === "published" ? "text-[#1d2327] font-semibold" : "cursor-pointer hover:text-[#135e96]"}`} onClick={() => setView("published")}>
              Published <span className="text-[#646970] font-normal">({counts.published})</span>
           </li>
           <span className="text-[#c3c4c7]">|</span>
           <li className={`${view === "trash" ? "text-[#1d2327] font-semibold" : "cursor-pointer hover:text-[#135e96]"}`} onClick={() => setView("trash")}>
              Trash <span className="text-[#646970] font-normal">({view === "trash" ? blogs.length : "-"})</span>
           </li>
        </ul>

        {/* Filter Bar */}
        <div className="bg-white border border-[#ccd0d4] p-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
           <div className="flex items-center gap-2">
              <select className="border border-[#8c8f94] bg-white text-[13px] px-2 py-1 rounded-[3px] outline-none" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
                 <option>Bulk actions</option>
                 <option>Move to Trash</option>
              </select>
              <button onClick={handleBulkAction} className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">Apply</button>
           </div>

           <div className="flex items-center gap-2 w-full md:w-auto">
              <input 
                type="text" 
                placeholder="Search blog..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-[#8c8f94] outline-none px-3 py-1 text-[13px] flex-1 md:w-48 bg-white focus:border-[#2271b1] rounded-[3px]"
              />
              <button className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">Search Blog</button>
           </div>
        </div>

        {/* Data Table */}
        <div className="bg-white border border-[#ccd0d4] overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse table-fixed min-w-[900px] text-[13px]">
            <thead>
              <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4]">
                <th className="px-3 py-2 w-8 text-center"><input type="checkbox" /></th>
                <th className="px-3 py-2 font-bold text-[#1d2327]">Title</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-32">Author</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-40">Categories</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-24 text-center">Status</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-32">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1]">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Loading articles...</td></tr>
              ) : filteredBlogs.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500 italic">No posts found.</td></tr>
              ) : (
                filteredBlogs.map((b) => (
                  <tr key={b._id} className={`hover:bg-[#f6f7f7] group transition-colors ${selectedIds.includes(b._id) ? "bg-[#f0f6fa]" : ""}`}>
                    <td className="px-3 py-4 text-center align-top"><input type="checkbox" checked={selectedIds.includes(b._id)} onChange={() => toggleSelect(b._id)} /></td>
                    <td className="px-3 py-4 align-top">
                      <div className="flex items-start gap-3">
                         <div className="w-10 h-10 bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center text-gray-300 rounded-[2px]">
                            {b.image ? <img src={b.image} className="w-full h-full object-cover" /> : <FileText className="w-5 h-5" />}
                         </div>
                         <div className="flex flex-col">
                            <Link href={`/admin/blogs/${b._id}`} className="text-[#2271b1] font-bold hover:underline">{b.title}</Link>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-[#2271b1] mt-1 font-medium">
                               <Link href={`/admin/blogs/${b._id}`} className="hover:text-[#135e96]">Edit</Link>
                               <span className="text-[#c3c4c7]">|</span>
                               <button onClick={() => handleTrash(b._id)} className="text-[#d63638] hover:text-[#bc0b0d]">Trash</button>
                               <span className="text-[#c3c4c7]">|</span>
                               <Link href={`/blog/${b.slug}`} target="_blank" className="hover:text-[#135e96]">View</Link>
                            </div>
                         </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 align-top text-[#2271b1]">Admin</td>
                    <td className="px-3 py-4 align-top text-[#2271b1] font-medium">{b.category || "Uncategorized"}</td>
                    <td className="px-3 py-4 align-top text-center">
                       <button 
                          onClick={async () => {
                             const newStatus = b.status === 'Published' ? 'Draft' : 'Published';
                             await fetch(`/api/admin/blogs`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: b._id, status: newStatus })
                             });
                             fetchBlogs();
                          }}
                          className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase transition-colors ${b.status === 'Published' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                       >
                          {b.status}
                       </button>
                    </td>
                    <td className="px-3 py-4 align-top text-[#646970]">
                       {new Date(b.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-[13px] text-[#646970]">
           <div>{filteredBlogs.length} items</div>
           <div className="flex items-center gap-1">
              <button className="p-1 border border-[#ccd0d4] bg-white rounded disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-3">1 of 1</span>
              <button className="p-1 border border-[#ccd0d4] bg-white rounded disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
           </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}
