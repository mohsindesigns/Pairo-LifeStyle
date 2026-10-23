"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Page, PageHeader, formatDate } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

export default function PromotionsDashboard() {
  const { showConfirm } = usePopup();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState("all"); // all, running, paused, expired
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");

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

  const handleArchive = async (id) => {
    const ok = await showConfirm("Archive this promotion? It will stop running and no longer be visible to customers.");
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/promotions/${id}`, { method: "DELETE" });
      if (res.ok) fetchPromotions();
    } catch (err) {
      console.error("Archive failed:", err);
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
        analytics: { timesUsed: 0, discountDistributed: 0, revenueGenerated: 0 }
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
     const ok = await showConfirm(`Apply "${bulkAction}" to ${selectedIds.length} promotions?`);
     if (ok) {
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
        <button type="button" role="tab" aria-selected={view === "all"} className={view === "all" ? "is-current" : undefined} onClick={() => setView("all")}>
          All <span className="wp-count">({promotions.length})</span>
        </button>
        <span className="wp-sep" aria-hidden="true">|</span>
        <button type="button" role="tab" aria-selected={view === "running"} className={view === "running" ? "is-current" : undefined} onClick={() => setView("running")}>
          Running <span className="wp-count">({promotions.filter(p => p.status === "Active").length})</span>
        </button>
        <span className="wp-sep" aria-hidden="true">|</span>
        <button type="button" role="tab" aria-selected={view === "paused"} className={view === "paused" ? "is-current" : undefined} onClick={() => setView("paused")}>
          Paused <span className="wp-count">({promotions.filter(p => p.adminStatus === "Paused").length})</span>
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
          <option>Duplicate</option>
          <option>Move to Trash</option>
          <option>Delete Permanently</option>
        </select>
        <button type="button" onClick={handleBulkAction} className="wp-btn">Apply</button>

        <span className="wp-spacer" />

        <div className="wp-search" role="search">
          <label htmlFor="promotions-search" className="sr-only">Search promotions</label>
          <input
            id="promotions-search"
            type="search"
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="wp-input"
          />
          <button type="button" className="wp-btn">Search promotions</button>
        </div>
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
