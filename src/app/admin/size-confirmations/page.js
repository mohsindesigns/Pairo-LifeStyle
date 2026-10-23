"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { RefreshCw } from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";

const STATUS_STYLES = {
  "Awaiting Reply": "wp-st-draft",
  Replied: "wp-st-confirmed",
  Confirmed: "wp-st-delivered",
};

const FILTERS = ["All", "Replied", "Awaiting Reply", "Confirmed"];

export default function SizeConfirmationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [filter, setFilter] = useState("All");
  const [inboxConfigured, setInboxConfigured] = useState(true);

  const load = useCallback(async () => {
    try {
      const qs = filter === "All" ? "" : `?status=${encodeURIComponent(filter)}`;
      const res = await fetch(`/api/admin/size-confirmations${qs}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.confirmations || []);
        setInboxConfigured(data.inboxConfigured !== false);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const checkReplies = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/admin/size-confirmations/sync?force=1", { method: "POST" });
      const data = await res.json();
      if (data.configured === false) toast.error("Reply inbox not connected — set IMAP_HOST in the server environment.");
      else if (data.error) toast.error(`Could not check inbox: ${data.error}`);
      else toast.success(data.newReplies ? `${data.newReplies} new repl${data.newReplies === 1 ? "y" : "ies"}` : "No new replies");
      await load();
    } finally {
      setChecking(false);
    }
  };

  const headerRow = (
    <tr>
      <th scope="col">Order</th>
      <th scope="col" className="wp-hide-sm">Customer</th>
      <th scope="col" className="wp-hide-sm">Sent</th>
      <th scope="col">Status</th>
      <th scope="col" className="wp-hide-sm">Latest reply</th>
      <th scope="col">Size</th>
    </tr>
  );

  return (
    <AdminPageLayout
      title="Size Confirmations"
      subtitle="Emails sent to customers to confirm jacket sizes, and their replies"
      breadcrumbs={[{ label: "Size Confirmations" }]}
    >
      <div className="wp-subsub" role="tablist" aria-label="Filter size confirmations by status">
        {FILTERS.map((f, i) => (
          <React.Fragment key={f}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={filter === f ? "is-current" : undefined}
            >
              {f}
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <button type="button" onClick={checkReplies} disabled={checking} className="wp-btn">
          <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} aria-hidden="true" /> Check for replies
        </button>
      </div>

      {!inboxConfigured && (
        <div className="wp-notice wp-notice-warning" role="status">
          <p>
            Replies can&apos;t be picked up yet — add <code>IMAP_HOST</code> (plus <code>IMAP_USER</code> / <code>IMAP_PASS</code>) to the server environment.
          </p>
        </div>
      )}

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="wp-muted">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="wp-muted">Nothing here yet. Send a size confirmation from an order page.</td></tr>
            ) : (
              items.map((c) => {
                const last = c.replies?.[c.replies.length - 1];
                return (
                  <tr key={c._id} className={c.unreadReplies > 0 ? "is-selected" : undefined}>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      <Link href={`/admin/orders/${c.orderId}`} className="wp-row-title">
                        #{c.orderNumber}
                      </Link>
                      <div className="wp-mobile-meta">
                        {c.customerName || "—"}
                        {c.customerEmail ? ` · ${c.customerEmail}` : ""}
                        <br />
                        {new Date(c.sentAt).toLocaleString()}
                      </div>
                      <div className="wp-row-actions">
                        <span><Link href={`/admin/orders/${c.orderId}`}>View order</Link></span>
                      </div>
                    </td>
                    <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>
                      <div className="wp-strong">{c.customerName || "—"}</div>
                      <div className="wp-muted wp-small">{c.customerEmail}</div>
                    </td>
                    <td className="wp-hide-sm wp-muted" style={{ whiteSpace: "nowrap" }}>{new Date(c.sentAt).toLocaleString()}</td>
                    <td>
                      <span className={`wp-pill ${STATUS_STYLES[c.status] || ""}`}>
                        {c.status}
                      </span>
                      {c.unreadReplies > 0 && (
                        <span className="wp-pill wp-pill-sm wp-st-failed" style={{ marginLeft: 6 }}>
                          {c.unreadReplies} new
                        </span>
                      )}
                    </td>
                    <td className="wp-hide-sm" style={{ maxWidth: 320 }}>
                      {last ? <span className="line-clamp-2">{last.text}</span> : <span className="wp-muted">—</span>}
                    </td>
                    <td className="wp-strong">{c.confirmedSize || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>
    </AdminPageLayout>
  );
}
