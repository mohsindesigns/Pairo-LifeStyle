"use client";

import { useEffect, useState } from "react";
import { Page, PageHeader } from "@/components/admin/ui";
import RequirePermission from "@/components/admin/RequirePermission";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/admin/audit-logs");
      const data = await res.json();
      if (res.ok) setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchLogs();
    });
  }, []);

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
    <RequirePermission permission="settings.view">
    <Page>
      <PageHeader title="Audit log" />

      <div className="wp-toolbar">
        <button type="button" className="wp-btn">Export logs (CSV)</button>
        <span className="wp-spacer" />
        <div className="wp-search" role="search">
          <label htmlFor="logs-search" className="sr-only">Search logs</label>
          <input
            id="logs-search"
            type="search"
            className="wp-input"
            placeholder="Search by action, user or resource"
          />
        </div>
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="wp-muted">Loading audit history…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="wp-muted">No logs found in the specified period.</td></tr>
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
    </RequirePermission>
  );
}
