"use client";

import React, { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { X, Copy, Check, CreditCard, AlertTriangle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useSearchParams, useRouter } from "next/navigation";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import ProductSelector from "@/components/admin/discounts/ProductSelector";
import CategorySelector from "@/components/admin/discounts/CategorySelector";
import CouponViewModal from "@/components/admin/discounts/CouponViewModal";
import { Page, PageHeader, Postbox, Notice } from "@/components/admin/ui";
import { deriveCustomerEmailsString, buildDuplicatePayload, isValidUsageLimitInput } from "@/components/admin/discounts/couponUtils";

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
  const [copyError, setCopyError] = useState("");
  if (!discount) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/promo/${encodeURIComponent(discount.code)}`;

  const handleCopy = async () => {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setCopyError("Could not copy the link. Select it and copy it manually.");
    }
  };

  return (
    <div className="wp-modal-backdrop" style={{ zIndex: 9999 }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-coupon-title"
        className="wp-modal"
        style={{ maxWidth: 420 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="wp-modal-head" style={{ gap: 8 }}>
          <h2 id="share-coupon-title" style={{ minWidth: 0, overflowWrap: "anywhere" }}>Share coupon &ldquo;{discount.code}&rdquo;</h2>
          <button type="button" onClick={onClose} className="wp-notice-dismiss shrink-0 min-h-10 min-w-10 items-center justify-center" aria-label="Close"><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>
        <div className="wp-modal-body">
          <p className="wp-muted" style={{ margin: "0 0 12px" }}>Scanning this QR code (or opening the link) automatically applies the coupon and takes the shopper to the store.</p>
          <div className="flex justify-center" style={{ padding: 16, border: "1px solid #dcdcde", background: "#fff", marginBottom: 12 }}>
            <QRCodeSVG value={link} size={180} />
          </div>
          <label htmlFor="share-coupon-link" className="wp-label">Share link</label>
          <div className="flex items-center gap-1.5">
            <input id="share-coupon-link" readOnly value={link} className="wp-input flex-1 min-w-0" style={{ background: "#f6f7f7" }} onFocus={e => e.target.select()} />
            <button type="button" onClick={handleCopy} className="wp-btn wp-btn-primary shrink-0">
              {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {copyError && (
            <p role="alert" className="wp-desc" style={{ color: "#b32d2e", margin: "6px 0 0" }}>{copyError}</p>
          )}
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
  // searchInput = what's typed; searchQuery = the applied search the list is fetched with.
  const [searchInput, setSearchInput] = useState("");
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
      value: discount.value ?? "",
      minPurchase: discount.minPurchase ?? "",
      usageLimit: discount.usageLimit ?? "",
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
      minQuantity: discount.minQuantity ?? "",
      excludeSaleItems: !!discount.excludeSaleItems,
      specificCustomerEmails: deriveCustomerEmailsString(discount),
      oneRedemptionPerDevice: !!discount.oneRedemptionPerDevice
    });

    setShowForm(true);
  }, []);

  // Only the latest list request may update state: each fetch aborts the previous one,
  // so slow responses for an older search/filter can't overwrite newer results.
  const listAbortRef = useRef(null);
  const fetchDiscounts = useCallback(async () => {
    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;
    setErrorNotice("");
    try {
      const queryParams = new URLSearchParams({
        status: statusFilter,
      });
      if (searchQuery) queryParams.set("search", searchQuery);

      const res = await fetch(`/api/admin/discounts?${queryParams.toString()}`, { signal: controller.signal });
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (res.ok) {
        const list = data.discounts || [];
        setDiscounts(list);
        // Keep the selection limited to rows that are still visible.
        const visible = new Set(list.map(d => d._id));
        setSelectedIds(prev => prev.filter(id => visible.has(id)));
        if (data.stats) setStats(data.stats);
      } else {
        setErrorNotice(data.error || "Failed to load coupons.");
      }
    } catch (err) {
      if (controller.signal.aborted || err?.name === "AbortError") return;
      console.error(err);
      setErrorNotice("Error connecting to server.");
    } finally {
      if (listAbortRef.current === controller) setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  // Applies a search term now (Search button / Enter) and clears the selection.
  const applySearch = (term) => {
    setSelectedIds([]);
    if (term === searchQuery) fetchDiscounts();
    else setSearchQuery(term);
  };

  // Live search: apply the typed term after the user pauses typing (~350ms).
  useEffect(() => {
    if (searchInput === searchQuery) return;
    const t = setTimeout(() => {
      setSelectedIds([]);
      setSearchQuery(searchInput);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput, searchQuery]);

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
    Promise.resolve().then(fetchDiscounts);
    return () => listAbortRef.current?.abort();
  }, [fetchDiscounts]);

  // Handle URL actions (?action=new or ?action=edit&id=...) once per URL action, then
  // drop the query param so later list refreshes don't re-open / reset the form.
  const handledUrlActionRef = useRef(null);
  useEffect(() => {
    const action = searchParams.get("action");
    const editId = searchParams.get("id");
    if (!action) {
      handledUrlActionRef.current = null;
      return;
    }
    const key = `${action}:${editId || ""}`;
    if (handledUrlActionRef.current === key) return;
    if (action === "new") {
      handledUrlActionRef.current = key;
      Promise.resolve().then(() => {
        setEditingDiscountId(null);
        setFormData({ ...EMPTY_FORM });
        setShowForm(true);
      });
      router.replace("/admin/discounts");
    } else if (action === "edit" && editId && discounts.length > 0) {
      const target = discounts.find(d => d._id === editId);
      if (target) {
        handledUrlActionRef.current = key;
        Promise.resolve().then(() => {
          handleStartFullEdit(target);
        });
        router.replace("/admin/discounts");
      }
    }
  }, [searchParams, discounts, handleStartFullEdit, router]);

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
        setSuccessNotice(`Coupon "${data.code}" ${editingDiscountId ? "updated" : "created"} successfully.`);
        if (data.stripeSyncStatus === "error") {
          setErrorNotice(`Stripe sync failed: ${data.stripeSyncError || "unknown error"}`);
        }
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
      // Only editable fields; the copy is inactive and the server picks a unique CODE-COPY code.
      const copy = buildDuplicatePayload(discount);
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copy)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessNotice(`Coupon duplicated successfully as "${data.code}".`);
        if (data.stripeSyncStatus === "error") {
          setErrorNotice(`Stripe sync failed: ${data.stripeSyncError || "unknown error"}`);
        }
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
        if (data.stripeSyncStatus === "error") {
          setErrorNotice(`Stripe sync failed: ${data.stripeSyncError || "unknown error"}`);
        }
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
                const copy = buildDuplicatePayload(d);
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
      value: discount.value ?? "",
      minPurchase: discount.minPurchase ?? "",
      usageLimit: discount.usageLimit ?? "",
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
      minQuantity: discount.minQuantity ?? "",
      excludeSaleItems: !!discount.excludeSaleItems,
      specificCustomerEmails: deriveCustomerEmailsString(discount),
      oneRedemptionPerDevice: !!discount.oneRedemptionPerDevice
    });
  };

  const handleQuickEditSubmit = async (id) => {
    setErrorNotice("");
    setSuccessNotice("");
    if (!quickEditData.unlimitedUsage && !isValidUsageLimitInput(quickEditData.usageLimit)) {
      setErrorNotice("Total limit must be a whole number of 1 or more (leave blank for unlimited).");
      return;
    }
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
        if (data.stripeSyncStatus === "error") {
          setErrorNotice(`Stripe sync failed: ${data.stripeSyncError || "unknown error"}`);
        }
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

  // Select-all is based on the rows currently visible, not on counts.
  const allVisibleSelected = discounts.length > 0 && discounts.every(d => selectedIds.includes(d._id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelectedIds([]);
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
    if (d.isDeleted) return { label: "Trashed", color: "wp-st-cancelled" };
    if (!d.isActive) return { label: "Inactive", color: "wp-st-draft" };
    if (d.startDate && new Date(d.startDate) > new Date()) return { label: "Scheduled", color: "wp-st-shipped" };
    if (d.endDate && new Date(d.endDate) < new Date()) return { label: "Expired", color: "wp-st-confirmed" };
    return { label: "Active", color: "wp-st-published" };
  };

  // Layout-only: which "Coupon data" tab is visible. Every panel stays mounted.
  const [couponTab, setCouponTab] = useState("general");
  // If the browser blocks submit because a required/invalid field sits on a hidden tab,
  // bring that tab into view so the field can be seen and fixed.
  const revealInvalidField = (e) => {
    const panel = e.target?.closest?.("[data-coupon-panel]");
    if (panel && panel.dataset.couponPanel !== couponTab) setCouponTab(panel.dataset.couponPanel);
  };

  const COUPON_TABS = [
    { key: "general", label: "General" },
    { key: "restriction", label: "Usage restriction" },
    { key: "limits", label: "Usage limits" },
  ];

  // ── Full Add/Edit Coupon Form Screen ──
  if (showForm) {
    const isEdit = Boolean(editingDiscountId);
    return (
      <Page>
        <PageHeader title={isEdit ? "Edit coupon" : "Add new coupon"} />

        {/* WordPress Notices */}
        {errorNotice && (
          <Notice type="error" onDismiss={() => setErrorNotice("")}>
            <span style={{ overflowWrap: "anywhere" }}>{errorNotice}</span>
          </Notice>
        )}

        <form onSubmit={handleSubmit} onInvalidCapture={revealInvalidField}>
          <div className="wp-cols">
            <div className="wp-col-main">
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="coupon-code" className="sr-only">Coupon code (required)</label>
                <input
                  id="coupon-code"
                  required
                  placeholder="Coupon code"
                  className="wp-title-input"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                />
                <p className="wp-desc">The code customers enter at checkout. Example: SUMMER50</p>
              </div>

              <section className="wp-postbox" aria-labelledby="coupon-data-title">
                <div className="wp-postbox-head">
                  <h2 id="coupon-data-title">Coupon data</h2>
                </div>
                <div className="wp-vtabs">
                  <div className="wp-vtabs-list" role="tablist" aria-label="Coupon data" aria-orientation="vertical">
                    {COUPON_TABS.map(t => (
                      <button
                        key={t.key}
                        type="button"
                        role="tab"
                        id={`coupon-tab-${t.key}`}
                        aria-controls={`coupon-panel-${t.key}`}
                        aria-selected={couponTab === t.key}
                        className="wp-vtab"
                        onClick={() => setCouponTab(t.key)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* General */}
                  <div
                    id="coupon-panel-general"
                    role="tabpanel"
                    aria-labelledby="coupon-tab-general"
                    data-coupon-panel="general"
                    className={`wp-vtabs-panel ${couponTab === "general" ? "" : "hidden"}`}
                  >
                    <div className="wp-frow">
                      <label htmlFor="coupon-type" className="wp-flabel">Discount type</label>
                      <select
                        id="coupon-type"
                        className="wp-select"
                        value={formData.type}
                        onChange={(e) => setFormData({...formData, type: e.target.value})}
                      >
                        <option value="percentage">Percentage Discount</option>
                        <option value="fixed">Fixed Cart Discount</option>
                      </select>
                    </div>

                    <div className="wp-frow">
                      <label htmlFor="coupon-amount" className="wp-flabel">
                        Coupon amount ({formData.type === "percentage" ? "%" : "$"}) <span style={{ color: "#b32d2e" }} aria-hidden="true">*</span>
                      </label>
                      <input
                        id="coupon-amount"
                        required
                        type="number"
                        min="0.01"
                        step="any"
                        placeholder={formData.type === "percentage" ? "e.g. 20" : "e.g. 50"}
                        className="wp-input"
                        value={formData.value}
                        onChange={(e) => setFormData({...formData, value: e.target.value})}
                      />
                      <span className="wp-hint">Value of the coupon.</span>
                    </div>

                    {formData.type === "percentage" && (
                      <div className="wp-frow">
                        <label htmlFor="coupon-max-cap" className="wp-flabel">Max discount cap ($)</label>
                        <input
                          id="coupon-max-cap"
                          type="number"
                          min="0.01"
                          step="any"
                          placeholder="No cap"
                          className="wp-input"
                          value={formData.maxDiscountAmount}
                          onChange={(e) => setFormData({...formData, maxDiscountAmount: e.target.value})}
                        />
                        <span className="wp-hint">Caps percentage discounts (e.g. 20% off, up to $50 max).</span>
                      </div>
                    )}

                    <div className="wp-frow">
                      <label htmlFor="coupon-start" className="wp-flabel">Start date</label>
                      <input
                        id="coupon-start"
                        type="date"
                        className="wp-input"
                        value={formData.startDate}
                        onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      />
                      <span className="wp-hint">Leave blank to activate immediately.</span>
                    </div>

                    <div className="wp-frow">
                      <label htmlFor="coupon-expiry" className="wp-flabel">Coupon expiry date</label>
                      <input
                        id="coupon-expiry"
                        type="date"
                        className="wp-input"
                        value={formData.endDate}
                        onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      />
                      <span className="wp-hint">Leave blank for no expiration.</span>
                    </div>
                  </div>

                  {/* Usage restriction */}
                  <div
                    id="coupon-panel-restriction"
                    role="tabpanel"
                    aria-labelledby="coupon-tab-restriction"
                    data-coupon-panel="restriction"
                    className={`wp-vtabs-panel ${couponTab === "restriction" ? "" : "hidden"}`}
                  >
                    <div className="wp-frow">
                      <label htmlFor="coupon-min-spend" className="wp-flabel">Minimum spend ($)</label>
                      <input
                        id="coupon-min-spend"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        className="wp-input"
                        value={formData.minPurchase}
                        onChange={(e) => setFormData({...formData, minPurchase: e.target.value})}
                      />
                      <span className="wp-hint">Minimum cart total required before coupon applies.</span>
                    </div>

                    <div className="wp-frow">
                      <label htmlFor="coupon-min-qty" className="wp-flabel">Minimum quantity</label>
                      <input
                        id="coupon-min-qty"
                        type="number"
                        min="0"
                        placeholder="0"
                        className="wp-input"
                        value={formData.minQuantity}
                        onChange={(e) => setFormData({...formData, minQuantity: e.target.value})}
                      />
                      <span className="wp-hint">Minimum item quantity required in cart.</span>
                    </div>

                    <div className="wp-frow">
                      <span className="wp-flabel">Exclude sale items</span>
                      <label className="wp-check">
                        <input
                          type="checkbox"
                          checked={formData.excludeSaleItems}
                          onChange={(e) => setFormData({...formData, excludeSaleItems: e.target.checked})}
                        />
                        <span>Full-price items only</span>
                      </label>
                    </div>

                    <div style={{ padding: "12px 0", borderBottom: "1px solid #f6f7f7" }}>
                      <p className="wp-desc" style={{ margin: "0 0 10px" }}>
                        Select specific products or categories this coupon applies to. If left empty, it will apply to all products storewide.
                      </p>
                      <div style={{ marginBottom: 14 }}>
                        <ProductSelector
                          selectedIds={formData.specificProducts}
                          onChange={(ids) => setFormData({ ...formData, specificProducts: ids })}
                          products={catalogProducts}
                          loading={catalogLoading}
                        />
                      </div>
                      <CategorySelector
                        selectedIds={formData.specificCategories}
                        onChange={(ids) => setFormData({ ...formData, specificCategories: ids })}
                        categories={catalogCategories}
                        loading={catalogLoading}
                      />
                    </div>

                    <div className="wp-frow">
                      <label htmlFor="coupon-emails" className="wp-flabel">Allowed emails</label>
                      <input
                        id="coupon-emails"
                        type="text"
                        placeholder="e.g. jane@example.com, john@example.com"
                        className="wp-input"
                        value={formData.specificCustomerEmails}
                        onChange={(e) => setFormData({...formData, specificCustomerEmails: e.target.value})}
                      />
                      <span className="wp-hint">Comma-separated. Restricts the coupon to these emails only — no account required. Each one gets an automatic email with the code once this coupon is active.</span>
                    </div>

                    <div className="wp-frow">
                      <span className="wp-flabel">Customer eligibility</span>
                      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                        <label className="wp-check">
                          <input
                            type="checkbox"
                            checked={formData.firstOrderOnly}
                            onChange={(e) => setFormData({...formData, firstOrderOnly: e.target.checked})}
                          />
                          <span>First order only (new customers only)</span>
                        </label>
                        <label className="wp-check">
                          <input
                            type="checkbox"
                            checked={formData.userRegistrationRequired}
                            onChange={(e) => setFormData({...formData, userRegistrationRequired: e.target.checked})}
                          />
                          <span>Require user login / account registration</span>
                        </label>
                        <label className="wp-check">
                          <input
                            type="checkbox"
                            checked={formData.newsletterSubscribedOnly}
                            onChange={(e) => setFormData({...formData, newsletterSubscribedOnly: e.target.checked})}
                          />
                          <span>Newsletter subscribers only</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Usage limits */}
                  <div
                    id="coupon-panel-limits"
                    role="tabpanel"
                    aria-labelledby="coupon-tab-limits"
                    data-coupon-panel="limits"
                    className={`wp-vtabs-panel ${couponTab === "limits" ? "" : "hidden"}`}
                  >
                    <div className="wp-frow">
                      <label htmlFor="coupon-usage-limit" className="wp-flabel">Usage limit per coupon</label>
                      <input
                        id="coupon-usage-limit"
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        disabled={formData.unlimitedUsage}
                        className="wp-input"
                        value={formData.usageLimit}
                        onChange={(e) => setFormData({...formData, usageLimit: e.target.value})}
                      />
                      <label className="wp-check">
                        <input
                          type="checkbox"
                          checked={formData.unlimitedUsage}
                          onChange={(e) => setFormData({...formData, unlimitedUsage: e.target.checked, usageLimit: e.target.checked ? "" : formData.usageLimit})}
                        />
                        <span>Unlimited usage</span>
                      </label>
                      <span className="wp-hint">How many times this coupon can be used before it is void.</span>
                    </div>

                    <div className="wp-frow">
                      <label htmlFor="coupon-usage-per-user" className="wp-flabel">Usage limit per user</label>
                      <input
                        id="coupon-usage-per-user"
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        disabled={formData.unlimitedPerCustomer}
                        className="wp-input"
                        value={formData.usagePerUserLimit}
                        onChange={(e) => setFormData({...formData, usagePerUserLimit: e.target.value})}
                      />
                      <label className="wp-check">
                        <input
                          type="checkbox"
                          checked={formData.unlimitedPerCustomer}
                          onChange={(e) => setFormData({...formData, unlimitedPerCustomer: e.target.checked, usagePerUserLimit: e.target.checked ? "" : (formData.usagePerUserLimit || "1")})}
                        />
                        <span>Unlimited per customer</span>
                      </label>
                    </div>

                    <div className="wp-frow">
                      <span className="wp-flabel">Per device</span>
                      <label className="wp-check">
                        <input
                          type="checkbox"
                          checked={formData.oneRedemptionPerDevice}
                          onChange={(e) => setFormData({...formData, oneRedemptionPerDevice: e.target.checked})}
                        />
                        <span>Limit to one redemption per device / IP</span>
                      </label>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="wp-col-side">
              <Postbox
                id="coupon-publish"
                title="Publish"
                footer={
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        handleReset();
                        router.push("/admin/discounts");
                      }}
                      className="wp-btn"
                    >
                      Cancel
                    </button>
                    <span className="wp-spacer" />
                    <button type="submit" className="wp-btn wp-btn-primary">
                      {isEdit ? "Update Coupon" : "Create Coupon"}
                    </button>
                  </>
                }
              >
                {isEdit && (
                  <div className="wp-kv">
                    <span className="wp-kv-k">Coupon</span>
                    <span className="wp-kv-v" style={{ overflowWrap: "anywhere" }}>{formData.code}</span>
                  </div>
                )}
                <div className="wp-kv">
                  <span className="wp-kv-k">Status</span>
                  <span className={`wp-pill wp-pill-sm ${formData.isActive ? "wp-st-published" : "wp-st-draft"}`}>
                    {formData.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <label className="wp-check" style={{ marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  />
                  <span>{formData.isActive ? "Active (Ready for use)" : "Inactive (Paused)"}</span>
                </label>
              </Postbox>
            </div>
          </div>
        </form>
      </Page>
    );
  }

  const FILTERS = [
    { key: "All", count: stats.allCount },
    { key: "Active", count: stats.activeCount },
    { key: "Expired", count: stats.expiredCount },
    { key: "Trash", count: stats.trashCount },
  ];

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input
          type="checkbox"
          aria-label="Select all coupons"
          checked={allVisibleSelected}
          onChange={toggleSelectAll}
        />
      </th>
      <th scope="col">Code</th>
      <th scope="col" className="wp-hide-sm">Coupon type</th>
      <th scope="col" className="wp-hide-sm">Coupon amount</th>
      <th scope="col" className="wp-hide-sm">Product IDs / scope</th>
      <th scope="col" className="wp-hide-sm">Minimum spend</th>
      <th scope="col" className="wp-hide-sm">Usage / Limit</th>
      <th scope="col" className="wp-hide-sm">Expiry date</th>
      <th scope="col">Status</th>
    </tr>
  );

  const linkBtnStyle = { background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left" };

  // ── Coupons List View ──
  return (
    <Page>
      <PageHeader
        title="Coupons"
        actions={
          <button
            type="button"
            className="wp-btn"
            onClick={() => {
              setEditingDiscountId(null);
              setFormData({ ...EMPTY_FORM });
              setShowForm(true);
              router.push("/admin/discounts?action=new");
            }}
          >
            Add coupon
          </button>
        }
      />

      {/* WordPress Notices */}
      {successNotice && (
        <Notice type="success" onDismiss={() => setSuccessNotice("")}>
          <span style={{ overflowWrap: "anywhere" }}>{successNotice}</span>
        </Notice>
      )}
      {errorNotice && (
        <Notice type="error" onDismiss={() => setErrorNotice("")}>
          <span style={{ overflowWrap: "anywhere" }}>{errorNotice}</span>
        </Notice>
      )}

      {/* Status filter links */}
      <div className="wp-subsub" role="tablist" aria-label="Filter coupons by status">
        {FILTERS.map((f, i) => (
          <React.Fragment key={f.key}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === f.key}
              className={`max-[782px]:min-h-10 ${statusFilter === f.key ? "is-current" : ""}`}
              onClick={() => { setStatusFilter(f.key); setSelectedIds([]); }}
            >
              {f.key} <span className="wp-count">({f.count || 0})</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Toolbar: bulk actions + search */}
      <div className="wp-toolbar">
        <label htmlFor="coupons-bulk-action" className="sr-only">Select bulk action</label>
        <select
          id="coupons-bulk-action"
          className="wp-select"
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
          className="wp-btn"
        >
          Apply
        </button>

        <span className="wp-spacer" />

        <form role="search" onSubmit={(e) => { e.preventDefault(); applySearch(searchInput); }} className="wp-search">
          <label htmlFor="coupons-search" className="sr-only">Search coupons</label>
          <input
            id="coupons-search"
            type="search"
            placeholder="Search coupons..."
            className="wp-input"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="wp-btn">
            Search coupons
          </button>
        </form>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <span className="wp-pages">
          {discounts.length} item{discounts.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Coupon List Table */}
      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="wp-muted">Loading coupons…</td></tr>
            ) : discounts.length === 0 ? (
              <tr><td colSpan={9} className="wp-muted">No coupons found.</td></tr>
            ) : (
              discounts.map((d) => {
                const isSelected = selectedIds.includes(d._id);
                const isQuickEditing = quickEditingId === d._id;
                const cStatus = getCouponStatus(d);
                const prodCount = Array.isArray(d.specificProducts) ? d.specificProducts.length : 0;
                const catCount = Array.isArray(d.specificCategories) ? d.specificCategories.length : 0;
                const amountLabel = d.type === 'percentage' ? `${d.value}%` : `$${Number(d.value || 0).toFixed(2)}`;

                if (isQuickEditing) {
                  return (
                    <tr key={d._id} className="is-selected">
                      <td colSpan={9} style={{ padding: 0 }}>
                        <fieldset style={{ border: 0, margin: 0, padding: 14, minWidth: 0, borderLeft: "4px solid #2271b1" }}>
                          <legend className="wp-strong" style={{ float: "left", width: "100%", margin: "0 0 10px", fontSize: 14, overflowWrap: "anywhere" }}>
                            Quick Edit — <span style={{ color: "#2271b1" }}>{d.code}</span>
                          </legend>

                          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-x-3" style={{ clear: "both" }}>
                            <div className="wp-field">
                              <label htmlFor="qe-coupon-code" className="wp-label">Code</label>
                              <input
                                id="qe-coupon-code"
                                type="text"
                                className="wp-input wp-full"
                                value={quickEditData.code}
                                onChange={e => setQuickEditData({ ...quickEditData, code: e.target.value })}
                              />
                            </div>
                            <div className="wp-field">
                              <label htmlFor="qe-coupon-type" className="wp-label">Type</label>
                              <select
                                id="qe-coupon-type"
                                className="wp-select wp-full"
                                value={quickEditData.type}
                                onChange={e => setQuickEditData({ ...quickEditData, type: e.target.value })}
                              >
                                <option value="percentage">Percentage</option>
                                <option value="fixed">Fixed Cart</option>
                              </select>
                            </div>
                            <div className="wp-field">
                              <label htmlFor="qe-coupon-amount" className="wp-label">Amount</label>
                              <input
                                id="qe-coupon-amount"
                                type="number"
                                min="0.01"
                                step="any"
                                className="wp-input wp-full"
                                value={quickEditData.value}
                                onChange={e => setQuickEditData({ ...quickEditData, value: e.target.value })}
                              />
                            </div>
                            <div className="wp-field">
                              <label htmlFor="qe-coupon-min" className="wp-label">Min spend ($)</label>
                              <input
                                id="qe-coupon-min"
                                type="number"
                                min="0"
                                step="any"
                                className="wp-input wp-full"
                                value={quickEditData.minPurchase}
                                onChange={e => setQuickEditData({ ...quickEditData, minPurchase: e.target.value })}
                              />
                            </div>
                            <div className="wp-field">
                              <label htmlFor="qe-coupon-limit" className="wp-label">Total limit</label>
                              <input
                                id="qe-coupon-limit"
                                type="number"
                                min="1"
                                step="1"
                                placeholder="Unlimited"
                                disabled={quickEditData.unlimitedUsage}
                                className="wp-input wp-full"
                                value={quickEditData.usageLimit}
                                onChange={e => setQuickEditData({ ...quickEditData, usageLimit: e.target.value })}
                              />
                              <label className="wp-check">
                                <input
                                  type="checkbox"
                                  checked={quickEditData.unlimitedUsage}
                                  onChange={(e) => setQuickEditData({...quickEditData, unlimitedUsage: e.target.checked, usageLimit: e.target.checked ? "" : quickEditData.usageLimit})}
                                />
                                <span>Unlimited</span>
                              </label>
                            </div>
                            <div className="wp-field">
                              <span className="wp-label">Status</span>
                              <label className="wp-check">
                                <input
                                  type="checkbox"
                                  checked={quickEditData.isActive}
                                  onChange={(e) => setQuickEditData({...quickEditData, isActive: e.target.checked})}
                                />
                                <span>{quickEditData.isActive ? "Active" : "Inactive"}</span>
                              </label>
                            </div>
                          </div>

                          {/* Selectors inside Quick Edit */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ borderTop: "1px solid #dcdcde", paddingTop: 12 }}>
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

                          <div className="flex flex-wrap gap-2" style={{ marginTop: 14 }}>
                            <button
                              type="button"
                              onClick={() => handleQuickEditSubmit(d._id)}
                              className="wp-btn wp-btn-primary"
                            >
                              Update
                            </button>
                            <button
                              type="button"
                              onClick={() => setQuickEditingId(null)}
                              className="wp-btn"
                            >
                              Cancel
                            </button>
                          </div>
                        </fieldset>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={d._id} className={isSelected ? "is-selected" : undefined}>
                    <td className="wp-check-col">
                      <input type="checkbox" aria-label={`Select coupon ${d.code}`} checked={isSelected} onChange={() => toggleSelect(d._id)} />
                    </td>
                    <td style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setViewingDiscount(d)}
                          className="wp-row-title"
                          style={linkBtnStyle}
                          title="Click to view this coupon"
                        >
                          {d.code}
                        </button>
                        {d.stripeSyncStatus === "synced" && (
                          <span title="Synced to Stripe" role="img" aria-label="Synced to Stripe" style={{ color: "#2f6f1a", display: "inline-flex" }}><CreditCard className="w-3.5 h-3.5" aria-hidden="true" /></span>
                        )}
                        {d.stripeSyncStatus === "error" && (
                          <span title={`Stripe sync failed: ${d.stripeSyncError || "unknown error"}`} role="img" aria-label="Stripe sync failed" style={{ color: "#b32d2e", display: "inline-flex" }}><AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /></span>
                        )}
                      </div>

                      <div className="wp-mobile-meta">
                        {d.type === 'percentage' ? 'Percentage' : 'Fixed Cart'} · <span className="wp-strong">{amountLabel}</span>
                        {" · "}Used {d.usageCount || 0} / {d.usageLimit || "∞"}
                        {d.endDate ? <> · Expires {formatDate(d.endDate)}</> : null}
                      </div>

                      {/* Row Actions */}
                      <div className="wp-row-actions">
                        {d.isDeleted ? (
                          <>
                            <span><button type="button" onClick={() => handleRestore(d._id)} className="max-[782px]:min-h-10">Restore</button></span>
                            <span><button type="button" onClick={() => handleDelete(d._id, true)} className="is-danger max-[782px]:min-h-10">Delete Permanently</button></span>
                          </>
                        ) : (
                          <>
                            <span><button type="button" onClick={() => handleStartFullEdit(d)} className="max-[782px]:min-h-10">Edit</button></span>
                            <span><button type="button" onClick={() => handleStartQuickEdit(d)} className="max-[782px]:min-h-10">Quick Edit</button></span>
                            <span><button type="button" onClick={() => setViewingDiscount(d)} className="max-[782px]:min-h-10">View</button></span>
                            <span><button type="button" onClick={() => setSharingDiscount(d)} className="max-[782px]:min-h-10">Share</button></span>
                            <span><button type="button" onClick={() => handleDuplicate(d)} className="max-[782px]:min-h-10">Duplicate</button></span>
                            <span><button type="button" onClick={() => handleDelete(d._id)} className="is-danger max-[782px]:min-h-10">Trash</button></span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="wp-hide-sm">
                      {d.type === 'percentage' ? 'Percentage discount' : 'Fixed cart discount'}
                    </td>
                    <td className="wp-hide-sm wp-strong">
                      {amountLabel}
                    </td>

                    {/* Scope / Products */}
                    <td className="wp-hide-sm">
                      {prodCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setViewingDiscount(d)}
                          className="wp-link"
                          style={linkBtnStyle}
                          title="Click to view eligible products"
                        >
                          {prodCount} Product{prodCount === 1 ? "" : "s"}
                        </button>
                      ) : catCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setViewingDiscount(d)}
                          className="wp-link"
                          style={linkBtnStyle}
                        >
                          {catCount} Categor{catCount === 1 ? "y" : "ies"}
                        </button>
                      ) : (
                        <span className="wp-muted">
                          Storewide (All)
                        </span>
                      )}
                    </td>

                    <td className="wp-hide-sm">
                      ${Number(d.minPurchase || 0).toFixed(2)}
                    </td>
                    <td className="wp-hide-sm">
                      {d.usageCount || 0} / {d.usageLimit || "∞"}
                    </td>
                    <td className="wp-hide-sm">
                      {formatDate(d.endDate)}
                    </td>
                    <td>
                      <span className={`wp-pill wp-pill-sm ${cStatus.color}`}>
                        {cStatus.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
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
    </Page>
  );
}

export default function AdminDiscounts() {
  return (
    <RequirePermission permission="promotions.view">
      <Suspense fallback={<div className="wp-page wp-muted">Loading…</div>}>
        <CouponsContent />
      </Suspense>
    </RequirePermission>
  );
}
