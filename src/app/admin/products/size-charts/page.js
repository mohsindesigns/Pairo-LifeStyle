"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import { Page, PageHeader, Notice, Skeleton, formatDate } from "@/components/admin/ui";

const PER_PAGE = 20;
const VIEWS = [
  { value: "all", label: "All" },
  { value: "Published", label: "Published" },
  { value: "Draft", label: "Drafts" },
  { value: "trash", label: "Trash" },
];

const errorOf = async (res) => (await res.json().catch(() => ({}))).error || `Request failed (${res.status})`;

export default function AdminSizeCharts() {
  const router = useRouter();
  const { showConfirm } = usePopup();
  const [sizeCharts, setSizeCharts] = useState([]);
  const [trashedCharts, setTrashedCharts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState("All assignments");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  const [previewChart, setPreviewChart] = useState(null);

  const fetchSizeCharts = useCallback(async () => {
    setLoading(true);
    try {
      const [res, trashRes] = await Promise.all([
        fetch("/api/admin/size-charts"),
        fetch("/api/admin/size-charts?trash=true"),
      ]);
      const [data, trashData] = await Promise.all([
        res.json().catch(() => ({})),
        trashRes.json().catch(() => ({})),
      ]);
      if (res.ok) setSizeCharts(Array.isArray(data) ? data : []);
      if (trashRes.ok) setTrashedCharts(Array.isArray(trashData) ? trashData : []);
      if (!res.ok || !trashRes.ok) setLoadError((!res.ok ? data?.error : trashData?.error) || "Failed to load size charts.");
      else setLoadError("");
    } catch {
      setLoadError("Could not reach the server to load size charts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchSizeCharts());
  }, [fetchSizeCharts]);

  // Typing filters live (debounced); Search / Enter applies immediately.
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ---- API calls ----
  const trashChart = (id) => fetch(`/api/admin/size-charts/${id}`, { method: "DELETE" });
  const deletePermanently = (id) => fetch(`/api/admin/size-charts/${id}?mode=permanent`, { method: "DELETE" });
  const patchChart = (id, body) => fetch(`/api/admin/size-charts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const restoreChart = (id) => patchChart(id, { isDeleted: false });
  const duplicateChart = (id) => fetch(`/api/admin/size-charts/${id}/duplicate`, { method: "POST" });

  const runSingle = async (fn, okMsg, failMsg) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res.ok) toast.success(okMsg);
      else toast.error(`${failMsg}: ${await errorOf(res)}`);
    } catch {
      toast.error(failMsg);
    } finally {
      setBusy(false);
      fetchSizeCharts();
    }
  };

  const handleTrash = async (chart) => {
    const used = chart.usageCount || chart.assignedTo;
    const ok = await showConfirm(
      `Move "${chart.label}" to the trash?${used ? " Products and categories using it will show no size chart until you restore it." : ""} You can restore it from the Trash view.`,
      "Move to Trash",
      { confirmText: "Move to Trash" }
    );
    if (!ok) return;
    runSingle(() => trashChart(chart._id), `"${chart.label}" moved to the trash`, "Could not move to trash");
  };

  const handleRestore = (chart) =>
    runSingle(() => restoreChart(chart._id), `"${chart.label}" restored`, "Could not restore");

  const handlePermanentDelete = async (chart) => {
    const ok = await showConfirm(
      `Permanently delete "${chart.label}"? This cannot be undone.`,
      "Delete permanently",
      { confirmText: "Delete permanently", danger: true }
    );
    if (!ok) return;
    runSingle(() => deletePermanently(chart._id), `"${chart.label}" deleted permanently`, "Could not delete");
  };

  const handleDuplicate = async (chart) => {
    setBusy(true);
    try {
      const res = await duplicateChart(chart._id);
      if (!res.ok) {
        toast.error(`Could not duplicate: ${await errorOf(res)}`);
        return;
      }
      const copy = await res.json();
      toast.success(`Duplicated as "${copy.label}" (draft)`);
      router.push(`/admin/products/size-charts/${copy._id}`);
    } catch {
      toast.error("Could not duplicate");
    } finally {
      setBusy(false);
    }
  };

  const allSource = view === "trash" ? trashedCharts : sizeCharts;

  const handleBulkSubmit = async () => {
    if (bulkAction === "Bulk actions") return toast.error("Choose a bulk action first");
    if (selectedIds.length === 0) return toast.error("Select at least one size chart");
    const count = selectedIds.length;
    const noun = `size chart${count === 1 ? "" : "s"}`;
    const isPermanent = bulkAction === "Delete Permanently";
    const ok = await showConfirm(
      isPermanent ? `Permanently delete ${count} ${noun}? This cannot be undone.` : `${bulkAction}: ${count} ${noun}?`,
      isPermanent ? "Delete permanently" : bulkAction,
      isPermanent ? { confirmText: "Delete permanently", danger: true } : { confirmText: bulkAction }
    );
    if (!ok) return;

    setBusy(true);
    let done = 0;
    let failed = 0;
    for (const id of selectedIds) {
      try {
        let res;
        if (bulkAction === "Publish") res = await patchChart(id, { status: "Published" });
        else if (bulkAction === "Move to Draft") res = await patchChart(id, { status: "Draft" });
        else if (bulkAction === "Move to Trash") res = await trashChart(id);
        else if (bulkAction === "Duplicate") res = await duplicateChart(id);
        else if (bulkAction === "Restore") res = await restoreChart(id);
        else if (bulkAction === "Delete Permanently") res = await deletePermanently(id);
        if (res?.ok) done += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
    setSelectedIds([]);
    setBulkAction("Bulk actions");
    setBusy(false);
    await fetchSizeCharts();
    if (failed === 0) toast.success(`${bulkAction}: ${done} done`);
    else toast.error(`${bulkAction}: ${done} done, ${failed} failed`);
  };

  // Changing view, page or filters clears the selection so bulk actions only
  // ever apply to rows the admin can actually see.
  const changeView = (next) => {
    setView(next);
    setCurrentPage(1);
    setSelectedIds([]);
    setBulkAction("Bulk actions");
  };

  // ---- filtering / paging ----
  const term = searchTerm.trim().toLowerCase();
  const filteredCharts = allSource.filter((chart) => {
    if ((view === "Published" || view === "Draft") && chart.status !== view) return false;
    if (term && !(
      (chart.label || "").toLowerCase().includes(term) ||
      (chart.publicHeading || "").toLowerCase().includes(term)
    )) return false;
    if (selectedAssignment === "Category") return chart.assignmentType === "category";
    if (selectedAssignment === "Product") return chart.assignmentType === "product";
    if (selectedAssignment === "Unassigned") return chart.assignmentType === "none" || !chart.assignmentType;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredCharts.length / PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const paginatedCharts = filteredCharts.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const goToPage = (n) => {
    setSelectedIds([]);
    setCurrentPage(Math.min(Math.max(1, n), totalPages));
  };

  const counts = {
    all: sizeCharts.length,
    Published: sizeCharts.filter((c) => c.status === "Published").length,
    Draft: sizeCharts.filter((c) => c.status === "Draft").length,
    trash: trashedCharts.length,
  };

  const allSelected = paginatedCharts.length > 0 && paginatedCharts.every((c) => selectedIds.includes(c._id));
  const someSelected = paginatedCharts.some((c) => selectedIds.includes(c._id));
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : paginatedCharts.map((c) => c._id));
  const toggleSelect = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const assignmentText = (chart) =>
    chart.assignedTo
      ? `${chart.assignedTo.type}: ${chart.assignedTo.name}${chart.assignedTo.trashed ? " (in trash)" : ""}`
      : "Unassigned";

  const pager = (
    <div className="wp-pages">
      <span>{filteredCharts.length} item{filteredCharts.length === 1 ? "" : "s"}</span>
      {totalPages > 1 && (
        <>
          <button type="button" className="wp-pager" aria-label="First page" disabled={page <= 1} onClick={() => goToPage(1)}><ChevronsLeft className="w-4 h-4" /></button>
          <button type="button" className="wp-pager" aria-label="Previous page" disabled={page <= 1} onClick={() => goToPage(page - 1)}><ChevronLeft className="w-4 h-4" /></button>
          <span>{page} of {totalPages}</span>
          <button type="button" className="wp-pager" aria-label="Next page" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}><ChevronRight className="w-4 h-4" /></button>
          <button type="button" className="wp-pager" aria-label="Last page" disabled={page >= totalPages} onClick={() => goToPage(totalPages)}><ChevronsRight className="w-4 h-4" /></button>
        </>
      )}
    </div>
  );

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input
          type="checkbox"
          aria-label="Select all size charts"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={toggleSelectAll}
        />
      </th>
      <th scope="col">Label</th>
      <th scope="col" className="wp-hide-sm" style={{ width: "24%" }}>Assigned to</th>
      <th scope="col" className="wp-hide-sm wp-num" style={{ width: 120 }}>Products using</th>
      <th scope="col" className="wp-hide-sm" style={{ width: 130 }}>{view === "trash" ? "Trashed" : "Last updated"}</th>
      <th scope="col" style={{ width: 110 }}>Status</th>
    </tr>
  );

  const emptyText = term || selectedAssignment !== "All assignments"
    ? "No size charts match your filters."
    : view === "trash"
      ? "The trash is empty."
      : view === "Draft"
        ? "No draft size charts."
        : view === "Published"
          ? "No published size charts."
          : "No size charts yet.";

  return (
    <RequirePermission permission="products.view">
    <Page>
      <PageHeader
        title="Size Charts"
        actions={<Link href="/admin/products/size-charts/new" className="wp-btn">Add new size chart</Link>}
      />
      <p className="wp-desc" style={{ marginTop: 0 }}>Reusable measurement tables. Assign one to a category (its products inherit it) or to a single product.</p>

      {loadError && <Notice type="error" onDismiss={() => setLoadError("")}>{loadError}</Notice>}

      <div className="wp-subsub" role="tablist" aria-label="Filter size charts by status">
        {VIEWS.map((v, i) => (
          <React.Fragment key={v.value}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={view === v.value}
              className={view === v.value ? "is-current" : undefined}
              onClick={() => changeView(v.value)}
            >
              {v.label} <span className="wp-count">({counts[v.value]})</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="wp-toolbar">
        <label htmlFor="sc-bulk-action" className="sr-only">Select bulk action</label>
        <select id="sc-bulk-action" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="wp-select">
          <option>Bulk actions</option>
          {view === "trash" ? (
            <>
              <option>Restore</option>
              <option>Delete Permanently</option>
            </>
          ) : (
            <>
              <option>Publish</option>
              <option>Move to Draft</option>
              <option>Duplicate</option>
              <option>Move to Trash</option>
            </>
          )}
        </select>
        <button type="button" onClick={handleBulkSubmit} className="wp-btn" disabled={busy}>Apply</button>

        <label htmlFor="sc-assignment" className="sr-only">Filter by assignment</label>
        <select
          id="sc-assignment"
          value={selectedAssignment}
          onChange={(e) => { setSelectedAssignment(e.target.value); goToPage(1); }}
          className="wp-select"
        >
          <option>All assignments</option>
          <option>Category</option>
          <option>Product</option>
          <option>Unassigned</option>
        </select>

        <span className="wp-spacer" />

        <form className="wp-search" role="search" onSubmit={(e) => { e.preventDefault(); setSearchTerm(searchInput); goToPage(1); }}>
          <label htmlFor="sc-search" className="sr-only">Search size charts</label>
          <input
            id="sc-search"
            type="search"
            placeholder="Search size charts..."
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setCurrentPage(1); }}
            className="wp-input"
          />
          <button type="submit" className="wp-btn">Search size charts</button>
        </form>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pager}
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading && allSource.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td className="wp-check-col"><Skeleton height={16} width={16} /></td>
                  <td><Skeleton width="60%" /><Skeleton width="35%" height={12} style={{ marginTop: 6 }} /></td>
                  <td className="wp-hide-sm"><Skeleton width="70%" /></td>
                  <td className="wp-hide-sm wp-num"><Skeleton width={24} style={{ marginLeft: "auto" }} /></td>
                  <td className="wp-hide-sm"><Skeleton width="80%" /></td>
                  <td><Skeleton width={70} /></td>
                </tr>
              ))
            ) : paginatedCharts.length === 0 ? (
              <tr>
                <td colSpan={6} className="wp-muted" style={{ padding: 20, textAlign: "center" }}>
                  {emptyText}
                  {view === "all" && !term && selectedAssignment === "All assignments" && (
                    <> <Link href="/admin/products/size-charts/new" className="wp-link">Create one now</Link>.</>
                  )}
                </td>
              </tr>
            ) : (
              paginatedCharts.map((chart) => {
                const isChecked = selectedIds.includes(chart._id);
                const editHref = `/admin/products/size-charts/${chart._id}`;
                return (
                  <tr key={chart._id} className={isChecked ? "is-selected" : undefined}>
                    <td className="wp-check-col">
                      <input type="checkbox" aria-label={`Select ${chart.label}`} checked={isChecked} onChange={() => toggleSelect(chart._id)} />
                    </td>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      {view === "trash" ? (
                        <span className="wp-row-title">{chart.label}</span>
                      ) : (
                        <Link href={editHref} className="wp-row-title">{chart.label}</Link>
                      )}
                      <div className="wp-muted wp-small">Heading: &ldquo;{chart.publicHeading}&rdquo;</div>
                      <div className="wp-mobile-meta">
                        {assignmentText(chart)} · {chart.usageCount || 0} product{chart.usageCount === 1 ? "" : "s"}
                      </div>
                      {view === "trash" ? (
                        <div className="wp-row-actions">
                          <span><button type="button" disabled={busy} onClick={() => handleRestore(chart)}>Restore</button></span>
                          <span><button type="button" disabled={busy} className="is-danger" style={{ whiteSpace: "nowrap" }} onClick={() => handlePermanentDelete(chart)}>Delete permanently</button></span>
                        </div>
                      ) : (
                        <div className="wp-row-actions">
                          <span><Link href={editHref}>Edit</Link></span>
                          <span><button type="button" onClick={() => setPreviewChart(chart)}>Preview</button></span>
                          <span><button type="button" disabled={busy} onClick={() => handleDuplicate(chart)}>Duplicate</button></span>
                          <span><button type="button" disabled={busy} className="is-danger" onClick={() => handleTrash(chart)}>Trash</button></span>
                        </div>
                      )}
                    </td>
                    <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>
                      {chart.assignedTo ? (
                        <>
                          <span className="wp-muted">{chart.assignedTo.type}: </span>
                          <span>{chart.assignedTo.name}</span>
                          {chart.assignedTo.trashed && <span className="wp-muted"> (in trash)</span>}
                        </>
                      ) : (
                        <span className="wp-muted">Unassigned</span>
                      )}
                    </td>
                    <td className="wp-hide-sm wp-num">{chart.usageCount || 0}</td>
                    <td className="wp-hide-sm wp-muted">
                      {formatDate(view === "trash" ? (chart.deletedAt || chart.updatedAt) : chart.updatedAt)}
                    </td>
                    <td>
                      <span className={`wp-pill wp-pill-sm ${chart.status === "Published" ? "wp-st-published" : "wp-st-draft"}`}>
                        {chart.status || "Published"}
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
              <button type="button" onClick={() => setPreviewChart(null)} className="wp-notice-dismiss" aria-label="Close preview">
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
                      {(previewChart.columns || []).map((col, idx) => (
                        <th key={idx} scope="col" style={{ whiteSpace: "nowrap" }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(previewChart.rows || []).map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className={cellIdx === 0 ? "wp-strong" : undefined}>{cell || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="wp-modal-foot">
              <Link href={`/admin/products/size-charts/${previewChart._id}`} className="wp-btn">Edit</Link>
              <button type="button" className="wp-btn wp-btn-primary" onClick={() => setPreviewChart(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </Page>
    </RequirePermission>
  );
}
