"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Page, PageHeader, Notice, Skeleton } from "@/components/admin/ui";
import RequirePermission from "@/components/admin/RequirePermission";
import ThemedSelect from "@/components/ui/ThemedSelect";

// RFC 4180 CSV cell: wrap in quotes when it contains a quote, comma or newline,
// doubling embedded quotes. Also neutralise spreadsheet formula injection.
function csvCell(value) {
  let str = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const EMPTY_FILTERS = { action: "", resource: "", from: "", to: "" };

const prettyAction = (a) => String(a || "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

function actionClass(action) {
  const a = action || "";
  if (a.includes("DELETE") || a.includes("TRASH")) return "wp-st-cancelled";
  if (a.includes("CREATE") || a.includes("RESTORE")) return "wp-st-published";
  if (a.includes("UPDATE")) return "wp-st-shipped";
  return "wp-st-draft";
}

function formatTime(value) {
  const d = new Date(value);
  return isNaN(d) ? "" : d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function buildQuery(term, filters, page, extra = {}) {
  const qs = new URLSearchParams();
  if (term) qs.set("q", term);
  Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v); });
  qs.set("page", String(page));
  Object.entries(extra).forEach(([k, v]) => qs.set(k, v));
  return qs.toString();
}

export default function AuditLogs() {
  return (
    <RequirePermission permission="settings.view">
      <AuditLogsView />
    </RequirePermission>
  );
}

