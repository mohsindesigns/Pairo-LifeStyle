"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Plus, 
  FileText, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  Globe,
  Settings,
  Layout
} from "lucide-react";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { useRBAC } from "@/hooks/useRBAC";
import { toast } from "react-hot-toast";

export default function PagesManagementPage() {
  const { can } = useRBAC();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchPages = useCallback(async () => {
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
    if (!confirm("Are you sure you want to delete this page?")) return;
    
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

  const filteredPages = pages.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminPageLayout 
      title="Page Management" 
      subtitle="Create and manage dynamic pages and landing layouts across your store."
      addNewLink="/admin/pages/new"
      addNewLabel="Create Page"
    >
      <div className="space-y-6">
        {/* Action Bar */}
        <div className="bg-white border border-[#ccd0d4] p-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
           <div className="flex items-center gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#646970]" />
                <input 
                  type="text" 
                  placeholder="Search pages..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border border-[#8c8f94] outline-none pl-9 pr-3 py-1.5 text-[13px] bg-white focus:border-[#2271b1] rounded-[3px]"
                />
              </div>
           </div>
        </div>

        {/* Pages Table */}
        <div className="bg-white border border-[#ccd0d4] shadow-sm overflow-hidden">
           <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                 <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4]">
                    <th className="px-4 py-2.5 font-bold text-[#1d2327]">Page Title</th>
                    <th className="px-4 py-2.5 font-bold text-[#1d2327]">Slug</th>
                    <th className="px-4 py-2.5 font-bold text-[#1d2327]">Status</th>
                    <th className="px-4 py-2.5 font-bold text-[#1d2327]">Sections</th>
                    <th className="px-4 py-2.5 font-bold text-[#1d2327]">Last Updated</th>
                    <th className="px-4 py-2.5 font-bold text-[#1d2327] text-right">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f1]">
                 {loading ? (
                    <tr><td colSpan={6} className="p-10 text-center italic text-gray-400">Loading pages...</td></tr>
                 ) : filteredPages.length === 0 ? (
                    <tr><td colSpan={6} className="p-10 text-center italic text-gray-400">No pages found.</td></tr>
                 ) : (
                    filteredPages.map((p) => (
                       <tr key={p._id} className="hover:bg-[#f6f7f7] group transition-colors">
                          <td className="px-4 py-4">
                             <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded flex items-center justify-center ${p.isSystem ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                   {p.isSystem ? <Settings className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                </div>
                                <div className="flex flex-col">
                                   <Link href={`/admin/pages/${p._id}`} className="font-bold text-[#2271b1] hover:underline">
                                      {p.title}
                                   </Link>
                                   <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Link href={`/admin/pages/${p._id}`} className="text-[11px] text-[#2271b1] hover:text-black">Edit</Link>
                                      <span className="text-gray-300">|</span>
                                      <Link href={`/${p.slug}`} target="_blank" className="text-[11px] text-[#2271b1] hover:text-black">View</Link>
                                      {!p.isSystem && (
                                         <>
                                            <span className="text-gray-300">|</span>
                                            <button onClick={() => deletePage(p._id, p.isSystem)} className="text-[11px] text-[#d63638] hover:text-red-700">Trash</button>
                                         </>
                                      )}
                                   </div>
                                   {p.isSystem && <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tighter mt-1">System Page</span>}
                                </div>
                             </div>
                          </td>
                          <td className="px-4 py-4 font-mono text-[#646970]">{p.slug === 'home' ? '/' : `/${p.slug}`}</td>
                          <td className="px-4 py-4">
                             <select
                                value={p.status}
                                onChange={async (e) => {
                                   const newStatus = e.target.value;
                                   try {
                                      const res = await fetch(`/api/admin/pages/${p._id}`, {
                                         method: 'PUT',
                                         headers: { 'Content-Type': 'application/json' },
                                         body: JSON.stringify({ ...p, status: newStatus })
                                      });
                                      if (res.ok) {
                                         toast.success(`Page set to ${newStatus}`);
                                         fetchPages();
                                      }
                                   } catch (err) { toast.error("Update failed"); }
                                }}
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold border outline-none cursor-pointer ${
                                   p.status === 'Published' 
                                     ? 'bg-green-50 text-green-700 border-green-200' 
                                     : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                             >
                                <option value="Draft">Draft</option>
                                <option value="Published">Published</option>
                             </select>
                          </td>
                          <td className="px-4 py-4 text-[#646970] font-medium">{p.sections?.length || 0} Modules</td>
                          <td className="px-4 py-4 text-[#646970]">{new Date(p.updatedAt).toLocaleDateString()}</td>
                          <td className="px-4 py-4 text-right">
                             <div className="flex items-center justify-end gap-2">
                                <Link href={`/admin/pages/${p._id}`} className="p-1.5 text-[#646970] hover:text-[#2271b1] hover:bg-blue-50 rounded transition-colors" title="Edit Page">
                                   <FileText className="w-4 h-4" />
                                </Link>
                                <button onClick={() => deletePage(p._id, p.isSystem)} className={`p-1.5 rounded transition-colors ${p.isSystem ? 'text-gray-200 cursor-not-allowed' : 'text-[#646970] hover:text-red-600 hover:bg-red-50'}`} title="Delete" disabled={p.isSystem}>
                                   <Trash2 className="w-4 h-4" />
                                </button>
                             </div>
                          </td>
                       </tr>
                    )
)
                 )}
              </tbody>
           </table>
        </div>
      </div>
    </AdminPageLayout>
  );
}
