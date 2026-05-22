"use client";

import { useEffect, useState } from "react";
import { History, Search, Filter, Monitor, Globe, Clock, ArrowRight } from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/admin/audit-logs");
      const data = await res.json();
      if (res.ok) setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchLogs();
    });
  }, []);

  return (
    <AdminPageLayout 
      title="Security & Audit Logs" 
      breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Audit Logs" }]}
    >
      <div className="space-y-4">
        {/* Header Actions */}
        <div className="bg-white border border-[#ccd0d4] p-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
           <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c8f94]" />
              <input 
                type="text" 
                placeholder="Search by action, staff, or resource..."
                className="w-full pl-10 pr-4 py-1.5 bg-white border border-[#8c8f94] text-[13px] focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] outline-none transition-all"
              />
           </div>
           <button className="flex items-center gap-2 bg-white border border-[#ccd0d4] px-4 py-1.5 font-bold text-[13px] hover:bg-[#f6f7f7] text-[#1d2327]">
              <Filter className="w-4 h-4" /> Export Logs (CSV)
           </button>
        </div>

        {/* Logs Timeline */}
        <div className="bg-white border border-[#ccd0d4] shadow-sm">
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                 <thead>
                    <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4] text-[#1d2327]">
                       <th className="px-4 py-3 font-bold uppercase text-[11px] w-48">Timestamp</th>
                       <th className="px-4 py-3 font-bold uppercase text-[11px] w-48">Staff Member</th>
                       <th className="px-4 py-3 font-bold uppercase text-[11px]">Action / Details</th>
                       <th className="px-4 py-3 font-bold uppercase text-[11px] w-40">Identity</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-[#f0f0f1]">
                    {loading ? (
                       <tr><td colSpan={4} className="p-10 text-center italic text-gray-400">Loading audit history...</td></tr>
                    ) : logs.length === 0 ? (
                       <tr><td colSpan={4} className="p-10 text-center italic text-gray-400">No logs found in the specified period.</td></tr>
                    ) : (
                       logs.map((log) => (
                          <tr key={log._id} className="hover:bg-[#fbfbfb] transition-colors">
                             <td className="px-4 py-4">
                                <div className="flex items-center gap-2 text-[#646970]">
                                   <Clock className="w-3.5 h-3.5" />
                                   {new Date(log.timestamp).toLocaleString()}
                                </div>
                             </td>
                             <td className="px-4 py-4">
                                <div className="font-bold text-[#1d2327]">{log.staffId?.name}</div>
                                <div className="text-[11px] text-[#646970]">{log.staffId?.email}</div>
                             </td>
                             <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                   <span className={`px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider ${
                                      (log.action || '').includes('CREATE') ? 'bg-green-100 text-green-700' :
                                      (log.action || '').includes('DELETE') ? 'bg-red-100 text-red-700' :
                                      (log.action || '').includes('UPDATE') ? 'bg-blue-100 text-blue-700' :
                                      'bg-gray-100 text-gray-700'
                                   }`}>
                                      {log.action}
                                   </span>
                                   <span className="text-[#8c8f94]"><ArrowRight className="w-3 h-3" /></span>
                                   <span className="font-medium text-[#1d2327] uppercase text-[11px]">{log.resource}</span>
                                </div>
                                <p className="text-[12px] text-[#3c434a] mt-1.5 font-medium">{log.details?.message}</p>
                                {log.details?.before && (
                                   <div className="mt-2 p-2 bg-gray-50 border border-dashed border-gray-200 text-[10px] text-[#646970] rounded">
                                      Changes recorded for {log.resource} ID: {log.details.after?.id || 'N/A'}
                                   </div>
                                )}
                             </td>
                             <td className="px-4 py-4">
                                <div className="flex flex-col gap-1.5">
                                   <div className="flex items-center gap-2 text-[11px] text-[#646970]">
                                      <Globe className="w-3 h-3" /> {log.ip}
                                   </div>
                                   <div className="flex items-center gap-2 text-[11px] text-[#646970] truncate max-w-[150px]" title={log.userAgent}>
                                      <Monitor className="w-3 h-3" /> {log.userAgent}
                                   </div>
                                </div>
                             </td>
                          </tr>
                       ))
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}
