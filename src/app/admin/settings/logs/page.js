"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Page, PageHeader } from "@/components/admin/ui";
import RequirePermission from "@/components/admin/RequirePermission";

// RFC 4180 CSV cell: wrap in quotes when it contains a quote, comma or newline,
// doubling embedded quotes. Also neutralise spreadsheet formula injection.
function csvCell(value) {
  let str = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
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
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const requestSeq = useRef(0);

  const fetchLogs = async (term) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const qs = term ? `?q=${encodeURIComponent(term)}` : "";
      const res = await fetch(`/api/admin/audit-logs${qs}`);
      const data = await res.json().catch(() => null);
      if (seq !== requestSeq.current) return; // a newer search superseded this one
      if (res.ok && Array.isArray(data)) setLogs(data);
      else toast.error(data?.error || "Failed to load audit logs");
    } catch (err) {
      console.error(err);
      if (seq === requestSeq.current) toast.error("Failed to load audit logs");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchLogs(searchTerm);
    });
  }, [searchTerm]);

  // Live search (debounced); the Search button / Enter applies immediately.
  useEffect(() => {
    const term = searchInput.trim();
    if (term === searchTerm) return;
    const t = setTimeout(() => setSearchTerm(term), 400);
    return () => clearTimeout(t);
  }, [searchInput, searchTerm]);

  const runSearch = (e) => {
    e.preventDefault();
    const term = searchInput.trim();
    if (term === searchTerm) fetchLogs(term);
    else setSearchTerm(term);
  };

  const exportCsv = () => {
    if (logs.length === 0) {
      toast.error("No logs to export.");
      return;
    }
    const header = ["Time", "User", "Email", "Action", "Target", "Target ID", "Message", "IP", "User agent"];
    const rows = logs.map((log) => [
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
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const actionClass = (action) => {
    const a = action || '';
    if (a.includes('CREATE')) return 'wp-st-published';
    if (a.includes('DELETE')) return 'wp-st-cancelled';
    if (a.includes('UPDATE')) return 'wp-st-shipped';
    return 'wp-st-draft';
  };

  const headerRow = (
    <tr>
      <th scope="col">Time</th>
      <th scope="col">User</th>
      <th scope="col">Action</th>
      <th scope="col" className="wp-hide-sm">Target</th>
      <th scope="col" className="wp-hide-sm">Details</th>
    </tr>
  );

  return (
    <Page>
      <PageHeader title="Audit log" />

      <div className="wp-toolbar">
        <button type="button" className="wp-btn" onClick={exportCsv} disabled={loading || logs.length === 0}>Export logs (CSV)</button>
        <span className="wp-spacer" />
        <form className="wp-search" role="search" onSubmit={runSearch}>
          <label htmlFor="logs-search" className="sr-only">Search logs</label>
          <input
            id="logs-search"
            type="search"
            className="wp-input"
            placeholder="Search by user, action, target or message"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="wp-btn">Search Logs</button>
        </form>
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="wp-muted">Loading audit history…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="wp-muted">{searchTerm ? "No logs match your search." : "No logs found in the specified period."}</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log._id}>
                  <td className="wp-muted" style={{ whiteSpace: "nowrap" }} suppressHydrationWarning>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td style={{ wordBreak: "break-word" }}>
                    <div className="wp-strong">{log.staffId?.name}</div>
                    <div className="wp-muted wp-small" style={{ wordBreak: "break-all" }}>{log.staffId?.email}</div>
                  </td>
                  <td>
                    <span className={`wp-pill wp-pill-sm ${actionClass(log.action)}`}>{log.action}</span>
                    <div className="wp-mobile-meta">{log.resource}{log.details?.message ? ` — ${log.details.message}` : ""}</div>
                  </td>
                  <td className="wp-hide-sm">{log.resource}</td>
                  <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>
                    {log.details?.message && <div>{log.details.message}</div>}
                    {log.details?.before && (
                      <div className="wp-muted wp-small">
                        Changes recorded for {log.resource} ID: {log.details.after?.id || 'N/A'}
                      </div>
                    )}
                    {(log.ip || log.userAgent) && (
                      <div className="wp-muted wp-small" style={{ marginTop: 4 }}>
                        {log.ip}
                        {log.ip && log.userAgent ? " · " : ""}
                        {log.userAgent && (
                          <span title={log.userAgent} style={{ display: "inline-block", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>
                            {log.userAgent}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>
    </Page>
  );
}
