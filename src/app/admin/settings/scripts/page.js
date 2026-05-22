"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Plus, 
  Code2, 
  Search, 
  MoreHorizontal, 
  Play, 
  Pause, 
  Trash2, 
  Copy,
  ChevronRight,
  ShieldCheck,
  Zap,
  Globe
} from "lucide-react";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { useRBAC } from "@/hooks/useRBAC";
import { toast } from "react-hot-toast";

export default function ScriptManagementPage() {
  const { can } = useRBAC();
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchScripts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/scripts");
      const data = await res.json();
      if (res.ok) setScripts(data);
    } catch (err) {
      toast.error("Failed to load scripts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchScripts();
    });
  }, [fetchScripts]);

  const toggleStatus = async (script) => {
    try {
      const res = await fetch(`/api/admin/scripts/${script._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !script.isActive })
      });
      if (res.ok) {
        toast.success(`${script.name} ${!script.isActive ? 'activated' : 'deactivated'}`);
        fetchScripts();
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const deleteScript = async (id) => {
    if (!confirm("Are you sure you want to delete this script? This will stop tracking immediately.")) return;
    try {
      const res = await fetch(`/api/admin/scripts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Script deleted");
        fetchScripts();
      }
    } catch (err) {
      toast.error("Failed to delete script");
    }
  };

  const filteredScripts = scripts.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminPageLayout 
      title="Tracking & Script Management" 
      subtitle="Manage tracking pixels, analytics, and custom injections across the store."
      addNewLink="/admin/settings/scripts/new"
      addNewLabel="Add Script"
      breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Scripts" }]}
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <div className="bg-white border border-[#ccd0d4] p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                 <Globe className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-[11px] font-bold text-[#646970] uppercase">Active Scripts</p>
                 <p className="text-2xl font-bold text-[#1d2327]">{scripts.filter(s => s.isActive).length}</p>
              </div>
           </div>
           <div className="bg-white border border-[#ccd0d4] p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                 <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-[11px] font-bold text-[#646970] uppercase">Pending Review</p>
                 <p className="text-2xl font-bold text-[#1d2327]">0</p>
              </div>
           </div>
           <div className="bg-white border border-[#ccd0d4] p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                 <Zap className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-[11px] font-bold text-[#646970] uppercase">Avg. Load Impact</p>
                 <p className="text-2xl font-bold text-[#1d2327]">Minimal</p>
              </div>
           </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white border border-[#ccd0d4] p-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
           <div className="flex items-center gap-2">
              <select className="border border-[#8c8f94] bg-white text-[13px] px-2 py-1 rounded-[3px] outline-none">
                 <option>Bulk actions</option>
                 <option>Activate</option>
                 <option>Deactivate</option>
                 <option>Delete</option>
              </select>
              <button className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">Apply</button>
           </div>

           <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#646970]" />
                <input 
                  type="text" 
                  placeholder="Filter scripts..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border border-[#8c8f94] outline-none pl-9 pr-3 py-1.5 text-[13px] bg-white focus:border-[#2271b1] rounded-[3px] shadow-inner"
                />
              </div>
           </div>
        </div>

        {/* Script Table */}
        <div className="bg-white border border-[#ccd0d4] shadow-sm overflow-hidden">
           <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                 <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4]">
                    <th className="px-4 py-2.5 w-10 text-center"><input type="checkbox" /></th>
                    <th className="px-4 py-2.5 font-bold text-[#1d2327]">Script Name</th>
                    <th className="px-4 py-2.5 font-bold text-[#1d2327]">Type</th>
                    <th className="px-4 py-2.5 font-bold text-[#1d2327]">Location</th>
                    <th className="px-4 py-2.5 font-bold text-[#1d2327]">Status</th>
                    <th className="px-4 py-2.5 font-bold text-[#1d2327]">Priority</th>
                    <th className="px-4 py-2.5 font-bold text-[#1d2327] text-right">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f1]">
                 {loading ? (
                    <tr><td colSpan={7} className="p-10 text-center italic text-gray-400">Fetching scripts...</td></tr>
                 ) : filteredScripts.length === 0 ? (
                    <tr><td colSpan={7} className="p-10 text-center italic text-gray-400">No scripts found.</td></tr>
                 ) : (
                    filteredScripts.map((s) => (
                       <tr key={s._id} className="hover:bg-[#f6f7f7] group transition-colors">
                          <td className="px-4 py-4 text-center"><input type="checkbox" /></td>
                          <td className="px-4 py-4">
                             <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded flex items-center justify-center ${s.isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                   <Code2 className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                   <Link href={`/admin/settings/scripts/${s._id}`} className="font-bold text-[#2271b1] hover:underline">
                                      {s.name}
                                   </Link>
                                   <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all text-[11px] text-[#2271b1] mt-1 font-medium">
                                      <Link href={`/admin/settings/scripts/${s._id}`} className="hover:text-[#135e96]">Edit</Link>
                                      <span className="text-[#c3c4c7]">|</span>
                                      <button onClick={() => deleteScript(s._id)} className="text-[#d63638] hover:text-[#bc0b0d]">Delete</button>
                                   </div>
                                </div>
                             </div>
                          </td>
                          <td className="px-4 py-4 capitalize text-[#1d2327] font-medium">{s.type.replace('_', ' ')}</td>
                          <td className="px-4 py-4">
                             <span className="px-2 py-0.5 bg-[#f0f0f1] border border-[#dcdcde] text-[#50575e] text-[11px] font-bold rounded uppercase">
                                {s.location.replace('_', ' ')}
                             </span>
                          </td>
                          <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                 <button 
                                   onClick={() => toggleStatus(s)}
                                   className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                                      s.isActive ? 'bg-green-600' : 'bg-gray-300'
                                   }`}
                                 >
                                    <span 
                                       className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                          s.isActive ? 'translate-x-5' : 'translate-x-1'
                                       }`} 
                                    />
                                 </button>
                                 <span className={`text-[11px] font-bold uppercase ${s.isActive ? 'text-green-700' : 'text-gray-500'}`}>
                                    {s.isActive ? 'Active' : 'Paused'}
                                 </span>
                              </div>
                           </td>
                          <td className="px-4 py-4 font-mono text-gray-500">{s.priority}</td>
                          <td className="px-4 py-4 text-right">
                             <button className="p-1.5 text-[#646970] hover:text-[#1d2327] rounded hover:bg-gray-200 transition-colors">
                                <MoreHorizontal className="w-5 h-5" />
                             </button>
                          </td>
                       </tr>
                    ))
                 )}
              </tbody>
           </table>
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between text-[13px] text-[#646970] px-1">
           <p>Total Scripts: {scripts.length}</p>
           <p className="flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Secure Sandbox Enabled</p>
        </div>
      </div>
    </AdminPageLayout>
  );
}
