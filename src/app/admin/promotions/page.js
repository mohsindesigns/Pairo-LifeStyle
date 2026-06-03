"use client";

import React, { useEffect, useState, useCallback } from "react";
import { 
  Search, 
  Plus, 
  Tag, 
  Calendar, 
  Clock, 
  Play, 
  Pause, 
  Trash2, 
  Copy, 
  Edit, 
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Target
} from "lucide-react";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/AdminPageLayout";

export default function PromotionsDashboard() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState("all"); // all, running, paused, expired
  const [selectedIds, setSelectedIds] = useState([]);

  const fetchPromotions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promotions");
      const data = await res.json();
      if (res.ok) setPromotions(data);
    } catch (err) {
      console.error("Failed to fetch promotions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchPromotions();
    });
  }, [fetchPromotions]);

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "Active" ? "Paused" : "Active";
    try {
      const res = await fetch(`/api/admin/promotions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminStatus: newStatus })
      });
      if (res.ok) fetchPromotions();
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  const handleDuplicate = async (promo) => {
    try {
      const { _id, ...rest } = promo;
      const copy = {
        ...rest,
        title: `${promo.title} (Copy)`,
        code: promo.code ? `${promo.code}_COPY` : undefined,
        adminStatus: "Draft",
        analytics: { timesUsed: 0, totalDiscountGiven: 0, totalRevenueGenerated: 0 }
      };
      const res = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copy)
      });
      if (res.ok) fetchPromotions();
    } catch (err) {
      console.error("Duplicate failed:", err);
    }
  };

  const handleBulkAction = async () => {
     if (bulkAction === "Bulk actions" || selectedIds.length === 0) return;
     if (confirm(`Apply "${bulkAction}" to ${selectedIds.length} promotions?`)) {
        try {
           for (const id of selectedIds) {
              if (bulkAction === "Delete Permanently" || bulkAction === "Move to Trash") {
                  await fetch(`/api/admin/promotions/${id}`, { method: "DELETE" });
              } else if (bulkAction === "Duplicate") {
                  const promo = promotions.find(p => p._id === id);
                  if (promo) await handleDuplicate(promo);
              }
           }
           setSelectedIds([]);
           fetchPromotions();
        } catch (err) {
           console.error("Bulk action failed:", err);
        }
     }
  };

  const toggleSelect = (id) => {
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
     if (selectedIds.length === filteredPromotions.length) setSelectedIds([]);
     else setSelectedIds(filteredPromotions.map(p => p._id));
  };

  const filteredPromotions = promotions.filter(p => {
    const matchesSearch = p.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.code?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (view === "running") return matchesSearch && p.adminStatus === "Active";
    if (view === "paused") return matchesSearch && p.adminStatus === "Paused";
    if (view === "expired") return matchesSearch && p.adminStatus === "Expired";
    return matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Paused': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Expired': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Draft': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <AdminPageLayout 
      title="Discounts & Coupons" 
      addNewLink="/admin/promotions/new"
      addNewLabel="Create Discount"
      breadcrumbs={[{ label: "Marketing", href: "#" }, { label: "Discounts" }]}
    >
      <div className="space-y-6">
        {/* Performance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 border border-[#ccd0d4] shadow-sm rounded-sm">
                <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#646970] font-medium uppercase tracking-wider">Active Offers</span>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-[#1d2327] mt-1">
                    {promotions.filter(p => p.adminStatus === "Active").length}
                </div>
            </div>
            <div className="bg-white p-4 border border-[#ccd0d4] shadow-sm rounded-sm">
                <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#646970] font-medium uppercase tracking-wider">Total Usage</span>
                    <Tag className="w-4 h-4 text-[#2271b1]" />
                </div>
                <div className="text-2xl font-bold text-[#1d2327] mt-1">
                    {promotions.reduce((acc, p) => acc + (p.analytics?.timesUsed || 0), 0)}
                </div>
            </div>
            <div className="bg-white p-4 border border-[#ccd0d4] shadow-sm rounded-sm">
                <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#646970] font-medium uppercase tracking-wider">Discount Distributed</span>
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-2xl font-bold text-[#1d2327] mt-1">
                    ${promotions.reduce((acc, p) => acc + (p.analytics?.totalDiscountGiven || 0), 0).toFixed(0)}
                </div>
            </div>
        </div>

        {/* View Tabs */}
        <ul className="flex items-center gap-2 text-[13px] text-[#2271b1]">
           <li className={`${view === "all" ? "text-[#1d2327] font-semibold" : "cursor-pointer hover:text-[#135e96]"}`} onClick={() => setView("all")}>
              All <span className="text-[#646970] font-normal">({promotions.length})</span>
           </li>
           <span className="text-[#c3c4c7]">|</span>
           <li className={`${view === "running" ? "text-[#1d2327] font-semibold" : "cursor-pointer hover:text-[#135e96]"}`} onClick={() => setView("running")}>
              Running <span className="text-[#646970] font-normal">({promotions.filter(p => p.adminStatus === "Active").length})</span>
           </li>
           <span className="text-[#c3c4c7]">|</span>
           <li className={`${view === "paused" ? "text-[#1d2327] font-semibold" : "cursor-pointer hover:text-[#135e96]"}`} onClick={() => setView("paused")}>
              Paused <span className="text-[#646970] font-normal">({promotions.filter(p => p.adminStatus === "Paused").length})</span>
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
                placeholder="Search campaigns..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-[#8c8f94] outline-none px-3 py-1 text-[13px] flex-1 md:w-64 bg-white focus:border-[#2271b1] rounded-[3px]"
              />
              <button className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">Search</button>
           </div>
        </div>

        {/* Data Table */}
        <div className="bg-white border border-[#ccd0d4] overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse table-fixed min-w-[1000px] text-[13px]">
            <thead>
              <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4]">
                <th className="px-3 py-2 w-8 text-center"><input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === filteredPromotions.length} onChange={toggleSelectAll} /></th>
                <th className="px-3 py-2 font-bold text-[#1d2327]">Discount Name & Coupon Code</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-32">Targeting</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-32">Status</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-48">Schedule</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-32">Performance</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-28 text-center">Priority</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1]">
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400 italic">Loading campaigns...</td></tr>
              ) : filteredPromotions.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500 italic">No promotions found matching filters.</td></tr>
              ) : (
                filteredPromotions.map((p) => (
                  <tr key={p._id} className={`hover:bg-[#f6f7f7] group transition-colors ${selectedIds.includes(p._id) ? "bg-[#f0f6fa]" : ""}`}>
                    <td className="px-3 py-4 text-center align-top"><input type="checkbox" checked={selectedIds.includes(p._id)} onChange={() => toggleSelect(p._id)} /></td>
                    <td className="px-3 py-4 align-top">
                       <Link href={`/admin/promotions/${p._id}`} className="text-[#2271b1] font-bold hover:underline text-sm">{p.title}</Link>
                       <div className="mt-0.5 font-mono text-[11px] text-[#646970]">{p.code || "Automatic (No Code)"}</div>
                       <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-[#2271b1] mt-1 font-medium">
                          <Link href={`/admin/promotions/${p._id}`} className="hover:text-[#135e96]">Edit</Link>
                          <span className="text-[#c3c4c7]">|</span>
                          <button onClick={() => handleDuplicate(p)} className="hover:text-[#135e96]">Duplicate</button>
                          <span className="text-[#c3c4c7]">|</span>
                          <button onClick={() => handleToggleStatus(p._id, p.adminStatus)} className="hover:text-[#135e96]">
                            {p.adminStatus === 'Active' ? 'Pause' : 'Activate'}
                          </button>
                          <span className="text-[#c3c4c7]">|</span>
                          <button className="text-[#d63638] hover:text-[#bc0b0d]">Archive</button>
                       </div>
                    </td>
                    <td className="px-3 py-4 align-top">
                       <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${getStatusColor(p.adminStatus)}`}>
                          {p.adminStatus}
                       </span>
                    </td>
                    <td className="px-3 py-4 align-top">
                       <div className="flex items-center gap-1 text-[11px] font-medium text-gray-600 capitalize">
                          <Target className="w-3 h-3" />
                          {p.actions?.[0]?.target || 'Cart'}
                       </div>
                    </td>
                    <td className="px-3 py-4 align-top text-[#646970]">
                       <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          <span>{p.startDate ? new Date(p.startDate).toLocaleDateString() : 'Always'}</span>
                          <span>→</span>
                          <span>{p.endDate ? new Date(p.endDate).toLocaleDateString() : 'Indefinite'}</span>
                       </div>
                    </td>
                    <td className="px-3 py-4 align-top">
                       <div className="text-[11px] text-[#646970]">Used: <span className="font-bold text-[#1d2327]">{p.analytics?.timesUsed || 0}</span></div>
                       <div className="text-[11px] text-[#646970]">Saved: <span className="font-bold text-[#1d2327]">${p.analytics?.totalDiscountGiven?.toFixed(0) || 0}</span></div>
                    </td>
                    <td className="px-3 py-4 align-top text-center text-[#646970] font-bold">{p.priority || 0}</td>
                    <td className="px-3 py-4 text-right align-top">
                       <button className="p-1.5 border border-[#ccd0d4] rounded hover:bg-white inline-block">
                          <MoreVertical className="w-4 h-4 text-[#646970]" />
                       </button>
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
