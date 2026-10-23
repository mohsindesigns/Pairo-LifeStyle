"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Page, PageHeader, formatDate } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

async function errorFrom(res, fallback) {
  const body = await res.json().catch(() => null);
  return body?.error || fallback;
}

export default function PromotionsDashboard() {
  const { showConfirm } = usePopup();
  const [allPromotions, setAllPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState("all"); // all, running, paused, expired, trash
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");

  const fetchPromotions = useCallback(async () => {
    setLoading(true);
    try {
      // Includes archived promotions so the Trash view and its count work; every other
      // view and the summary below exclude them.
      const res = await fetch("/api/admin/promotions?includeArchived=1");
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) setAllPromotions(data);
      else toast.error(data?.error || "Failed to load promotions");
    } catch (err) {
      console.error("Failed to fetch promotions:", err);
      toast.error("Failed to load promotions");
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
      else toast.error(await errorFrom(res, "Failed to update status"));
    } catch (err) {
      console.error("Failed to toggle status:", err);
      toast.error("Failed to update status");
    }
  };

  // Single-item requests. Each returns the fetch Response; callers check res.ok.
  const archivePromotion = (id) => fetch(`/api/admin/promotions/${id}`, { method: "DELETE" });
  const deletePromotionPermanently = (id) => fetch(`/api/admin/promotions/${id}?permanent=1`, { method: "DELETE" });
  // Restored promotions come back as Draft so nothing goes live by accident.
  const restorePromotion = (id) => fetch(`/api/admin/promotions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminStatus: "Draft" })
  });
  const duplicatePromotion = (promo) => {
    const { _id, id: _virtualId, status: _status, ...rest } = promo;
    const copy = {
      ...rest,
      title: `${promo.title} (Copy)`,
      code: promo.code ? `${promo.code}_COPY` : undefined,
      adminStatus: "Draft",
    };
    return fetch("/api/admin/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(copy)
    });
  };

  const runSingle = async (request, successMsg, failMsg) => {
    try {
      const res = await request();
      if (res.ok) {
        toast.success(successMsg);
        fetchPromotions();
      } else {
        toast.error(await errorFrom(res, failMsg));
      }
    } catch (err) {
      console.error(failMsg, err);
      toast.error(failMsg);
    }
  };

  const handleArchive = async (id) => {
    const ok = await showConfirm("Move this promotion to Trash? It will stop running and no longer be visible to customers.", "Move to Trash", { confirmText: "Move to Trash" });
    if (!ok) return;
    await runSingle(() => archivePromotion(id), "Promotion moved to Trash", "Failed to move promotion to Trash");
  };

  const handleRestore = (id) =>
    runSingle(() => restorePromotion(id), "Promotion restored as a draft", "Failed to restore promotion");

  const handleDeletePermanently = async (id) => {
    const ok = await showConfirm("Permanently delete this promotion? Its revision history will be removed. This cannot be undone.", "Delete permanently", { confirmText: "Delete permanently", danger: true });
    if (!ok) return;
    await runSingle(() => deletePromotionPermanently(id), "Promotion deleted permanently", "Failed to delete promotion");
  };

  const handleDuplicate = (promo) =>
    runSingle(() => duplicatePromotion(promo), "Promotion duplicated as a draft", "Failed to duplicate promotion");

  const handleBulkAction = async () => {
     if (bulkAction === "Bulk actions" || selectedIds.length === 0) return;
     const isPermanent = bulkAction === "Delete Permanently";
     const ok = isPermanent
       ? await showConfirm(`Permanently delete ${selectedIds.length} promotion${selectedIds.length === 1 ? "" : "s"}? Their revision history will be removed. This cannot be undone.`, "Delete permanently", { confirmText: "Delete permanently", danger: true })
       : await showConfirm(`Apply "${bulkAction}" to ${selectedIds.length} promotions?`, "Bulk Action");
     if (!ok) return;
     let done = 0;
     let failed = 0;
     for (const id of selectedIds) {
        try {
           let res = null;
           if (bulkAction === "Move to Trash") {
              res = await archivePromotion(id);
           } else if (bulkAction === "Restore") {
              res = await restorePromotion(id);
           } else if (isPermanent) {
              res = await deletePromotionPermanently(id);
           } else if (bulkAction === "Duplicate") {
              const promo = allPromotions.find(p => p._id === id);
              if (promo) res = await duplicatePromotion(promo);
           }
           if (res?.ok) done++;
           else failed++;
        } catch (err) {
           console.error("Bulk action failed:", err);
           failed++;
        }
     }
     setSelectedIds([]);
     fetchPromotions();
     if (failed === 0) toast.success(`${bulkAction}: ${done} item${done === 1 ? "" : "s"} done`);
     else toast.error(`${bulkAction}: ${done} succeeded, ${failed} failed`);
  };

  const changeView = (next) => {
     setView(next);
     setSelectedIds([]);
     setBulkAction("Bulk actions");
  };

  const toggleSelect = (id) => {
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
     if (selectedIds.length === filteredPromotions.length) setSelectedIds([]);
     else setSelectedIds(filteredPromotions.map(p => p._id));
  };

  const promotions = allPromotions.filter(p => p.adminStatus !== "Archived");
  const trashedPromotions = allPromotions.filter(p => p.adminStatus === "Archived");

  const filteredPromotions = (view === "trash" ? trashedPromotions : promotions).filter(p => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = p.title?.toLowerCase().includes(term) ||
                          p.code?.toLowerCase().includes(term);
    
    if (view === "running") return matchesSearch && p.status === "Active";
    if (view === "paused") return matchesSearch && p.status === "Paused";
    if (view === "expired") return matchesSearch && p.status === "Expired";
    return matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'wp-st-published';
      case 'Paused': return 'wp-st-confirmed';
      case 'Expired': return 'wp-st-cancelled';
      case 'Draft': return 'wp-st-draft';
      default: return '';
    }
  };

  const scheduleText = (p) =>
    `${p.startDate ? formatDate(p.startDate) : 'Always'} → ${p.endDate ? formatDate(p.endDate) : 'Indefinite'}`;

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input
          type="checkbox"
          aria-label="Select all promotions"
          checked={selectedIds.length > 0 && selectedIds.length === filteredPromotions.length}
          onChange={toggleSelectAll}
        />
      </th>
      <th scope="col">Name</th>
      <th scope="col">Status</th>
      <th scope="col" className="wp-hide-sm">Applies to</th>
      <th scope="col" className="wp-hide-sm">Schedule</th>
      <th scope="col" className="wp-hide-sm">Usage</th>
      <th scope="col" className="wp-hide-sm wp-num">Priority</th>
    </tr>
  );

  return (
    <RequirePermission permission="promotions.view">
    <Page>
      <PageHeader
        title="Discounts & Coupons"
        actions={<Link href="/admin/promotions/new" className="wp-btn">Add new discount</Link>}
      />

      {/* Summary */}
      <div className="wp-stats">
        <div className="wp-stat">
          <div className="wp-stat-label">Active offers</div>
          <div className="wp-stat-value">{promotions.filter(p => p.status === "Active").length}</div>
        </div>
        <div className="wp-stat">
          <div className="wp-stat-label">Total usage</div>
          <div className="wp-stat-value">{promotions.reduce((acc, p) => acc + (p.analytics?.timesUsed || 0), 0)}</div>
        </div>
        <div className="wp-stat">
          <div className="wp-stat-label">Discount distributed</div>
          <div className="wp-stat-value">${promotions.reduce((acc, p) => acc + (p.analytics?.discountDistributed || 0), 0).toFixed(0)}</div>
        </div>
        <div className="wp-stat">
          <div className="wp-stat-label">Revenue generated</div>
          <div className="wp-stat-value">${promotions.reduce((acc, p) => acc + (p.analytics?.revenueGenerated || 0), 0).toFixed(0)}</div>
        </div>
      </div>

      {/* Status filter links */}
      <div className="wp-subsub" role="tablist" aria-label="Filter promotions by status">
        <button type="button" role="tab" aria-selected={view === "all"} className={view === "all" ? "is-current" : undefined} onClick={() => changeView("all")}>
          All <span className="wp-count">({promotions.length})</span>
        </button>
        <span className="wp-sep" aria-hidden="true">|</span>
        <button type="button" role="tab" aria-selected={view === "running"} className={view === "running" ? "is-current" : undefined} onClick={() => changeView("running")}>
          Running <span className="wp-count">({promotions.filter(p => p.status === "Active").length})</span>
        </button>
        <span className="wp-sep" aria-hidden="true">|</span>
        <button type="button" role="tab" aria-selected={view === "paused"} className={view === "paused" ? "is-current" : undefined} onClick={() => changeView("paused")}>
          Paused <span className="wp-count">({promotions.filter(p => p.status === "Paused").length})</span>
        </button>
        <span className="wp-sep" aria-hidden="true">|</span>
        <button type="button" role="tab" aria-selected={view === "expired"} className={view === "expired" ? "is-current" : undefined} onClick={() => changeView("expired")}>
          Expired <span className="wp-count">({promotions.filter(p => p.status === "Expired").length})</span>
        </button>
        <span className="wp-sep" aria-hidden="true">|</span>
        <button type="button" role="tab" aria-selected={view === "trash"} className={view === "trash" ? "is-current" : undefined} onClick={() => changeView("trash")}>
          Trash <span className="wp-count">({trashedPromotions.length})</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="wp-toolbar">
        <label htmlFor="promotions-bulk-action" className="sr-only">Select bulk action</label>
        <select
          id="promotions-bulk-action"
          className="wp-select"
          value={bulkAction}
          onChange={(e) => setBulkAction(e.target.value)}
        >
          <option>Bulk actions</option>
          {view === "trash" ? (
            <>
              <option>Restore</option>
              <option>Delete Permanently</option>
            </>
          ) : (
            <>
              <option>Duplicate</option>
              <option>Move to Trash</option>
            </>
          )}
        </select>
        <button type="button" onClick={handleBulkAction} className="wp-btn">Apply</button>

        <span className="wp-spacer" />

        <form
          className="wp-search"
          role="search"
          // Filtering is live and synchronous, so submitting (button or Enter) just applies
          // the current term without reloading the page.
          onSubmit={(e) => { e.preventDefault(); setSearchTerm((t) => t.trim()); }}
        >
          <label htmlFor="promotions-search" className="sr-only">Search promotions</label>
          <input
            id="promotions-search"
            type="search"
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="wp-input"
          />
          <button type="submit" className="wp-btn">Search promotions</button>
        </form>
      </div>

      {/* Data Table */}
      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="wp-muted">Loading campaigns…</td></tr>
            ) : filteredPromotions.length === 0 ? (
              <tr><td colSpan={7} className="wp-muted">No promotions found matching filters.</td></tr>
            ) : (
              filteredPromotions.map((p) => (
                <tr key={p._id} className={selectedIds.includes(p._id) ? "is-selected" : undefined}>
                  <td className="wp-check-col">
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.title}`}
                      checked={selectedIds.includes(p._id)}
                      onChange={() => toggleSelect(p._id)}
                    />
                  </td>
                  <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                    <Link href={`/admin/promotions/${p._id}`} className="wp-row-title">{p.title}</Link>
                    <div className="wp-muted wp-small" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", marginTop: 2 }}>
                      {p.code || "Automatic (no code)"}
                    </div>
                    <div className="wp-mobile-meta">
                      {scheduleText(p)} · Used {p.analytics?.timesUsed || 0}
                    </div>
                    {view === "trash" ? (
                      <div className="wp-row-actions">
                        <span><button type="button" onClick={() => handleRestore(p._id)}>Restore</button></span>
                        <span><button type="button" onClick={() => handleDeletePermanently(p._id)} className="is-danger">Delete permanently</button></span>
                      </div>
                    ) : (
                      <div className="wp-row-actions">
                        <span><Link href={`/admin/promotions/${p._id}`}>Edit</Link></span>
                        <span><button type="button" onClick={() => handleDuplicate(p)}>Duplicate</button></span>
                        <span>
                          <button type="button" onClick={() => handleToggleStatus(p._id, p.adminStatus)}>
                            {p.adminStatus === 'Active' ? 'Pause' : 'Activate'}
                          </button>
                        </span>
                        <span><button type="button" onClick={() => handleArchive(p._id)} className="is-danger">Move to Trash</button></span>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`wp-pill wp-pill-sm ${getStatusColor(p.status)}`}>{p.status}</span>
                  </td>
                  <td className="wp-hide-sm" style={{ textTransform: "capitalize" }}>
                    {p.actions?.[0]?.target || 'Cart'}
                  </td>
                  <td className="wp-hide-sm wp-muted">{scheduleText(p)}</td>
                  <td className="wp-hide-sm">
                    <div>Used: <span className="wp-strong">{p.analytics?.timesUsed || 0}</span></div>
                    <div>Saved: <span className="wp-strong">${(p.analytics?.discountDistributed || 0).toFixed(0)}</span></div>
                    <div>Revenue: <span className="wp-strong">${(p.analytics?.revenueGenerated || 0).toFixed(0)}</span></div>
                  </td>
                  <td className="wp-hide-sm wp-num">{p.priority || 0}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>
    </Page>
    </RequirePermission>
  );
}
