"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { ChevronDown, Search, Edit2, X, QrCode, Copy, Check, Eye, Package, FolderTree } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useSearchParams, useRouter } from "next/navigation";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { usePopup } from "@/context/PopupContext";
import ProductSelector from "@/components/admin/discounts/ProductSelector";
import CategorySelector from "@/components/admin/discounts/CategorySelector";
import CouponViewModal from "@/components/admin/discounts/CouponViewModal";

const EMPTY_FORM = {
  code: "",
  type: "percentage",
  value: "",
  minPurchase: "",
  usageLimit: "",
  unlimitedUsage: false,
  usagePerUserLimit: "1",
  unlimitedPerCustomer: false,
  startDate: "",
  endDate: "",
  isActive: true,
  firstOrderOnly: false,
  userRegistrationRequired: false,
  newsletterSubscribedOnly: false,
  specificProducts: [],
  specificCategories: [],
  maxDiscountAmount: "",
  minQuantity: "",
  excludeSaleItems: false,
  specificCustomerEmails: "",
  oneRedemptionPerDevice: false
};

function ShareCouponModal({ discount, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!discount) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/promo/${encodeURIComponent(discount.code)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-[4px] border border-[#c3c4c7] shadow-xl w-full max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[14px] font-bold text-[#1d2327] min-w-0 break-words">Share Coupon &quot;{discount.code}&quot;</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[12px] text-[#646970]">Scanning this QR code (or opening the link) automatically applies the coupon and takes the shopper to the store.</p>
        <div className="flex justify-center bg-white p-4 border border-[#ccd0d4] rounded">
          <QRCodeSVG value={link} size={180} />
        </div>
        <div className="flex items-center gap-2">
          <input readOnly value={link} className="flex-1 min-w-0 text-xs border border-[#ccd0d4] rounded-[3px] px-2.5 py-1.5 bg-[#f6f7f7] font-mono" onFocus={e => e.target.select()} />
          <button onClick={handleCopy} className="shrink-0 bg-[#2271b1] hover:bg-[#135e96] text-white text-xs font-semibold px-3 py-1.5 rounded-[3px] flex items-center gap-1.5 cursor-pointer">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CouponsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showConfirm } = usePopup();
  const [showForm, setShowForm] = useState(false);
  const [editingDiscountId, setEditingDiscountId] = useState(null);

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

  // Create/Edit Form State
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  // Quick Edit State
  const [quickEditingId, setQuickEditingId] = useState(null);
  const [quickEditData, setQuickEditData] = useState({ ...EMPTY_FORM });

  // Full View & Share Modals
  const [viewingDiscount, setViewingDiscount] = useState(null);
  const [sharingDiscount, setSharingDiscount] = useState(null);

  // Catalog Products & Categories for Dropdown Selectors
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const handleReset = () => {
    setEditingDiscountId(null);
    setFormData({ ...EMPTY_FORM });
    setShowForm(false);
  };

  const handleStartFullEdit = useCallback((discount) => {
    if (!discount) return;
    setEditingDiscountId(discount._id);

    const prodIds = Array.isArray(discount.specificProducts)
      ? discount.specificProducts.map(p => typeof p === 'object' && p?._id ? String(p._id) : String(p))
      : [];
    const catIds = Array.isArray(discount.specificCategories)
      ? discount.specificCategories.map(c => typeof c === 'object' && c?._id ? String(c._id) : String(c))
      : [];

    setFormData({
      code: discount.code || "",
      type: discount.type || "percentage",
      value: discount.value || "",
      minPurchase: discount.minPurchase || "",
      usageLimit: discount.usageLimit || "",
      unlimitedUsage: !discount.usageLimit,
      usagePerUserLimit: discount.usagePerUserLimit !== undefined && discount.usagePerUserLimit !== null ? discount.usagePerUserLimit.toString() : "",
      unlimitedPerCustomer: discount.usagePerUserLimit === undefined || discount.usagePerUserLimit === null,
      startDate: discount.startDate ? new Date(discount.startDate).toISOString().split("T")[0] : "",
      endDate: discount.endDate ? new Date(discount.endDate).toISOString().split("T")[0] : "",
      isActive: discount.isActive !== undefined ? discount.isActive : true,
      firstOrderOnly: !!discount.firstOrderOnly,
      userRegistrationRequired: !!discount.userRegistrationRequired,
      newsletterSubscribedOnly: !!discount.newsletterSubscribedOnly,
      specificProducts: prodIds,
      specificCategories: catIds,
      maxDiscountAmount: discount.maxDiscountAmount !== undefined && discount.maxDiscountAmount !== null ? discount.maxDiscountAmount.toString() : "",
      minQuantity: discount.minQuantity || "",
      excludeSaleItems: !!discount.excludeSaleItems,
      specificCustomerEmails: discount.specificCustomers ? discount.specificCustomers.map(c => typeof c === 'object' ? c.email : c).join(", ") : "",
      oneRedemptionPerDevice: !!discount.oneRedemptionPerDevice
    });

    setShowForm(true);
  }, []);

  const fetchDiscounts = useCallback(async () => {
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

  // Load catalog data
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setCatalogLoading(true);
        const [pRes, cRes] = await Promise.all([
          fetch("/api/admin/products"),
          fetch("/api/admin/categories")
        ]);
        if (!active) return;
        if (pRes.ok) {
          const pData = await pRes.json();
          setCatalogProducts(Array.isArray(pData) ? pData.filter(p => !p.isDeleted) : []);
        }
        if (cRes.ok) {
          const cData = await cRes.json();
          setCatalogCategories(Array.isArray(cData) ? cData.filter(c => !c.isDeleted) : []);
        }
      } catch (e) {
        console.error("Failed to load catalog for coupons:", e);
      } finally {
        if (active) setCatalogLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Fetch discounts on filter/search change
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const queryParams = new URLSearchParams({
          status: statusFilter,
        });
        if (searchQuery) queryParams.set("search", searchQuery);

        const res = await fetch(`/api/admin/discounts?${queryParams.toString()}`);
        if (!active) return;
        const data = await res.json();
        if (res.ok) {
          setDiscounts(data.discounts || []);
          if (data.stats) setStats(data.stats);
        } else {
          setErrorNotice(data.error || "Failed to load coupons.");
        }
      } catch (err) {
        console.error(err);
        if (active) setErrorNotice("Error connecting to server.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [statusFilter, searchQuery]);

  // Handle URL actions (?action=new or ?action=edit&id=...)
  useEffect(() => {
    const action = searchParams.get("action");
    const editId = searchParams.get("id");
    if (action === "new") {
      Promise.resolve().then(() => {
        setEditingDiscountId(null);
        setFormData({ ...EMPTY_FORM });
        setShowForm(true);
      });
    } else if (action === "edit" && editId && discounts.length > 0) {
      const target = discounts.find(d => d._id === editId);
      if (target) {
        Promise.resolve().then(() => {
          handleStartFullEdit(target);
        });
      }
    }
  }, [searchParams, discounts, handleStartFullEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorNotice("");
    setSuccessNotice("");
    try {
      const specificProducts = Array.isArray(formData.specificProducts)
        ? formData.specificProducts.map(p => typeof p === 'object' && p?._id ? String(p._id) : String(p)).filter(Boolean)
        : [];

      const specificCategories = Array.isArray(formData.specificCategories)
        ? formData.specificCategories.map(c => typeof c === 'object' && c?._id ? String(c._id) : String(c)).filter(Boolean)
        : [];

      const payload = {
        ...formData,
        specificProducts,
        specificCategories,
        usageLimit: formData.unlimitedUsage ? "" : formData.usageLimit,
        usagePerUserLimit: formData.unlimitedPerCustomer ? "" : formData.usagePerUserLimit
      };

      const url = editingDiscountId ? `/api/admin/discounts?id=${editingDiscountId}` : "/api/admin/discounts";
      const method = editingDiscountId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessNotice(
          editingDiscountId
            ? `Coupon "${data.code || formData.code}" updated successfully.`
            : `Coupon "${data.code || formData.code}" created successfully.`
        );
        handleReset();
        router.push("/admin/discounts");
        fetchDiscounts();
      } else {
        setErrorNotice(data.error || "Failed to save coupon.");
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
      const { _id, usageCount, createdAt, updatedAt, specificCustomers, redeemedFingerprints, ...rest } = discount;
      const copy = {
        ...rest,
        code: `${discount.code}_COPY_${Math.floor(Math.random() * 1000)}`,
        specificProducts: Array.isArray(discount.specificProducts) ? discount.specificProducts.map(p => typeof p === 'object' && p?._id ? String(p._id) : String(p)) : [],
        specificCategories: Array.isArray(discount.specificCategories) ? discount.specificCategories.map(c => typeof c === 'object' && c?._id ? String(c._id) : String(c)) : [],
        specificCustomerEmails: specificCustomers ? specificCustomers.map(c => typeof c === 'object' ? c.email : c).join(", ") : ""
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
    const ok = await showConfirm(`Are you sure you want to ${isPermanently ? 'permanently delete' : 'trash'} this coupon?`);
    if (!ok) return;
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
    const ok = await showConfirm(`Apply "${bulkAction}" to ${count} coupon(s)?`);
    if (ok) {
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
                const { _id, usageCount, createdAt, updatedAt, specificCustomers, redeemedFingerprints, ...rest } = d;
                const copy = {
                  ...rest,
                  code: `${d.code}_COPY_${Math.floor(Math.random() * 1000)}`,
                  specificProducts: Array.isArray(d.specificProducts) ? d.specificProducts.map(p => typeof p === 'object' && p?._id ? String(p._id) : String(p)) : [],
                  specificCategories: Array.isArray(d.specificCategories) ? d.specificCategories.map(c => typeof c === 'object' && c?._id ? String(c._id) : String(c)) : [],
                  specificCustomerEmails: specificCustomers ? specificCustomers.map(c => typeof c === 'object' ? c.email : c).join(", ") : ""
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

    const prodIds = Array.isArray(discount.specificProducts)
      ? discount.specificProducts.map(p => typeof p === 'object' && p?._id ? String(p._id) : String(p))
      : [];
    const catIds = Array.isArray(discount.specificCategories)
      ? discount.specificCategories.map(c => typeof c === 'object' && c?._id ? String(c._id) : String(c))
      : [];

    setQuickEditData({
      code: discount.code,
      type: discount.type,
      value: discount.value,
      minPurchase: discount.minPurchase || "",
      usageLimit: discount.usageLimit || "",
      unlimitedUsage: !discount.usageLimit,
      startDate: discount.startDate ? new Date(discount.startDate).toISOString().split("T")[0] : "",
      endDate: discount.endDate ? new Date(discount.endDate).toISOString().split("T")[0] : "",
      isActive: discount.isActive !== undefined ? discount.isActive : true,
      firstOrderOnly: !!discount.firstOrderOnly,
      userRegistrationRequired: !!discount.userRegistrationRequired,
      newsletterSubscribedOnly: !!discount.newsletterSubscribedOnly,
      specificProducts: prodIds,
      specificCategories: catIds,
      usagePerUserLimit: discount.usagePerUserLimit !== undefined && discount.usagePerUserLimit !== null ? discount.usagePerUserLimit.toString() : "",
      unlimitedPerCustomer: discount.usagePerUserLimit === undefined || discount.usagePerUserLimit === null,
      maxDiscountAmount: discount.maxDiscountAmount !== undefined && discount.maxDiscountAmount !== null ? discount.maxDiscountAmount.toString() : "",
      minQuantity: discount.minQuantity || "",
      excludeSaleItems: !!discount.excludeSaleItems,
      specificCustomerEmails: discount.specificCustomers ? discount.specificCustomers.map(c => typeof c === 'object' ? c.email : c).join(", ") : "",
      oneRedemptionPerDevice: !!discount.oneRedemptionPerDevice
    });
  };

  const handleQuickEditSubmit = async (id) => {
    setErrorNotice("");
    setSuccessNotice("");
    try {
      const specificProducts = Array.isArray(quickEditData.specificProducts)
        ? quickEditData.specificProducts.map(p => typeof p === 'object' && p?._id ? String(p._id) : String(p)).filter(Boolean)
        : [];

      const specificCategories = Array.isArray(quickEditData.specificCategories)
        ? quickEditData.specificCategories.map(c => typeof c === 'object' && c?._id ? String(c._id) : String(c)).filter(Boolean)
        : [];

      const payload = {
        ...quickEditData,
        specificProducts,
        specificCategories,
        usageLimit: quickEditData.unlimitedUsage ? "" : quickEditData.usageLimit,
        usagePerUserLimit: quickEditData.unlimitedPerCustomer ? "" : quickEditData.usagePerUserLimit
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
    if (d.startDate && new Date(d.startDate) > new Date()) return { label: "Scheduled", color: "text-blue-600 font-semibold" };
    if (d.endDate && new Date(d.endDate) < new Date()) return { label: "Expired", color: "text-amber-600 font-semibold" };
    return { label: "Active", color: "text-green-600 font-bold" };
  };

  const inputClass = "w-full border border-[#ccd0d4] bg-white text-xs px-2.5 py-1.5 outline-none focus:border-[#2271b1] focus:ring-0 rounded-[3px] font-medium";
  const btnClass = "bg-[#f6f7f7] border border-[#ccd0d4] hover:bg-[#f0f0f1] text-[#2c3338] text-xs font-semibold px-3 py-1.5 rounded-[3px] cursor-pointer inline-block transition-colors outline-none select-none";
  const primaryBtnClass = "bg-[#2271b1] border border-[#135e96] hover:bg-[#135e96] text-white text-xs font-semibold px-4 py-1.5 rounded-[3px] cursor-pointer inline-block transition-colors outline-none select-none";

  // ── Full Add/Edit Coupon Form Screen ──
  if (showForm) {
    const isEdit = Boolean(editingDiscountId);
    return (
      <AdminPageLayout 
        title={isEdit ? `Edit Coupon: ${formData.code || ""}` : "Add New Coupon"} 
        breadcrumbs={[
          { label: "WooCommerce", href: "/admin/orders" },
          { label: "Coupons", href: "/admin/discounts" },
          { label: isEdit ? "Edit Coupon" : "Add New" }
        ]}
      >
        {/* WordPress Notices */}
        {errorNotice && (
          <div className="bg-white border-l-4 border-l-[#d63638] p-2.5 mb-4 text-[13px] font-medium flex items-center justify-between select-none">
            <span className="text-[#d63638] min-w-0 break-words">{errorNotice}</span>
            <button onClick={() => setErrorNotice("")} className="text-gray-400 hover:text-gray-600 ml-2 shrink-0"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="w-full max-w-3xl bg-white border border-[#c3c4c7] p-4 sm:p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#ccd0d4] pb-3">
            <div>
              <h2 className="text-[16px] font-bold text-[#1d2327]">
                {isEdit ? `Edit Coupon Details` : `Create Coupon`}
              </h2>
              <p className="text-[12px] text-[#646970]">
                {isEdit ? "Update discounts, rules, and product restrictions." : "Configure code, discount values, and customer restrictions."}
              </p>
            </div>
            {isEdit && (
              <span className="text-xs font-mono font-bold px-2.5 py-1 bg-gray-100 border border-gray-300 rounded text-gray-700">
                {formData.code}
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* General Coupon Settings */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d2327]">Coupon Code <span className="text-red-500">*</span></label>
                <input 
                  required
                  placeholder="SUMMER50"
                  className={`${inputClass} font-bold tracking-wider uppercase text-[14px]`}
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                />
                <p className="text-[11px] text-[#646970] italic">The code customers enter at checkout.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Discount Type</label>
                  <select
                    className={`${inputClass} py-1.5 font-semibold text-[#2c3338]`}
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="percentage">Percentage Discount</option>
                    <option value="fixed">Fixed Cart Discount</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Coupon Amount <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder={formData.type === "percentage" ? "e.g. 20" : "e.g. 50"}
                      className={`${inputClass} pl-6 font-bold`}
                      value={formData.value}
                      onChange={(e) => setFormData({...formData, value: e.target.value})}
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                      {formData.type === "percentage" ? "%" : "$"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Minimum Purchase Spend</label>
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
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                  </div>
                  <p className="text-[11px] text-[#646970] italic">Minimum cart total required before coupon applies.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Total Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    disabled={formData.unlimitedUsage}
                    className={`${inputClass} font-medium disabled:bg-gray-100 disabled:text-gray-400`}
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({...formData, usageLimit: e.target.value})}
                  />
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2c3338] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.unlimitedUsage}
                      onChange={(e) => setFormData({...formData, unlimitedUsage: e.target.checked, usageLimit: e.target.checked ? "" : formData.usageLimit})}
                      className="rounded-sm border-gray-300"
                    />
                    <span>Unlimited Usage</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Start Date</label>
                  <input
                    type="date"
                    className={`${inputClass} py-1.5 font-medium`}
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                  <p className="text-[11px] text-[#646970] italic">Leave blank to activate immediately.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Expiry Date</label>
                  <input
                    type="date"
                    className={`${inputClass} py-1.5 font-medium`}
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                  <p className="text-[11px] text-[#646970] italic">Leave blank for no expiration.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d2327]">Coupon Status</label>
                <label className="flex items-center gap-2 text-xs font-semibold text-[#2c3338] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    className="rounded-sm border-gray-300"
                  />
                  <span>{formData.isActive ? "Active (Ready for use)" : "Inactive (Paused)"}</span>
                </label>
              </div>
            </div>

            {/* ── Product & Category Selectors (New Interactive System) ── */}
            <div className="border-t border-[#ccd0d4] pt-5 space-y-4">
              <div>
                <h3 className="text-[14px] font-bold text-[#1d2327]">Product & Category Restrictions</h3>
                <p className="text-[11px] text-[#646970] mt-0.5">
                  Select specific products or categories this coupon applies to. If left empty, it will apply to all products storewide.
                </p>
              </div>

              <ProductSelector
                selectedIds={formData.specificProducts}
                onChange={(ids) => setFormData({ ...formData, specificProducts: ids })}
                products={catalogProducts}
                loading={catalogLoading}
              />

              <CategorySelector
                selectedIds={formData.specificCategories}
                onChange={(ids) => setFormData({ ...formData, specificCategories: ids })}
                categories={catalogCategories}
                loading={catalogLoading}
              />
            </div>

            {/* Advanced Restrictions / Conditions */}
            <div className="border-t border-[#ccd0d4] pt-5 space-y-4">
              <h3 className="text-[14px] font-bold text-[#1d2327]">Usage Rules & Customer Limits</h3>

              <div className="space-y-2 select-none">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#2c3338] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.firstOrderOnly}
                    onChange={(e) => setFormData({...formData, firstOrderOnly: e.target.checked})}
                    className="rounded-sm border-gray-300"
                  />
                  <span>First Order Only (New Customers Only)</span>
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

                <label className="flex items-center gap-2 text-xs font-semibold text-[#2c3338] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.excludeSaleItems}
                    onChange={(e) => setFormData({...formData, excludeSaleItems: e.target.checked})}
                    className="rounded-sm border-gray-300"
                  />
                  <span>Exclude Sale Items (Full-price items only)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-[#2c3338] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.oneRedemptionPerDevice}
                    onChange={(e) => setFormData({...formData, oneRedemptionPerDevice: e.target.checked})}
                    className="rounded-sm border-gray-300"
                  />
                  <span>Limit to One Redemption Per Device / IP</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Usage Limit Per Customer</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    disabled={formData.unlimitedPerCustomer}
                    className={`${inputClass} font-medium disabled:bg-gray-100 disabled:text-gray-400`}
                    value={formData.usagePerUserLimit}
                    onChange={(e) => setFormData({...formData, usagePerUserLimit: e.target.value})}
                  />
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2c3338] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.unlimitedPerCustomer}
                      onChange={(e) => setFormData({...formData, unlimitedPerCustomer: e.target.checked, usagePerUserLimit: e.target.checked ? "" : (formData.usagePerUserLimit || "1")})}
                      className="rounded-sm border-gray-300"
                    />
                    <span>Unlimited Per Customer</span>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Minimum Quantity In Cart</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    className={`${inputClass} font-medium`}
                    value={formData.minQuantity}
                    onChange={(e) => setFormData({...formData, minQuantity: e.target.value})}
                  />
                  <p className="text-[11px] text-[#646970] italic">Minimum item quantity required in cart.</p>
                </div>
              </div>

              {formData.type === "percentage" && (
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#1d2327]">Max Discount Cap</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="No cap"
                      className={`${inputClass} pl-6 font-medium`}
                      value={formData.maxDiscountAmount}
                      onChange={(e) => setFormData({...formData, maxDiscountAmount: e.target.value})}
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] font-medium">$</span>
                  </div>
                  <p className="text-[11px] text-[#646970] italic">Caps percentage discounts (e.g. 20% off, up to $50 max).</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#1d2327]">Specific Customer Emails (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. jane@example.com, john@example.com"
                  className={`${inputClass} font-mono`}
                  value={formData.specificCustomerEmails}
                  onChange={(e) => setFormData({...formData, specificCustomerEmails: e.target.value})}
                />
                <p className="text-[11px] text-[#646970] italic">Restricts coupon to specific customer accounts.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-3 border-t border-[#ccd0d4] select-none">
              <button
                type="button"
                onClick={() => {
                  handleReset();
                  router.push("/admin/discounts");
                }}
                className={btnClass}
              >
                Cancel
              </button>
              <button type="submit" className={primaryBtnClass}>
                {isEdit ? "Update Coupon" : "Create Coupon"}
              </button>
            </div>
          </form>
        </div>
      </AdminPageLayout>
    );
  }

  // ── Coupons List View ──
  return (
    <AdminPageLayout 
      title="Coupons" 
      addNewLink={() => {
        setEditingDiscountId(null);
        setFormData({ ...EMPTY_FORM });
        setShowForm(true);
        router.push("/admin/discounts?action=new");
      }}
      addNewLabel="Add New"
      breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Coupons" }]}
    >
      {/* WordPress Notices */}
      {successNotice && (
        <div className="bg-white border-l-4 border-l-[#00a0d2] p-2.5 mb-4 text-[13px] font-medium flex items-center justify-between select-none">
          <span className="text-[#1d2327] min-w-0 break-words">{successNotice}</span>
          <button onClick={() => setSuccessNotice("")} className="text-gray-400 hover:text-gray-650 ml-2 shrink-0 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}
      {errorNotice && (
        <div className="bg-white border-l-4 border-l-[#d63638] p-2.5 mb-4 text-[13px] font-medium flex items-center justify-between select-none">
          <span className="text-[#d63638] min-w-0 break-words">{errorNotice}</span>
          <button onClick={() => setErrorNotice("")} className="text-gray-400 hover:text-gray-655 ml-2 shrink-0 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Subsubsub Navigation & Search */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c3c4c7] pb-2 mb-4 w-full">
        <ul className="flex flex-wrap items-center gap-1 text-[13px] text-[#2c3338] font-medium select-none">
          <li>
            <button 
              onClick={() => { setStatusFilter("All"); setSelectedIds([]); }} 
              className={`hover:text-[#2271b1] transition-colors cursor-pointer ${statusFilter === "All" ? "font-bold text-[#000]" : "text-[#2271b1]"}`}
            >
              All <span className="text-gray-400 text-xs font-normal">({stats.allCount || 0})</span>
            </button>
            <span className="text-gray-400 mx-1.5">|</span>
          </li>
          <li>
            <button 
              onClick={() => { setStatusFilter("Active"); setSelectedIds([]); }} 
              className={`hover:text-[#2271b1] transition-colors cursor-pointer ${statusFilter === "Active" ? "font-bold text-[#000]" : "text-[#2271b1]"}`}
            >
              Active <span className="text-gray-400 text-xs font-normal">({stats.activeCount || 0})</span>
            </button>
            <span className="text-gray-400 mx-1.5">|</span>
          </li>
          <li>
            <button 
              onClick={() => { setStatusFilter("Expired"); setSelectedIds([]); }} 
              className={`hover:text-[#2271b1] transition-colors cursor-pointer ${statusFilter === "Expired" ? "font-bold text-[#000]" : "text-[#2271b1]"}`}
            >
              Expired <span className="text-gray-400 text-xs font-normal">({stats.expiredCount || 0})</span>
            </button>
            <span className="text-gray-400 mx-1.5">|</span>
          </li>
          <li>
            <button 
              onClick={() => { setStatusFilter("Trash"); setSelectedIds([]); }} 
              className={`hover:text-[#2271b1] transition-colors cursor-pointer ${statusFilter === "Trash" ? "font-bold text-[#000]" : "text-[#2271b1]"}`}
            >
              Trash <span className="text-gray-400 text-xs font-normal">({stats.trashCount || 0})</span>
            </button>
          </li>
        </ul>

        {/* Search Box */}
        <form onSubmit={(e) => { e.preventDefault(); fetchDiscounts(); }} className="flex items-center gap-1.5">
          <input
            type="search"
            placeholder="Search coupons..."
            className="border border-[#8c8f94] bg-white text-xs px-2.5 py-1 outline-none focus:border-[#2271b1] rounded-[3px] w-48 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className={btnClass}>
            Search
          </button>
        </form>
      </div>

      {/* Bulk Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 select-none">
        <div className="flex items-center gap-2">
          <select 
            className="border border-[#8c8f94] bg-white text-xs px-2.5 py-1 outline-none focus:border-[#2271b1] rounded-[3px] text-[#2c3338]"
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
          >
            <option>Bulk actions</option>
            {statusFilter === "Trash" ? (
              <>
                <option>Restore</option>
                <option>Delete Permanently</option>
              </>
            ) : (
              <>
                <option>Move to Trash</option>
                <option>Duplicate</option>
              </>
            )}
          </select>
          <button 
            type="button" 
            onClick={handleBulkAction}
            disabled={selectedIds.length === 0 || bulkAction === "Bulk actions"}
            className={`${btnClass} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Apply
          </button>
        </div>

        <div className="text-xs text-[#646970]">
          {discounts.length} item{discounts.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Coupon List Table */}
      <div className="bg-white border border-[#c3c4c7] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#ccd0d4] bg-[#f6f7f7] text-[#2c3338] font-bold select-none">
                <th className="w-8 px-3 py-2.5 text-center">
                  <input 
                    type="checkbox" 
                    checked={discounts.length > 0 && selectedIds.length === discounts.length}
                    onChange={toggleSelectAll}
                    className="rounded-sm border-gray-300"
                  />
                </th>
                <th className="px-3 py-2.5">Code</th>
                <th className="hidden md:table-cell px-3 py-2.5">Coupon Type</th>
                <th className="px-3 py-2.5">Coupon Amount</th>
                <th className="hidden sm:table-cell px-3 py-2.5">Products / Scope</th>
                <th className="hidden md:table-cell px-3 py-2.5">Min Spend</th>
                <th className="px-3 py-2.5">Usage / Limit</th>
                <th className="hidden lg:table-cell px-3 py-2.5">Expiry Date</th>
                <th className="px-3 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1]">
              {loading ? (
                <tr><td colSpan={9} className="p-16 text-center italic text-gray-400 font-medium">Loading coupons database...</td></tr>
              ) : discounts.length === 0 ? (
                <tr><td colSpan={9} className="p-16 text-center italic text-gray-400 font-medium">No coupons found.</td></tr>
              ) : (
                discounts.map((d) => {
                  const isSelected = selectedIds.includes(d._id);
                  const isQuickEditing = quickEditingId === d._id;
                  const cStatus = getCouponStatus(d);
                  const prodCount = Array.isArray(d.specificProducts) ? d.specificProducts.length : 0;
                  const catCount = Array.isArray(d.specificCategories) ? d.specificCategories.length : 0;
                  
                  if (isQuickEditing) {
                    return (
                      <tr key={d._id} className="bg-[#f6f7f7] border-y-2 border-[#c3c4c7]">
                        <td colSpan={9} className="p-3 sm:p-4 align-top">
                          <div className="space-y-4">
                            <h4 className="text-[12px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-200 pb-1.5 flex items-center gap-1.5 select-none">
                              <Edit2 className="w-3.5 h-3.5 text-gray-500" /> Quick Edit Coupon: <span className="font-mono text-[#2271b1]">{d.code}</span>
                            </h4>
                            
                            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
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
                                  <option value="fixed">Fixed Cart</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Amount</label>
                                <input 
                                  type="number" 
                                  min="0.01" 
                                  step="any"
                                  className={`${inputClass} p-1 font-bold`}
                                  value={quickEditData.value}
                                  onChange={e => setQuickEditData({ ...quickEditData, value: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Min Spend ($)</label>
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
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Total Limit</label>
                                <input
                                  type="number"
                                  placeholder="Unlimited"
                                  disabled={quickEditData.unlimitedUsage}
                                  className={`${inputClass} p-1 disabled:bg-gray-100 disabled:text-gray-400`}
                                  value={quickEditData.usageLimit}
                                  onChange={e => setQuickEditData({ ...quickEditData, usageLimit: e.target.value })}
                                />
                                <label className="flex items-center gap-1 text-[10px] font-semibold text-[#2c3338] cursor-pointer select-none mt-1">
                                  <input
                                    type="checkbox"
                                    checked={quickEditData.unlimitedUsage}
                                    onChange={(e) => setQuickEditData({...quickEditData, unlimitedUsage: e.target.checked, usageLimit: e.target.checked ? "" : quickEditData.usageLimit})}
                                    className="rounded-sm border-gray-300"
                                  />
                                  <span>Unlimited</span>
                                </label>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Status</label>
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#2c3338] cursor-pointer select-none h-[26px]">
                                  <input
                                    type="checkbox"
                                    checked={quickEditData.isActive}
                                    onChange={(e) => setQuickEditData({...quickEditData, isActive: e.target.checked})}
                                    className="rounded-sm border-gray-300"
                                  />
                                  <span>{quickEditData.isActive ? "Active" : "Inactive"}</span>
                                </label>
                              </div>
                            </div>

                            {/* Dropdown Selectors inside Quick Edit */}
                            <div className="border-t border-gray-200 pt-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ProductSelector
                                  selectedIds={quickEditData.specificProducts}
                                  onChange={(ids) => setQuickEditData({ ...quickEditData, specificProducts: ids })}
                                  products={catalogProducts}
                                  loading={catalogLoading}
                                />
                                <CategorySelector
                                  selectedIds={quickEditData.specificCategories}
                                  onChange={(ids) => setQuickEditData({ ...quickEditData, specificCategories: ids })}
                                  categories={catalogCategories}
                                  loading={catalogLoading}
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap justify-end gap-1.5 select-none pt-2 border-t border-gray-200">
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
                    <tr key={d._id} className={`hover:bg-[#f6f7f7]/50 group transition-colors ${isSelected ? "bg-[#f0f6fa]" : ""} ${d.isDeleted ? "opacity-60 bg-[#f9f9f9]" : ""}`}>
                      <td className="px-3 py-3 text-center align-top">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(d._id)} className="rounded-sm border-gray-300" />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-col">
                          <span 
                            onClick={() => !d.isDeleted && handleStartFullEdit(d)} 
                            className="text-[13px] font-bold text-[#2271b1] hover:text-[#135e96] hover:underline cursor-pointer tracking-wide uppercase font-mono"
                            title="Click to edit full coupon"
                          >
                            {d.code}
                          </span>

                          {/* Row Actions */}
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-[11px] text-[#2271b1] mt-1 font-semibold select-none">
                            {d.isDeleted ? (
                              <>
                                <button onClick={() => handleRestore(d._id)} className="hover:text-[#135e96] cursor-pointer">Restore</button>
                                <span className="text-gray-300 font-normal">|</span>
                                <button onClick={() => handleDelete(d._id, true)} className="text-[#d63638] hover:text-[#bc0b0d] cursor-pointer">Delete Permanently</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => handleStartFullEdit(d)} className="hover:text-[#135e96] font-bold cursor-pointer">Edit</button>
                                <span className="text-gray-300 font-normal">|</span>
                                <button onClick={() => handleStartQuickEdit(d)} className="hover:text-[#135e96] cursor-pointer">Quick Edit</button>
                                <span className="text-gray-300 font-normal">|</span>
                                <button onClick={() => setViewingDiscount(d)} className="hover:text-[#135e96] flex items-center gap-0.5 cursor-pointer">
                                  <Eye className="w-3 h-3" />View
                                </button>
                                <span className="text-gray-300 font-normal">|</span>
                                <button onClick={() => setSharingDiscount(d)} className="hover:text-[#135e96] flex items-center gap-0.5 cursor-pointer">
                                  <QrCode className="w-3 h-3" />Share
                                </button>
                                <span className="text-gray-300 font-normal">|</span>
                                <button onClick={() => handleDuplicate(d)} className="hover:text-[#135e96] cursor-pointer">Duplicate</button>
                                <span className="text-gray-300 font-normal">|</span>
                                <button onClick={() => handleDelete(d._id)} className="text-[#d63638] hover:text-[#bc0b0d] cursor-pointer">Trash</button>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-3 py-3 align-top text-gray-600 font-medium">
                        {d.type === 'percentage' ? 'Percentage' : 'Fixed Cart'}
                      </td>
                      <td className="px-3 py-3 align-top font-semibold text-[#2c3338]">
                        {d.type === 'percentage' ? `${d.value}%` : `$${Number(d.value || 0).toFixed(2)}`}
                      </td>

                      {/* Scope / Products Badge */}
                      <td className="hidden sm:table-cell px-3 py-3 align-top text-[11px]">
                        {prodCount > 0 ? (
                          <span 
                            onClick={() => setViewingDiscount(d)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-[#2271b1] border border-blue-200 font-semibold cursor-pointer hover:bg-blue-100"
                            title="Click to view eligible products"
                          >
                            <Package className="w-3 h-3" />
                            {prodCount} Product{prodCount === 1 ? "" : "s"}
                          </span>
                        ) : catCount > 0 ? (
                          <span 
                            onClick={() => setViewingDiscount(d)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold cursor-pointer hover:bg-purple-100"
                          >
                            <FolderTree className="w-3 h-3" />
                            {catCount} Categor{catCount === 1 ? "y" : "ies"}
                          </span>
                        ) : (
                          <span className="text-gray-500 font-medium">
                            Storewide (All)
                          </span>
                        )}
                      </td>

                      <td className="hidden md:table-cell px-3 py-3 align-top font-medium text-gray-500">
                        ${Number(d.minPurchase || 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className="font-bold text-[#2c3338]">{d.usageCount || 0}</span>
                        <span className="text-gray-400"> / {d.usageLimit || "∞"}</span>
                      </td>
                      <td className="hidden lg:table-cell px-3 py-3 align-top text-gray-500 font-medium">
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

      {/* ── Modals ── */}
      {viewingDiscount && (
        <CouponViewModal
          discount={viewingDiscount}
          onClose={() => setViewingDiscount(null)}
          onEdit={(disc) => {
            setViewingDiscount(null);
            handleStartFullEdit(disc);
          }}
          onShare={(disc) => {
            setViewingDiscount(null);
            setSharingDiscount(disc);
          }}
        />
      )}

      {sharingDiscount && (
        <ShareCouponModal 
          discount={sharingDiscount} 
          onClose={() => setSharingDiscount(null)} 
        />
      )}
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
