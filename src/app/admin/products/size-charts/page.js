"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import { Page, PageHeader } from "@/components/admin/ui";

export default function AdminSizeCharts() {
  const router = useRouter();
  const { showConfirm } = usePopup();
  const [sizeCharts, setSizeCharts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All statuses");
  const [selectedAssignment, setSelectedAssignment] = useState("All assignments");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");

  // Preview Modal
  const [previewChart, setPreviewChart] = useState(null);

  const fetchSizeCharts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/size-charts");
      const data = await res.json();
      if (res.ok) {
        setSizeCharts(Array.isArray(data) ? data : []);
      } else {
        toast.error(data.error || "Failed to load size charts");
      }
    } catch (err) {
      toast.error("Error connecting to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSizeCharts();
  }, [fetchSizeCharts]);

  // Handle Delete
  const handleDelete = async (id) => {
    const ok = await showConfirm("Are you sure you want to delete this size chart?");
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/size-charts/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Size chart deleted");
        fetchSizeCharts();
      } else {
        const data = await res.json();
        toast.error(data.error || "Delete failed");
      }
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  // Handle Duplicate
  const handleDuplicate = async (chart) => {
    try {
      // Find a unique label name
      let newLabel = `${chart.label} (Copy)`;
      let suffix = 2;
      while (sizeCharts.some((c) => c.label.toLowerCase() === newLabel.toLowerCase())) {
        newLabel = `${chart.label} (Copy ${suffix})`;
        suffix++;
      }

      const copyData = {
        label: newLabel,
        publicHeading: chart.publicHeading,
        description: chart.description,
        columns: [...chart.columns],
        rows: chart.rows.map((row) => [...row]),
        status: chart.status,
        assignmentType: "none", // Reset assignment on duplication
        assignmentTargetId: null
      };

      const res = await fetch("/api/admin/size-charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copyData)
      });

      if (res.ok) {
        toast.success("Size chart duplicated successfully");
        fetchSizeCharts();
      } else {
        const data = await res.json();
        toast.error(data.error || "Duplication failed");
      }
    } catch (err) {
      toast.error("Duplication failed");
    }
  };

  // Handle Bulk Actions
  const handleBulkSubmit = async () => {
    if (selectedIds.length === 0) return toast.error("No items selected");
    if (bulkAction === "Bulk actions") return toast.error("Please select a bulk action");

    if (bulkAction === "delete") {
      const ok = await showConfirm(`Are you sure you want to bulk-delete ${selectedIds.length} size charts?`);
      if (!ok) return;
      let successes = 0;
      for (const id of selectedIds) {
        try {
          const res = await fetch(`/api/admin/size-charts/${id}`, { method: "DELETE" });
          if (res.ok) successes++;
        } catch (e) {}
      }
      toast.success(`Deleted ${successes} size charts`);
      setSelectedIds([]);
      fetchSizeCharts();
    } else if (bulkAction === "publish" || bulkAction === "draft") {
      const newStatus = bulkAction === "publish" ? "Published" : "Draft";
      let successes = 0;
      for (const id of selectedIds) {
        try {
          const res = await fetch(`/api/admin/size-charts/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
          });
          if (res.ok) successes++;
        } catch (e) {}
      }
      toast.success(`Updated ${successes} size charts to ${newStatus}`);
      setSelectedIds([]);
      fetchSizeCharts();
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredCharts.map((c) => c._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Filter & Search Logic
  const filteredCharts = sizeCharts.filter((chart) => {
    const matchesSearch =
      chart.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chart.publicHeading.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      selectedStatus === "All statuses" || chart.status === selectedStatus;

    let matchesAssignment = true;
    if (selectedAssignment === "Category") {
      matchesAssignment = chart.assignmentType === "category";
    } else if (selectedAssignment === "Product") {
      matchesAssignment = chart.assignmentType === "product";
    } else if (selectedAssignment === "Unassigned") {
      matchesAssignment = chart.assignmentType === "none" || !chart.assignmentType;
    }

    return matchesSearch && matchesStatus && matchesAssignment;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredCharts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCharts = filteredCharts.slice(startIndex, startIndex + itemsPerPage);

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const statusCounts = {
    "All statuses": sizeCharts.length,
    Published: sizeCharts.filter((c) => c.status === "Published").length,
    Draft: sizeCharts.filter((c) => c.status === "Draft").length,
  };
  const statusTabs = [
    { value: "All statuses", label: "All" },
    { value: "Published", label: "Published" },
    { value: "Draft", label: "Draft" },
  ];

  const pager = (
    <div className="wp-pages">
      <span>{filteredCharts.length} items</span>
      {totalPages > 1 && (
        <>
          <button
            type="button"
            className="wp-pager"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>{currentPage} of {totalPages}</span>
          <button
            type="button"
            className="wp-pager"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );

  return (
    <RequirePermission permission="products.view">
    <Page>
      <PageHeader
        title="Size Charts"
        actions={<Link href="/admin/products/size-charts/new" className="wp-btn">Add Size Chart</Link>}
      />
      <p className="wp-desc" style={{ marginTop: 0 }}>Manage reusable dynamic size charts and assignments.</p>

      {/* Status filter links */}
      <div className="wp-subsub" role="tablist" aria-label="Filter size charts by status">
        {statusTabs.map((t, i) => (
          <span key={t.value} style={{ display: "inline-flex", alignItems: "center" }}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={selectedStatus === t.value}
              className={selectedStatus === t.value ? "is-current" : undefined}
              onClick={() => { setSelectedStatus(t.value); setCurrentPage(1); }}
            >
              {t.label} <span className="wp-count">({statusCounts[t.value]})</span>
            </button>
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="wp-toolbar">
        <label htmlFor="sc-bulk-action" className="sr-only">Select bulk action</label>
        <select
          id="sc-bulk-action"
          value={bulkAction}
          onChange={(e) => setBulkAction(e.target.value)}
          className="wp-select"
        >
          <option>Bulk actions</option>
          <option value="publish">Publish</option>
          <option value="draft">Move to Draft</option>
          <option value="delete">Delete</option>
        </select>
        <button type="button" onClick={handleBulkSubmit} className="wp-btn">
          Apply
        </button>

        <label htmlFor="sc-assignment" className="sr-only">Filter by assignment</label>
        <select
          id="sc-assignment"
          value={selectedAssignment}
          onChange={(e) => { setSelectedAssignment(e.target.value); setCurrentPage(1); }}
          className="wp-select"
        >
          <option>All assignments</option>
          <option>Category</option>
          <option>Product</option>
          <option>Unassigned</option>
        </select>

        <span className="wp-spacer" />

        <div className="wp-search" role="search">
          <label htmlFor="sc-search" className="sr-only">Search size charts</label>
          <input
            id="sc-search"
            type="search"
            placeholder="Search size charts..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="wp-input"
          />
        </div>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pager}
      </div>

      {/* Table */}
      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>
            <tr>
              <th scope="col" className="wp-check-col">
                <input
                  type="checkbox"
                  aria-label="Select all size charts"
                  onChange={handleSelectAll}
                  checked={selectedIds.length > 0 && selectedIds.length === filteredCharts.length}
                />
              </th>
              <th scope="col">Label</th>
              <th scope="col" className="wp-hide-sm">Assigned to</th>
              <th scope="col" className="wp-hide-sm wp-num">Products using</th>
              <th scope="col" className="wp-hide-sm">Last updated</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="wp-muted">Loading size charts…</td></tr>
            ) : paginatedCharts.length === 0 ? (
              <tr>
                <td colSpan={6} className="wp-muted">
                  No size charts found. <Link href="/admin/products/size-charts/new" className="wp-link">Create one now</Link>
                </td>
              </tr>
            ) : (
              paginatedCharts.map((chart) => {
                const isChecked = selectedIds.includes(chart._id);
                return (
                  <tr key={chart._id} className={isChecked ? "is-selected" : undefined}>
                    <td className="wp-check-col">
                      <input
                        type="checkbox"
                        aria-label={`Select ${chart.label}`}
                        checked={isChecked}
                        onChange={() => handleSelectOne(chart._id)}
                      />
                    </td>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      <Link href={`/admin/products/size-charts/${chart._id}`} className="wp-row-title">
                        {chart.label}
                      </Link>
                      <div className="wp-muted wp-small">Heading: &ldquo;{chart.publicHeading}&rdquo;</div>
                      <div className="wp-mobile-meta">
                        {chart.assignedTo ? `${chart.assignedTo.type}: ${chart.assignedTo.name}` : "Unassigned"} · {chart.usageCount} products
                      </div>
                      <div className="wp-row-actions">
                        <span><Link href={`/admin/products/size-charts/${chart._id}`}>Edit</Link></span>
                        <span><button type="button" onClick={() => setPreviewChart(chart)}>Preview</button></span>
                        <span><button type="button" onClick={() => handleDuplicate(chart)}>Duplicate</button></span>
                        <span><button type="button" onClick={() => handleDelete(chart._id)} className="is-danger">Delete</button></span>
                      </div>
                    </td>
                    <td className="wp-hide-sm">
                      {chart.assignedTo ? (
                        <>
                          <span className="wp-muted" style={{ textTransform: "capitalize" }}>{chart.assignedTo.type}: </span>
                          <span>{chart.assignedTo.name}</span>
                        </>
                      ) : (
                        <span className="wp-muted">Unassigned</span>
                      )}
                    </td>
                    <td className="wp-hide-sm wp-num">{chart.usageCount}</td>
                    <td className="wp-hide-sm wp-muted">{formatDate(chart.updatedAt)}</td>
                    <td>
                      <span className={`wp-pill wp-pill-sm ${chart.status === "Published" ? "wp-st-published" : "wp-st-draft"}`}>
                        {chart.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pager}
      </div>

      {/* Preview Modal */}
      {previewChart && (
        <div className="wp-modal-backdrop" onClick={() => setPreviewChart(null)}>
          <div
            className="wp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sc-preview-title"
            style={{ maxWidth: 720 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wp-modal-head">
              <h2 id="sc-preview-title" style={{ minWidth: 0, wordBreak: "break-word" }}>{previewChart.publicHeading}</h2>
              <button
                type="button"
                onClick={() => setPreviewChart(null)}
                className="wp-notice-dismiss"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="wp-modal-body">
              {previewChart.description && (
                <p className="wp-desc" style={{ marginTop: 0, marginBottom: 12 }}>{previewChart.description}</p>
              )}
              <div className="wp-table-box">
                <table className="wp-list-table">
                  <thead>
                    <tr>
                      {previewChart.columns.map((col, idx) => (
                        <th key={idx} scope="col" style={{ whiteSpace: "nowrap" }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewChart.rows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className={cellIdx === 0 ? "wp-strong" : undefined}>
                            {cell || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="wp-modal-foot">
              <button type="button" className="wp-btn" onClick={() => setPreviewChart(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </Page>
    </RequirePermission>
  );
}