function AuditLogsView() {
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [facets, setFacets] = useState({ actions: [], resources: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [term, setTerm] = useState("");
  const [draft, setDraft] = useState(EMPTY_FILTERS); // filter controls (applied on "Filter")
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const requestSeq = useRef(0);

  const fetchLogs = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit-logs?${buildQuery(term, filters, page)}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (seq !== requestSeq.current) return; // a newer request superseded this one
      if (!res.ok || !data || !Array.isArray(data.logs)) throw new Error(data?.error || "Failed to load audit logs");
      setLogs(data.logs);
      setMeta({ total: data.total, page: data.page, pages: data.pages });
      if (data.facets) setFacets(data.facets);
      setError("");
    } catch (err) {
      if (seq === requestSeq.current) setError(err.message || "Failed to load audit logs");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [term, filters, page]);

  useEffect(() => {
    Promise.resolve().then(fetchLogs);
  }, [fetchLogs]);

  // Live search (debounced); the Search button / Enter applies immediately.
  useEffect(() => {
    const next = searchInput.trim();
    if (next === term) return;
    const t = setTimeout(() => { setTerm(next); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput, term]);

  const runSearch = (e) => {
    e.preventDefault();
    const next = searchInput.trim();
    setPage(1);
    if (next === term) fetchLogs();
    else setTerm(next);
  };

  const applyFilters = (e) => {
    e?.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) return toast.error("The start date is after the end date.");
    setFilters(draft);
    setPage(1);
  };

  const resetFilters = () => {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setSearchInput("");
    setTerm("");
    setPage(1);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/audit-logs?${buildQuery(term, filters, 1, { export: "1" })}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data?.logs)) throw new Error(data?.error || "Export failed");
      if (data.logs.length === 0) return toast.error("No logs to export.");
      const header = ["Time", "User", "Email", "Action", "Target", "Target ID", "Message", "IP", "User agent"];
      const rows = data.logs.map((log) => [
        log.timestamp ? new Date(log.timestamp).toISOString() : "",
        log.staffId?.name,
        log.staffId?.email,
        log.action,
        log.resource,
        log.resourceId,
        log.details?.message,
        log.ip,
        log.userAgent,
      ]);
      const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      if (data.total > data.logs.length) toast.success(`Exported the latest ${data.logs.length} of ${data.total} logs.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = term || Object.values(filters).some(Boolean);
  const pager = meta.pages > 1 && (
    <span className="wp-pages">
      <button type="button" className="wp-pager" onClick={() => setPage(1)} disabled={meta.page <= 1 || loading} aria-label="First page">«</button>
      <button type="button" className="wp-pager" onClick={() => setPage(meta.page - 1)} disabled={meta.page <= 1 || loading} aria-label="Previous page">‹</button>
      <span>{meta.page} of {meta.pages}</span>
      <button type="button" className="wp-pager" onClick={() => setPage(meta.page + 1)} disabled={meta.page >= meta.pages || loading} aria-label="Next page">›</button>
      <button type="button" className="wp-pager" onClick={() => setPage(meta.pages)} disabled={meta.page >= meta.pages || loading} aria-label="Last page">»</button>
    </span>
  );

  const headerRow = (
    <tr>
      <th scope="col">Action</th>
      <th scope="col" className="wp-hide-sm">User</th>
      <th scope="col" className="wp-hide-sm">Target</th>
      <th scope="col" className="wp-hide-sm" style={{ width: 180 }}>Date</th>
    </tr>
  );

  return (
    <Page>
      <PageHeader
        title="Audit log"
        actions={
          <button type="button" className="wp-btn" onClick={exportCsv} disabled={exporting || loading || meta.total === 0}>
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        }
      />
      <p className="wp-muted" style={{ margin: "0 0 6px" }}>
        A read-only record of changes made by staff. Newest first.
      </p>

      {error && <Notice type="error">{error}</Notice>}

      <form className="wp-toolbar" onSubmit={applyFilters} aria-label="Filter audit log">
        <label htmlFor="logs-action" className="sr-only">Action</label>
        <ThemedSelect id="logs-action" className="wp-select w-full sm:w-auto" value={draft.action} onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}>
          <option value="">All actions</option>
          {facets.actions.map((a) => <option key={a} value={a}>{prettyAction(a)}</option>)}
        </ThemedSelect>
        <label htmlFor="logs-resource" className="sr-only">Target</label>
        <ThemedSelect id="logs-resource" className="wp-select w-full sm:w-auto" value={draft.resource} onChange={(e) => setDraft((d) => ({ ...d, resource: e.target.value }))}>
          <option value="">All targets</option>
          {facets.resources.map((r) => <option key={r} value={r}>{r}</option>)}
        </ThemedSelect>
        <div className="flex items-center gap-2 w-full sm:w-auto">
        <label htmlFor="logs-from" className="sr-only">From date</label>
        <input id="logs-from" type="date" className="wp-input flex-1 min-w-0 sm:flex-none" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} aria-label="From date" />
        <span className="wp-muted" aria-hidden="true">–</span>
        <label htmlFor="logs-to" className="sr-only">To date</label>
        <input id="logs-to" type="date" className="wp-input flex-1 min-w-0 sm:flex-none" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} aria-label="To date" />
        </div>
        <button type="submit" className="wp-btn">Filter</button>
        {hasFilters && <button type="button" className="wp-btn" onClick={resetFilters}>Reset</button>}
      </form>

      <div className="wp-toolbar">
        <span className="wp-muted">{meta.total} item{meta.total === 1 ? "" : "s"}</span>
        <span className="wp-spacer" />
        <form className="wp-search" role="search" onSubmit={runSearch}>
          <label htmlFor="logs-search" className="sr-only">Search logs</label>
          <input
            id="logs-search"
            type="search"
            className="wp-input"
            placeholder="Search user, action, target or message"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ minWidth: 0, width: 280 }}
          />
          <button type="submit" className="wp-btn">Search logs</button>
        </form>
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading && logs.length === 0 ? (
              [0, 1, 2, 3].map((i) => <tr key={i}><td colSpan={4}><Skeleton height={18} width={i % 2 ? "55%" : "80%"} /></td></tr>)
            ) : logs.length === 0 ? (
              <tr><td colSpan={4} className="wp-muted">{hasFilters ? "No logs match these filters." : "No activity has been logged yet."}</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log._id} style={loading ? { opacity: 0.6 } : undefined}>
                  <td style={{ wordBreak: "break-word" }}>
                    <span className={`wp-pill wp-pill-sm ${actionClass(log.action)}`}>{prettyAction(log.action)}</span>
                    {log.details?.message && <div style={{ marginTop: 4 }}>{log.details.message}</div>}
                    <div className="wp-mobile-meta">
                      {[log.staffId?.name || log.staffId?.email || "Unknown user", log.resource, formatTime(log.timestamp)].filter(Boolean).join(" · ")}
                    </div>
                    {(log.ip || log.userAgent) && (
                      <div className="wp-muted wp-small wp-hide-sm" style={{ marginTop: 4 }}>
                        {log.ip}
                        {log.ip && log.userAgent ? " · " : ""}
                        {log.userAgent && (
                          <span title={log.userAgent} style={{ display: "inline-block", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>
                            {log.userAgent}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>
                    <div className="wp-strong">{log.staffId?.name || "Unknown user"}</div>
                    {log.staffId?.email && <div className="wp-muted wp-small" style={{ wordBreak: "break-all" }}>{log.staffId.email}</div>}
                  </td>
                  <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>
                    {log.resource || "—"}
                    {log.resourceId && <div className="wp-muted wp-small" style={{ wordBreak: "break-all" }}>ID: {log.resourceId}</div>}
                  </td>
                  <td className="wp-hide-sm wp-muted" suppressHydrationWarning>{formatTime(log.timestamp)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pager}
      </div>
    </Page>
  );
}
