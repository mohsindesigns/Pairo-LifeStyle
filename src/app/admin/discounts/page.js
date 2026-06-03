"use client";

import React, { useEffect, useState } from "react";
import { Tag, Plus, Trash2, Edit, ChevronDown, CheckCircle2, Ticket } from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";

export default function AdminDiscounts() {
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  
  const [formData, setFormData] = useState({
    code: "",
    type: "percentage",
    value: "",
    usageLimit: "",
  });

  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/discounts");
      const data = await res.json();
      if (res.ok) setDiscounts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
     setFormData({ code: "", type: "percentage", value: "", usageLimit: "" });
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchDiscounts();
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        handleReset();
        fetchDiscounts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDuplicate = async (discount) => {
    try {
      const { _id, ...rest } = discount;
      const copy = {
        ...rest,
        code: `${discount.code}_COPY_${Math.floor(Math.random() * 1000)}`
      };
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copy)
      });
      if (res.ok) fetchDiscounts();
    } catch (err) {
      console.error("Duplicate failed:", err);
    }
  };

  const handleDelete = async (id) => {
     if (!confirm("Are you sure?")) return;
     try {
        const res = await fetch(`/api/admin/discounts?id=${id}`, { method: "DELETE" });
        if (res.ok) fetchDiscounts();
     } catch (err) {
        console.error(err);
     }
  };

  const handleBulkAction = async () => {
     if (bulkAction === "Bulk actions" || selectedIds.length === 0) return;
     if (confirm(`Apply "${bulkAction}" to ${selectedIds.length} coupons?`)) {
        try {
           for (const id of selectedIds) {
              if (bulkAction === "Move to Trash" || bulkAction === "Delete Permanently") {
                  await fetch(`/api/admin/discounts?id=${id}`, { method: "DELETE" });
              } else if (bulkAction === "Duplicate") {
                  const d = discounts.find(x => x._id === id);
                  if (d) await handleDuplicate(d);
              }
           }
           setSelectedIds([]);
           fetchDiscounts();
        } catch (err) {
           console.error("Bulk action failed:", err);
        }
     }
  };

  const toggleSelect = (id) => {
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
     if (selectedIds.length === discounts.length) setSelectedIds([]);
     else setSelectedIds(discounts.map(d => d._id));
  };

  return (
    <AdminPageLayout 
      title="Coupons" 
      breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Coupons" }]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* Left: Add New Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/50 p-0">
            <h2 className="text-[14px] font-bold text-[#1d2327] mb-4">Add New Coupon</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-[#1d2327]">Coupon Code</label>
                <input 
                  required
                  placeholder="e.g. SUMMER50"
                  className="w-full border border-[#8c8f94] focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] outline-none p-1.5 text-[14px] uppercase bg-white rounded-[3px] shadow-sm font-bold tracking-wider"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                />
                <p className="text-[11px] text-[#646970] italic leading-relaxed">The code customers enter at checkout.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-[#1d2327]">Discount Type</label>
                  <div className="relative">
                     <select 
                        className="appearance-none w-full border border-[#8c8f94] focus:border-[#2271b1] outline-none p-1.5 pr-8 text-[14px] bg-white rounded-[3px] shadow-sm"
                        value={formData.type}
                        onChange={(e) => setFormData({...formData, type: e.target.value})}
                     >
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed amount</option>
                     </select>
                     <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-[#1d2327]">Amount</label>
                  <div className="relative">
                     <input 
                        type="number"
                        required
                        className="w-full border border-[#8c8f94] focus:border-[#2271b1] outline-none p-1.5 pl-5 text-[14px] bg-white rounded-[3px] shadow-sm"
                        value={formData.value}
                        onChange={(e) => setFormData({...formData, value: e.target.value})}
                     />
                     <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-[12px]">{formData.type === 'percentage' ? '%' : '$'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-[#1d2327]">Usage Limit</label>
                <input 
                  type="number"
                  placeholder="Unlimited"
                  className="w-full border border-[#8c8f94] focus:border-[#2271b1] outline-none p-1.5 text-[14px] bg-white rounded-[3px] shadow-sm"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({...formData, usageLimit: e.target.value})}
                />
              </div>

              <button className="bg-[#2271b1] text-white px-5 py-2 rounded-[3px] text-[13px] font-bold hover:bg-[#135e96] transition-all shadow-sm">
                Add New Coupon
              </button>
            </form>
          </div>
        </div>

        {/* Right: List Table */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-2">
             <select 
               className="border border-[#8c8f94] bg-white text-[13px] px-2 py-1 rounded-[3px] outline-none shadow-sm"
               value={bulkAction}
               onChange={(e) => setBulkAction(e.target.value)}
             >
                <option>Bulk actions</option>
                <option>Duplicate</option>
                <option>Move to Trash</option>
                <option>Delete Permanently</option>
             </select>
             <button onClick={handleBulkAction} className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1] shadow-sm">Apply</button>
          </div>

          <div className="bg-white border border-[#c3c4c7] shadow-sm">
            <table className="w-full text-left border-collapse table-fixed text-[13px]">
              <thead>
                <tr className="bg-[#f6f7f7] border-b border-[#c3c4c7]">
                  <th className="px-3 py-2 w-8 text-center"><input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === discounts.length} onChange={toggleSelectAll} /></th>
                  <th className="px-3 py-2 w-10 text-center text-[#8c8f94]"><Ticket className="w-4 h-4 mx-auto" /></th>
                  <th className="px-3 py-2 font-bold text-[#1d2327]">Code</th>
                  <th className="px-3 py-2 font-bold text-[#1d2327]">Amount</th>
                  <th className="px-3 py-2 font-bold text-[#1d2327] w-32">Usage</th>
                  <th className="px-3 py-2 font-bold text-[#1d2327] w-24 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f1]">
                {loading ? (
                  <tr><td colSpan={6} className="p-10 text-center italic text-gray-400">Loading...</td></tr>
                ) : discounts.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center italic text-gray-400">No coupons found.</td></tr>
                ) : (
                  discounts.map((d) => (
                    <tr key={d._id} className={`hover:bg-[#f6f7f7] group transition-colors ${selectedIds.includes(d._id) ? "bg-[#f0f6fa]" : ""}`}>
                      <td className="px-3 py-4 text-center align-top"><input type="checkbox" checked={selectedIds.includes(d._id)} onChange={() => toggleSelect(d._id)} /></td>
                      <td className="px-3 py-4 text-center align-top"><Ticket className="w-4 h-4 mx-auto text-gray-300" /></td>
                      <td className="px-3 py-4 align-top">
                        <div className="flex flex-col">
                           <span className="text-[14px] font-bold text-[#2271b1] hover:underline cursor-pointer">{d.code}</span>
                           <div className="flex flex-wrap items-center gap-x-2 gap-y-1 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-[#2271b1] mt-1 font-medium">
                              <button className="hover:text-[#135e96]">Edit</button>
                              <span className="text-[#c3c4c7]">|</span>
                              <button onClick={() => handleDuplicate(d)} className="hover:text-[#135e96]">Duplicate</button>
                              <span className="text-[#c3c4c7]">|</span>
                              <button onClick={() => handleDelete(d._id)} className="text-[#d63638] hover:text-[#bc0b0d]">Trash</button>
                           </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 align-top font-medium text-[#3c434a]">
                        {d.type === 'percentage' ? `${d.value}% Off` : `$${d.value.toFixed(2)} Off`}
                      </td>
                      <td className="px-3 py-4 align-top">
                        <span className="font-bold">{d.usageCount || 0}</span> / <span className="text-gray-400">{d.usageLimit || "∞"}</span>
                      </td>
                      <td className="px-3 py-4 align-top text-right text-[#00a32a] font-bold uppercase text-[10px]">Active</td>
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
