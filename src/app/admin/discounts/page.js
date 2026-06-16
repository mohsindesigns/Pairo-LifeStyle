"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { ChevronDown, Search, Edit2, X } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import AdminPageLayout from "@/components/admin/AdminPageLayout";

function CouponsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setShowForm(searchParams.get("action") === "new");
  }, [searchParams]);

  const [discounts, setDiscounts] = useState([]);
  const [stats, setStats] = useState({ allCount: 0, activeCount: 0, expiredCount: 0, trashCount: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All"); // All, Active, Expired, Trash
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  
  // Notice Banners
  const [errorNotice, setErrorNotice] = useState("");
  const [successNotice, setSuccessNotice] = useState("");

  // Create Form State
  const [formData, setFormData] = useState({
    code: "",
    type: "percentage",
    value: "",
    minPurchase: "",
    usageLimit: "",
    endDate: "",
    firstOrderOnly: false,
    userRegistrationRequired: false,
    newsletterSubscribedOnly: false,
    specificProducts: "",
    specificCategories: "",
    usagePerUserLimit: "1"
  });

  // Quick Edit State
  const [quickEditingId, setQuickEditingId] = useState(null);
  const [quickEditData, setQuickEditData] = useState({
    code: "",
    type: "percentage",
    value: "",
    minPurchase: "",
    usageLimit: "",
    endDate: "",
    firstOrderOnly: false,
    userRegistrationRequired: false,
    newsletterSubscribedOnly: false,
    specificProducts: "",
    specificCategories: "",
    usagePerUserLimit: "1"
  });

  const fetchDiscounts = useCallback(async () => {
    setLoading(true);
    setErrorNotice("");
    try {
      const queryParams = new URLSearchParams({
        status: statusFilter,
      });
      if (searchQuery) queryParams.set("search", searchQuery);

      const res = await fetch(`/api/admin/discounts?${queryParams.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setDiscounts(data.discounts || []);
        if (data.stats) setStats(data.stats);
      } else {
        setErrorNotice(data.error || "Failed to load coupons.");
      }
    } catch (err) {
      console.error(err);
      setErrorNotice("Error connecting to server.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchDiscounts();
  }, [fetchDiscounts]);

  const handleReset = () => {
    setFormData({ 
      code: "", 
      type: "percentage", 
      value: "", 
      minPurchase: "", 
      usageLimit: "", 
      endDate: "",
      firstOrderOnly: false,
      userRegistrationRequired: false,
      newsletterSubscribedOnly: false,
      specificProducts: "",
      specificCategories: "",
      usagePerUserLimit: "1"
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorNotice("");
    setSuccessNotice("");
    try {
      const payload = {
        ...formData,
        specificProducts: formData.specificProducts
          ? formData.specificProducts.split(",").map(id => id.trim()).filter(id => id && id.length === 24)
          : [],
        specificCategories: formData.specificCategories
          ? formData.specificCategories.split(",").map(id => id.trim()).filter(id => id && id.length === 24)
          : []
      };

      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessNotice(`Coupon "${data.code}" created successfully.`);
        handleReset();
        router.push("/admin/discounts");
        fetchDiscounts();
      } else {
        setErrorNotice(data.error || "Failed to create coupon.");
      }
    } catch (err) {
      console.error(err);
      setErrorNotice("Error saving coupon.");
    }
  };

  const handleDuplicate = async (discount) => {
    setErrorNotice("");
    setSuccessNotice("");
    try {
      const { _id, usageCount, createdAt, updatedAt, ...rest } = discount;
      const copy = {
        ...rest,
        code: `${discount.code}_COPY_${Math.floor(Math.random() * 1000)}`
      };
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copy)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessNotice(`Coupon duplicated successfully as "${data.code}".`);
        fetchDiscounts();
      } else {
        setErrorNotice(data.error || "Duplicate failed.");
      }
    } catch (err) {
      console.error("Duplicate failed:", err);
      setErrorNotice("Error duplicating coupon.");
    }
  };

  const handleDelete = async (id, isPermanently = false) => {
    if (!confirm(`Are you sure you want to ${isPermanently ? 'permanently delete' : 'trash'} this coupon?`)) return;
    setErrorNotice("");
    setSuccessNotice("");
    try {
      const res = await fetch(`/api/admin/discounts?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setSuccessNotice(isPermanently ? "Coupon permanently deleted." : "Coupon moved to trash.");
        fetchDiscounts();
      } else {
        setErrorNotice(data.error || "Delete failed.");
      }
    } catch (err) {
      console.error(err);
      setErrorNotice("Error deleting coupon.");
    }
  };

  const handleRestore = async (id) => {
    setErrorNotice("");
    setSuccessNotice("");
    try {
      const res = await fetch(`/api/admin/discounts?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessNotice(`Coupon "${data.code}" restored successfully.`);
        fetchDiscounts();
      } else {
        setErrorNotice(data.error || "Restore failed.");
      }
    } catch (err) {
      console.error(err);
      setErrorNotice("Error restoring coupon.");
    }
  };

  const handleBulkAction = async () => {
    if (bulkAction === "Bulk actions" || selectedIds.length === 0) return;
    setErrorNotice("");
    setSuccessNotice("");
    
    const count = selectedIds.length;
    if (confirm(`Apply "${bulkAction}" to ${count} coupon(s)?`)) {
      try {
        let successCount = 0;
        let failCount = 0;
        let lastError = "";

        for (const id of selectedIds) {
          try {
            if (bulkAction === "Move to Trash") {
              const res = await fetch(`/api/admin/discounts?id=${id}`, { method: "DELETE" });
              if (res.ok) successCount++;
              else {
                failCount++;
                const data = await res.json();
                lastError = data.error;
              }
            } else if (bulkAction === "Delete Permanently") {
              const res = await fetch(`/api/admin/discounts?id=${id}`, { method: "DELETE" });
              if (res.ok) successCount++;
              else {
                failCount++;
                const data = await res.json();
                lastError = data.error;
              }
            } else if (bulkAction === "Restore") {
              const res = await fetch(`/api/admin/discounts?id=${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ restore: true })
              });
              if (res.ok) successCount++;
              else {
                failCount++;
                const data = await res.json();
                lastError = data.error;
              }
            } else if (bulkAction === "Duplicate") {
              const d = discounts.find(x => x._id === id);
              if (d) {
                const { _id, usageCount, createdAt, updatedAt, ...rest } = d;
                const copy = {
                  ...rest,
                  code: `${d.code}_COPY_${Math.floor(Math.random() * 1000)}`
                };
                const res = await fetch("/api/admin/discounts", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(copy)
                });
                if (res.ok) successCount++;
                else {
                  failCount++;
                  const data = await res.json();
                  lastError = data.error;
                }
              }
            }
          } catch (e) {
            failCount++;
            lastError = e.message;
          }
        }

        if (successCount > 0) {
          setSuccessNotice(`Successfully processed ${successCount} coupon(s).`);
        }
        if (failCount > 0) {
          setErrorNotice(`Failed to process ${failCount} coupon(s). Last error: ${lastError}`);
        }

        setSelectedIds([]);
        setBulkAction("Bulk actions");
        fetchDiscounts();
      } catch (err) {
        console.error("Bulk action failed:", err);
        setErrorNotice("Error running bulk actions.");
      }
    }
  };

  const handleStartQuickEdit = (discount) => {
    setQuickEditingId(discount._id);
    setQuickEditData({
      code: discount.code,
      type: discount.type,
      value: discount.value,
      minPurchase: discount.minPurchase || "",
      usageLimit: discount.usageLimit || "",
      endDate: discount.endDate ? new Date(discount.endDate).toISOString().split("T")[0] : "",
      firstOrderOnly: !!discount.firstOrderOnly,
      userRegistrationRequired: !!discount.userRegistrationRequired,
      newsletterSubscribedOnly: !!discount.newsletterSubscribedOnly,
      specificProducts: discount.specificProducts ? discount.specificProducts.join(", ") : "",
      specificCategories: discount.specificCategories ? discount.specificCategories.join(", ") : "",
      usagePerUserLimit: discount.usagePerUserLimit !== undefined && discount.usagePerUserLimit !== null ? discount.usagePerUserLimit.toString() : "1"
    });
  };

  const handleQuickEditSubmit = async (id) => {
    setErrorNotice("");
    setSuccessNotice("");
    try {
      const payload = {
        ...quickEditData,
        specificProducts: quickEditData.specificProducts
          ? quickEditData.specificProducts.split(",").map(id => id.trim()).filter(id => id && id.length === 24)
          : [],
        specificCategories: quickEditData.specificCategories
          ? quickEditData.specificCategories.split(",").map(id => id.trim()).filter(id => id && id.length === 24)
          : []
      };

      const res = await fetch(`/api/admin/discounts?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessNotice(`Coupon "${data.code}" updated successfully.`);
        setQuickEditingId(null);
        fetchDiscounts();
      } else {
        setErrorNotice(data.error || "Failed to update coupon.");
      }
    } catch (err) {
      console.error(err);
      setErrorNotice("Error updating coupon.");
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === discounts.length) setSelectedIds([]);
    else setSelectedIds(discounts.map(d => d._id));
  };

  const formatDate = (dateString) => {
    if (!dateString) return "–";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "–";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd}`;
  };

  const getCouponStatus = (d) => {
    if (d.isDeleted) return { label: "Trashed", color: "text-red-500 font-bold" };
    if (!d.isActive) return { label: "Inactive", color: "text-gray-400 font-medium" };
    if (d.endDate && new Date(d.endDate) < new Date()) return { label: "Expired", color: "text-amber-600 font-semibold" };
    return { label: "Active", color: "text-green-600 font-bold" };
  };

  const inputClass = "w-full border border-[#ccd0d4] bg-white text-xs px-2.5 py-1.5 outline-none focus:border-[#2271b1] focus:ring-0 rounded-[3px] font-medium";
  const btnClass = "bg-[#f6f7f7] border border-[#ccd0d4] hover:bg-[#f0f0f1] text-[#2c3338] text-xs font-semibold px-3 py-1.5 rounded-[3px] cursor-pointer inline-block transition-colors outline-none select-none";
  const primaryBtnClass = "bg-[#2271b1] border border-[#135e96] hover:bg-[#135e96] text-white text-xs font-semibold px-4 py-1.5 rounded-[3px] cursor-pointer inline-block transition-colors outline-none select-none";

  if (showForm) {
    return (
      <AdminPageLayout 
        title="Add New Coupon" 
        breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Coupons", href: "/admin/discounts" }, { label: "Add New" }]}
      >
        {/* WordPress Notices */}
        {errorNotice && (
          <div className="bg-white border-l-4 border-l-[#d63638] p-2.5 mb-4 text-[13px] font-medium flex items-center justify-between select-none">
            <span className="text-[#d63638]">{errorNotice}</span>
            <button onClick={() => setErrorNotice("")} className="text-gray-400 hover:text-gray-650 ml-2"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="max-w-[600px] bg-white border border-[#c3c4c7] p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#1d2327]">Coupon Code <span className="text-red-500">*</span></label>
              <input 
                required
                placeholder="SUMMER50"
                className={`${inputClass} font-bold tracking-wider uppercase`}
                value={formData.code}
                onChange={(e) => setFormData({...formData, code: e.target.value})}
              />
              <p className="text-[11px] text-[#646970] italic leading-relaxed">The code customers enter at checkout.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#1d2327]">Discount Type</label>
              <div className="relative">
                <select 
                  className={`${inputClass} appearance-none pr-8 font-medium`}
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                >
                  <option value="percentage">Percentage discount</option>
                  <option value="fixed">Fixed cart discount</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-450 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d2327]">Coupon Amount <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input 
                    type="number"
                    required
                    min="0.01"
                    step="any"
                    placeholder="0.00"
                    className={`${inputClass} pl-6 font-medium`}
                    value={formData.value}
                    onChange={(e) => setFormData({...formData, value: e.target.value})}
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] font-medium">{formData.type === 'percentage' ? '%' : '$'}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d2327]">Minimum Spend</label>
                <div className="relative">
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    className={`${inputClass} pl-6 font-medium`}
                    value={formData.minPurchase}
                    onChange={(e) => setFormData({...formData, minPurchase: e.target.value})}
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] font-medium">$</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d2327]">Usage Limit</label>
                <input 
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  className={`${inputClass} font-medium`}
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({...formData, usageLimit: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d2327]">Expiry Date</label>
                <input 
                  type="date"
                  className={`${inputClass} py-1 font-medium`}
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                />
              </div>
            </div>

            {/* Advanced Restrictions / Conditions */}
            <div className="border-t border-[#ccd0d4] pt-4 space-y-4">
              <h3 className="text-[14px] font-bold text-[#1d2327]">Usage Restrictions</h3>
              
              <div className="space-y-2 select-none">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#2c3338] cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formData.firstOrderOnly}
                    onChange={(e) => setFormData({...formData, firstOrderOnly: e.target.checked})}
                    className="rounded-sm border-gray-300"
                  />
                  <span>First Order Only</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-[#2c3338] cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formData.userRegistrationRequired}
                    onChange={(e) => setFormData({...formData, userRegistrationRequired: e.target.checked})}
                    className="rounded-sm border-gray-300"
                  />
                  <span>Require User Login / Account Registration</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-[#2c3338] cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formData.newsletterSubscribedOnly}
                    onChange={(e) => setFormData({...formData, newsletterSubscribedOnly: e.target.checked})}
                    className="rounded-sm border-gray-300"
                  />
                  <span>Newsletter Subscribers Only</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Usage Limit Per Customer</label>
                  <input 
                    type="number"
                    min="1"
                    className={`${inputClass} font-medium`}
                    value={formData.usagePerUserLimit}
                    onChange={(e) => setFormData({...formData, usagePerUserLimit: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d2327]">Specific Product IDs (Comma-separated)</label>
                <input 
                  type="text"
                  placeholder="e.g. 646a7f805a41757ef0c16922"
                  className={`${inputClass} font-mono`}
                  value={formData.specificProducts}
                  onChange={(e) => setFormData({...formData, specificProducts: e.target.value})}
                />
                <p className="text-[10px] text-[#646970] italic">Restricts the coupon to these specific product MongoDB IDs.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d2327]">Specific Category IDs (Comma-separated)</label>
                <input 
                  type="text"
                  placeholder="e.g. 646c8b905a41757ef0c16944"
                  className={`${inputClass} font-mono`}
                  value={formData.specificCategories}
                  onChange={(e) => setFormData({...formData, specificCategories: e.target.value})}
                />
                <p className="text-[10px] text-[#646970] italic">Restricts the coupon to these specific category MongoDB IDs.</p>
              </div>
            </div>

            <div className="flex gap-2 pt-2 select-none">
              <button 
                type="button" 
                onClick={() => router.push("/admin/discounts")}
                className={btnClass}
              >
                Cancel
              </button>
              <button type="submit" className={primaryBtnClass}>
                Create Coupon
              </button>
            </div>
          </form>
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout 
      title="Coupons" 
      addNewLink={() => {
        setShowForm(true);
        router.push("/admin/discounts?action=new");
      }}
      addNewLabel="Add New"
      breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Coupons" }]}
    >
      {/* WordPress Notices */}
      {successNotice && (
        <div className="bg-white border-l-4 border-l-[#00a0d2] p-2.5 mb-4 text-[13px] font-medium flex items-center justify-between select-none">
          <span className="text-[#1d2327]">{successNotice}</span>
          <button onClick={() => setSuccessNotice("")} className="text-gray-400 hover:text-gray-650 ml-2"><X className="w-4 h-4" /></button>
        </div>
      )}
      {errorNotice && (
        <div className="bg-white border-l-4 border-l-[#d63638] p-2.5 mb-4 text-[13px] font-medium flex items-center justify-between select-none">
          <span className="text-[#d63638]">{errorNotice}</span>
          <button onClick={() => setErrorNotice("")} className="text-gray-400 hover:text-gray-655 ml-2"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Subsubsub Navigation & Search */}
      <div className="flex flex-wrap items-center justify-between border-b border-[#c3c4c7] pb-2 mb-4 w-full">
        <ul className="flex flex-wrap items-center gap-1 text-[13px] text-[#2c3338] font-medium select-none">
          <li>
            <button 
              onClick={() => { setStatusFilter("All"); setSelectedIds([]); }} 
              className={`hover:text-[#2271b1] transition-colors ${statusFilter === "All" ? "font-bold text-[#000]" : "text-[#2271b1]"}`}
            >
              All <span className="text-gray-400 text-xs font-normal">({stats.allCount || 0})</span>
            </button>
            <span className="text-gray-300 ml-1.5">|</span>
          </li>
          <li>
            <button 
              onClick={() => { setStatusFilter("Active"); setSelectedIds([]); }} 
              className={`hover:text-[#2271b1] transition-colors ${statusFilter === "Active" ? "font-bold text-[#000]" : "text-[#2271b1]"}`}
            >
              Active <span className="text-gray-400 text-xs font-normal">({stats.activeCount || 0})</span>
            </button>
            <span className="text-gray-300 ml-1.5">|</span>
          </li>
          <li>
            <button 
              onClick={() => { setStatusFilter("Expired"); setSelectedIds([]); }} 
              className={`hover:text-[#2271b1] transition-colors ${statusFilter === "Expired" ? "font-bold text-[#000]" : "text-[#2271b1]"}`}
            >
              Expired <span className="text-gray-400 text-xs font-normal">({stats.expiredCount || 0})</span>
            </button>
            <span className="text-gray-300 ml-1.5">|</span>
          </li>
          <li>
            <button 
              onClick={() => { setStatusFilter("Trash"); setSelectedIds([]); }} 
              className={`hover:text-[#2271b1] transition-colors ${statusFilter === "Trash" ? "font-bold text-[#000]" : "text-[#2271b1]"}`}
            >
              Trash <span className="text-gray-400 text-xs font-normal">({stats.trashCount || 0})</span>
            </button>
          </li>
        </ul>

        {/* Search */}
        <div className="relative w-full sm:w-56 mt-2 sm:mt-0">
          <input
            type="text"
            placeholder="Search coupons..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 border border-[#ccd0d4] bg-white outline-none focus:border-[#2271b1] rounded-[3px] font-medium"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1.5" />
        </div>
      </div>

      {/* Main List View (Full Width) */}
      <div className="space-y-3 w-full">
        <div className="flex items-center gap-1.5 select-none">
          <select 
            className="border border-[#ccd0d4] bg-white text-xs px-2 py-1 outline-none text-[#2c3338] font-medium rounded-[3px] focus:border-[#2271b1]"
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
          >
            <option value="Bulk actions">Bulk actions</option>
            {statusFilter === "Trash" ? (
              <>
                <option value="Restore">Restore</option>
                <option value="Delete Permanently">Delete Permanently</option>
              </>
            ) : (
              <>
                <option value="Duplicate">Duplicate</option>
                <option value="Move to Trash">Move to Trash</option>
              </>
            )}
          </select>
          <button 
            onClick={handleBulkAction} 
            disabled={selectedIds.length === 0 || bulkAction === "Bulk actions"}
            className={`${btnClass} py-1`}
          >
            Apply
          </button>
        </div>

        <div className="bg-white border border-[#c3c4c7] overflow-hidden w-full">
          <table className="w-full text-left border-collapse table-fixed text-[13px]">
            <thead>
              <tr className="bg-[#f6f7f7] border-b border-[#c3c4c7] text-[#2c3338] font-bold select-none">
                <th className="px-3 py-2 w-10 text-center"><input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === discounts.length} onChange={toggleSelectAll} className="rounded-sm border-gray-300" /></th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-1/4">Code</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-24">Type</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-24">Amount</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-24">Min Spend</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-20">Usage</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-28">Expiry</th>
                <th className="px-3 py-2 font-bold text-[#1d2327] w-20 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1]">
              {loading ? (
                <tr><td colSpan={8} className="p-16 text-center italic text-gray-400 font-medium">Loading coupons database...</td></tr>
              ) : discounts.length === 0 ? (
                <tr><td colSpan={8} className="p-16 text-center italic text-gray-400 font-medium">No coupons found.</td></tr>
              ) : (
                discounts.map((d) => {
                  const isSelected = selectedIds.includes(d._id);
                  const isQuickEditing = quickEditingId === d._id;
                  const cStatus = getCouponStatus(d);
                  
                  if (isQuickEditing) {
                    return (
                      <tr key={d._id} className="bg-[#f6f7f7] border-y-2 border-[#c3c4c7]">
                        <td colSpan={8} className="p-3.5 align-top">
                          <div className="space-y-3">
                            <h4 className="text-[12px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-200 pb-1 flex items-center gap-1.5 select-none">
                              <Edit2 className="w-3.5 h-3.5 text-gray-505" /> Quick Edit Coupon
                            </h4>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Code</label>
                                <input 
                                  type="text" 
                                  className={`${inputClass} uppercase font-bold p-1`}
                                  value={quickEditData.code}
                                  onChange={e => setQuickEditData({ ...quickEditData, code: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Type</label>
                                  <select 
                                    className={`${inputClass} p-1`}
                                    value={quickEditData.type}
                                    onChange={e => setQuickEditData({ ...quickEditData, type: e.target.value })}
                                  >
                                    <option value="percentage">Percentage</option>
                                    <option value="fixed">Fixed amount</option>
                                  </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Amount</label>
                                <input 
                                  type="number"
                                  min="0.01"
                                  step="any"
                                  className={`${inputClass} p-1`}
                                  value={quickEditData.value}
                                  onChange={e => setQuickEditData({ ...quickEditData, value: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Min Spend</label>
                                <input 
                                  type="number" 
                                  min="0"
                                  step="any"
                                  className={`${inputClass} p-1`}
                                  value={quickEditData.minPurchase}
                                  onChange={e => setQuickEditData({ ...quickEditData, minPurchase: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Limit</label>
                                <input 
                                  type="number"
                                  placeholder="Unlimited" 
                                  className={`${inputClass} p-1`}
                                  value={quickEditData.usageLimit}
                                  onChange={e => setQuickEditData({ ...quickEditData, usageLimit: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Expiry</label>
                                <input 
                                  type="date" 
                                  className={`${inputClass} p-1`}
                                  value={quickEditData.endDate}
                                  onChange={e => setQuickEditData({ ...quickEditData, endDate: e.target.value })}
                                />
                              </div>
                            </div>

                            {/* Advanced Quick Edit Restrictions */}
                            <div className="border-t border-gray-200 pt-3 mt-1.5 space-y-2.5">
                              <div className="flex flex-wrap gap-x-6 gap-y-2 select-none">
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#2c3338] cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    checked={quickEditData.firstOrderOnly}
                                    onChange={(e) => setQuickEditData({...quickEditData, firstOrderOnly: e.target.checked})}
                                    className="rounded-sm border-gray-300"
                                  />
                                  <span>First Order Only</span>
                                </label>

                                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#2c3338] cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    checked={quickEditData.userRegistrationRequired}
                                    onChange={(e) => setQuickEditData({...quickEditData, userRegistrationRequired: e.target.checked})}
                                    className="rounded-sm border-gray-300"
                                  />
                                  <span>Require User Login</span>
                                </label>

                                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#2c3338] cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    checked={quickEditData.newsletterSubscribedOnly}
                                    onChange={(e) => setQuickEditData({...quickEditData, newsletterSubscribedOnly: e.target.checked})}
                                    className="rounded-sm border-gray-300"
                                  />
                                  <span>Newsletter Subscribers Only</span>
                                </label>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Limit Per Customer</label>
                                  <input 
                                    type="number"
                                    min="1"
                                    className={`${inputClass} p-1`}
                                    value={quickEditData.usagePerUserLimit}
                                    onChange={(e) => setQuickEditData({...quickEditData, usagePerUserLimit: e.target.value})}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Product IDs (Comma-separated)</label>
                                  <input 
                                    type="text" 
                                    className={`${inputClass} font-mono p-1`}
                                    placeholder="Comma separated IDs"
                                    value={quickEditData.specificProducts}
                                    onChange={(e) => setQuickEditData({...quickEditData, specificProducts: e.target.value})}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Category IDs (Comma-separated)</label>
                                  <input 
                                    type="text" 
                                    className={`${inputClass} font-mono p-1`}
                                    placeholder="Comma separated IDs"
                                    value={quickEditData.specificCategories}
                                    onChange={(e) => setQuickEditData({...quickEditData, specificCategories: e.target.value})}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-end gap-1.5 select-none">
                              <button 
                                type="button" 
                                onClick={() => setQuickEditingId(null)}
                                className={`${btnClass} py-1`}
                              >
                                Cancel
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleQuickEditSubmit(d._id)}
                                className={`${primaryBtnClass} py-1`}
                              >
                                Update
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={d._id} className={`hover:bg-[#f6f7f7]/40 group transition-colors ${isSelected ? "bg-[#f0f6fa]" : ""} ${d.isDeleted ? "opacity-60 bg-[#f9f9f9]" : ""}`}>
                      <td className="px-3 py-3 text-center align-top"><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(d._id)} className="rounded-sm border-gray-300" /></td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-col">
                          <span onClick={() => !d.isDeleted && handleStartQuickEdit(d)} className="text-[13px] font-bold text-[#2271b1] hover:text-[#135e96] hover:underline cursor-pointer tracking-wide uppercase">{d.code}</span>
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-[#2271b1] mt-0.5 font-semibold select-none">
                            {d.isDeleted ? (
                              <>
                                <button onClick={() => handleRestore(d._id)} className="hover:text-[#135e96]">Restore</button>
                                <span className="text-gray-350 font-normal">|</span>
                                <button onClick={() => handleDelete(d._id, true)} className="text-[#d63638] hover:text-[#bc0b0d]">Delete Permanently</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => handleStartQuickEdit(d)} className="hover:text-[#135e96]">Quick Edit</button>
                                <span className="text-gray-350 font-normal">|</span>
                                <button onClick={() => handleDuplicate(d)} className="hover:text-[#135e96]">Duplicate</button>
                                <span className="text-gray-355 font-normal">|</span>
                                <button onClick={() => handleDelete(d._id)} className="text-[#d63638] hover:text-[#bc0b0d]">Trash</button>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-gray-650 font-medium">
                        {d.type === 'percentage' ? 'Percentage' : 'Fixed Cart'}
                      </td>
                      <td className="px-3 py-3 align-top font-semibold text-[#2c3338]">
                        {d.type === 'percentage' ? `${d.value}%` : `$${d.value.toFixed(2)}`}
                      </td>
                      <td className="px-3 py-3 align-top font-medium text-gray-500">
                        ${(d.minPurchase || 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className="font-bold text-[#2c3338]">{d.usageCount || 0}</span><span className="text-gray-400"> / {d.usageLimit || "∞"}</span>
                      </td>
                      <td className="px-3 py-3 align-top text-gray-500 font-medium">
                        {formatDate(d.endDate)}
                      </td>
                      <td className={`px-3 py-3 align-top text-right text-[11px] uppercase tracking-wider ${cStatus.color}`}>
                        {cStatus.label}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageLayout>
  );
}

export default function AdminDiscounts() {
  return (
    <Suspense fallback={<div className="p-8 text-center italic text-gray-400">Loading layout...</div>}>
      <CouponsContent />
    </Suspense>
  );
}
