"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Page, PageHeader, Notice, Skeleton, formatDate, formatMoney } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import { paginate } from "@/lib/admin-products-utils";

// Status views. "Archived" is the promotions' trash: archived promotions never run, can be
// restored (as a Draft) and only an archived promotion can be deleted permanently.
const VIEWS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active", status: "Active" },
  { key: "scheduled", label: "Scheduled", status: "Scheduled" },
  { key: "paused", label: "Paused", status: "Paused" },
  { key: "draft", label: "Drafts", status: "Draft" },
  { key: "expired", label: "Expired", status: "Expired" },
  { key: "archived", label: "Archived" },
];

async function errorFrom(res, fallback) {
  const body = await res.json().catch(() => null);
  return body?.error || fallback;
}

export default function PromotionsDashboard() {
  const { showConfirm } = usePopup();
  const [allPromotions, setAllPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState("all"); // see VIEWS
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");

  const fetchPromotions = useCallback(async () => {
    setLoading(true);
    try {
      // Includes archived promotions so the Trash view and its count work; every other
      // view and the summary below exclude them.
      const res = await fetch("/api/admin/promotions?includeArchived=1");
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) {
        setAllPromotions(data);
        setLoadError("");
      } else {
        setLoadError(data?.error || "Failed to load promotions.");
      }
    } catch (err) {
      console.error("Failed to fetch promotions:", err);
      setLoadError("Failed to load promotions.");
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
  // Server copies it as a Draft with a unique "<CODE>-COPY[-N]" code and zeroed usage.
  const duplicatePromotion = (id) => fetch(`/api/admin/promotions/${id}/duplicate`, { method: "POST" });

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
    const ok = await showConfirm("Archive this promotion? It stops running right away. You can restore it later from the Archived view.", "Archive promotion", { confirmText: "Archive" });
    if (!ok) return;
    await runSingle(() => archivePromotion(id), "Promotion archived", "Failed to archive promotion");
  };

  const handleRestore = (id) =>
    runSingle(() => restorePromotion(id), "Promotion restored as a draft", "Failed to restore promotion");

  const handleDeletePermanently = async (id) => {
    const ok = await showConfirm("Permanently delete this promotion? Its revision history will be removed. This cannot be undone.", "Delete permanently", { confirmText: "Delete permanently", danger: true });
    if (!ok) return;
    await runSingle(() => deletePromotionPermanently(id), "Promotion deleted permanently", "Failed to delete promotion");
  };

  const handleDuplicate = (promo) =>
    runSingle(() => duplicatePromotion(promo._id), "Promotion duplicated as a draft", "Failed to duplicate promotion");

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
           if (bulkAction === "Archive") {
              res = await archivePromotion(id);
           } else if (bulkAction === "Restore") {
              res = await restorePromotion(id);
           } else if (isPermanent) {
              res = await deletePromotionPermanently(id);
           } else if (bulkAction === "Duplicate") {
              res = await duplicatePromotion(id);
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
     setPage(1);
  };

  const toggleSelect = (id) => {
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const promotions = allPromotions.filter(p => p.adminStatus !== "Archived");
  const archivedPromotions = allPromotions.filter(p => p.adminStatus === "Archived");
  const isArchivedView = view === "archived";

  const countFor = (v) =>
    v.key === "all" ? promotions.length
      : v.key === "archived" ? archivedPromotions.length
      : promotions.filter(p => p.status === v.status).length;

  const term = searchTerm.trim().toLowerCase();
  const viewStatus = VIEWS.find(v => v.key === view)?.status;
  const filteredPromotions = (isArchivedView ? archivedPromotions : promotions).filter(p => {
    const matchesSearch = !term ||
                          p.title?.toLowerCase().includes(term) ||
                          p.code?.toLowerCase().includes(term);
    return matchesSearch && (!viewStatus || p.status === viewStatus);
  });

  const { items: pagePromotions, page: currentPage, totalPages } = paginate(filteredPromotions, page);
  const visibleIds = pagePromotions.map(p => p._id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const someSelected = visibleIds.some(id => selectedIds.includes(id));

  const toggleSelectAll = () => {
     if (allSelected) setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
     else setSelectedIds(prev => [...new Set([...prev, ...visibleIds])]);
  };

  const goToPage = (n) => {
    setPage(Math.min(Math.max(1, n), totalPages));
    setSelectedIds([]);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'wp-st-published';
      case 'Scheduled': return 'wp-st-shipped';
      case 'Paused': return 'wp-st-confirmed';
      case 'Expired': return 'wp-st-cancelled';
      case 'Exhausted': return 'wp-st-cancelled';
      case 'Draft': return 'wp-st-draft';
      case 'Archived': return 'wp-st-draft';
      default: return '';
    }
  };

  const pagination = (
    <div className="wp-pages">
      <span>{filteredPromotions.length} {filteredPromotions.length === 1 ? "item" : "items"}</span>
      <button type="button" className="wp-pager" aria-label="First page" disabled={currentPage <= 1} onClick={() => goToPage(1)}><ChevronsLeft className="w-4 h-4" /></button>
      <button type="button" className="wp-pager" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}><ChevronLeft className="w-4 h-4" /></button>
      <span>{currentPage} of {totalPages}</span>
      <button type="button" className="wp-pager" aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}><ChevronRight className="w-4 h-4" /></button>
      <button type="button" className="wp-pager" aria-label="Last page" disabled={currentPage >= totalPages} onClick={() => goToPage(totalPages)}><ChevronsRight className="w-4 h-4" /></button>
    </div>
  );

  const scheduleText = (p) =>
    `${p.startDate ? formatDate(p.startDate) : 'Always'} → ${p.endDate ? formatDate(p.endDate) : 'Indefinite'}`;

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input
          type="checkbox"
          aria-label="Select all promotions"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
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
        title="Promotions & BOGO"
        actions={<Link href="/admin/promotions/new" className="wp-btn">Add new promotion</Link>}
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
          <div className="wp-stat-value">{formatMoney(promotions.reduce((acc, p) => acc + (p.analytics?.discountDistributed || 0), 0), "USD", { decimals: 0 })}</div>
        </div>
        <div className="wp-stat">
          <div className="wp-stat-label">Revenue generated</div>
          <div className="wp-stat-value">{formatMoney(promotions.reduce((acc, p) => acc + (p.analytics?.revenueGenerated || 0), 0), "USD", { decimals: 0 })}</div>
        </div>
      </div>

      {loadError && (
        <Notice type="error" onDismiss={() => setLoadError("")}>{loadError}</Notice>
      )}

      {/* Status filter links */}
      <div className="wp-subsub" role="tablist" aria-label="Filter promotions by status">
        {VIEWS.map((v, i) => (
          <React.Fragment key={v.key}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={view === v.key}
              className={`max-[782px]:min-h-10 ${view === v.key ? "is-current" : ""}`}
              onClick={() => changeView(v.key)}
            >
              {v.label} <span className="wp-count">({countFor(v)})</span>
            </button>
          </React.Fragment>
        ))}
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
          {isArchivedView ? (
            <>
              <option>Restore</option>
              <option>Delete Permanently</option>
            </>
          ) : (
            <>
              <option>Duplicate</option>
              <option>Archive</option>
            </>
          )}
        </select>
        <button type="button" onClick={handleBulkAction} disabled={selectedIds.length === 0 || bulkAction === "Bulk actions"} className="wp-btn">Apply</button>

        <span className="wp-spacer" />

        <form
          className="wp-search"
          role="search"
          // Filtering is live and synchronous, so submitting (button or Enter) just applies
          // the current term without reloading the page.
          onSubmit={(e) => { e.preventDefault(); setSearchTerm((t) => t.trim()); setPage(1); setSelectedIds([]); }}
        >
          <label htmlFor="promotions-search" className="sr-only">Search promotions</label>
          <input
            id="promotions-search"
            type="search"
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); setSelectedIds([]); }}
            className="wp-input"
          />
          <button type="submit" className="wp-btn">Search promotions</button>
        </form>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pagination}
      </div>

      {/* Data Table */}
      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}><span className="sr-only">Loading promotions…</span><Skeleton height={14} /><Skeleton height={14} width="70%" style={{ marginTop: 8 }} /></td></tr>
            ) : pagePromotions.length === 0 ? (
              <tr><td colSpan={7} className="wp-muted">
                {term ? "No promotions match your search."
                  : isArchivedView ? "No archived promotions."
                  : view === "all" ? "No promotions yet. Use \u201cAdd new promotion\u201d to create one."
                  : "No promotions in this view."}
              </td></tr>
            ) : (
              pagePromotions.map((p) => (
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
                    {isArchivedView ? (
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
                        <span><button type="button" onClick={() => handleArchive(p._id)} className="is-danger">Archive</button></span>
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
                    <div>Saved: <span className="wp-strong">{formatMoney(p.analytics?.discountDistributed || 0, "USD", { decimals: 0 })}</span></div>
                    <div>Revenue: <span className="wp-strong">{formatMoney(p.analytics?.revenueGenerated || 0, "USD", { decimals: 0 })}</span></div>
                  </td>
                  <td className="wp-hide-sm wp-num">{p.priority || 0}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pagination}
      </div>
    </Page>
    </RequirePermission>
  );
}
