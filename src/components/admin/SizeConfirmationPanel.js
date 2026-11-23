"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { Ruler, Send, MessageSquareReply, CheckCircle2, RefreshCw } from "lucide-react";

const STATUS_STYLES = {
  "Awaiting Reply": "wp-st-draft",
  Replied: "wp-st-confirmed",
  Confirmed: "wp-st-delivered",
};

/**
 * Order-page panel: send the size confirmation email, see the customer's
 * replies, and record the confirmed size.
 */
export default function SizeConfirmationPanel({ orderId, customerEmail }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [chartUrl, setChartUrl] = useState("");
  const [sizeInputs, setSizeInputs] = useState({});
  const [inboxConfigured, setInboxConfigured] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/size-confirmations?orderId=${orderId}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.confirmations || []);
        setInboxConfigured(data.inboxConfigured !== false);
        const last = (data.confirmations || []).find((c) => c.sizeChartImageUrl);
        setChartUrl((prev) => prev || last?.sizeChartImageUrl || "");
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!customerEmail) return toast.error("This order has no customer email.");
    setSending(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/size-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sizeChartImageUrl: chartUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      toast.success(`Size confirmation emailed to ${customerEmail}`);
      await load();
    } catch (err) {
      toast.error(err.message || "Failed to send size confirmation");
    } finally {
      setSending(false);
    }
  };

  const checkReplies = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/admin/size-confirmations/sync?force=1", { method: "POST" });
      const data = await res.json();
      if (data.configured === false) {
        toast.error("Reply inbox not connected — set IMAP_HOST in the server environment.");
      } else if (data.error) {
        toast.error(`Could not check inbox: ${data.error}`);
      } else {
        toast.success(data.newReplies ? `${data.newReplies} new repl${data.newReplies === 1 ? "y" : "ies"}` : "No new replies");
      }
      await load();
    } finally {
      setChecking(false);
    }
  };

  const patch = async (id, payload, okMsg) => {
    const res = await fetch(`/api/admin/size-confirmations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || "Update failed");
    if (okMsg) toast.success(okMsg);
    await load();
  };

  return (
    <section className="wp-postbox" aria-labelledby={`size-confirmation-${orderId}-title`}>
      <div className="wp-postbox-head">
        <h2 id={`size-confirmation-${orderId}-title`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Ruler className="w-4 h-4" aria-hidden="true" /> Size confirmation
        </h2>
        <span className="wp-postbox-aside">
          <button
            type="button"
            onClick={checkReplies}
            disabled={checking}
            title="Check the inbox for new replies"
            aria-label="Check the inbox for new replies"
            className="wp-btn"
            style={{ minWidth: 32, padding: "0 6px" }}
          >
            <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
        </span>
      </div>

      <div className="wp-inside">
        <div className="wp-field">
          <label htmlFor={`size-chart-url-${orderId}`} className="wp-label">Extra size chart image URL</label>
          <input
            id={`size-chart-url-${orderId}`}
            type="url"
            value={chartUrl}
            onChange={(e) => setChartUrl(e.target.value)}
            placeholder="https://… (shown in the email)"
            className="wp-input wp-full"
          />
          <p className="wp-desc">Optional — the products&apos; own size charts are included automatically.</p>
        </div>

        {!inboxConfigured && (
          <div className="wp-notice wp-notice-warning" role="status" style={{ margin: "0 0 12px" }}>
            <p>Replies can&apos;t be picked up yet — add <code>IMAP_HOST</code> (and mailbox login) to the server environment.</p>
          </div>
        )}

        {loading ? (
          <p className="wp-muted" style={{ margin: 0 }}>Loading…</p>
        ) : (
          items.map((c) => (
            <div key={c._id} style={{ borderTop: "1px solid #f0f0f1", paddingTop: 10, marginTop: 10 }}>
              <div className="wp-kv">
                <span className="wp-kv-k wp-muted">Status</span>
                <span className={`wp-pill wp-pill-sm ${STATUS_STYLES[c.status] || ""}`}>{c.status}</span>
              </div>
              <div className="wp-kv">
                <span className="wp-kv-k wp-muted">{c.auto ? "Sent automatically" : "Sent"}</span>
                <span className="wp-kv-v" style={{ fontWeight: 400, textAlign: "right" }}>{new Date(c.sentAt).toLocaleString()}</span>
              </div>
              {c.chartLabels?.length > 0 && (
                <div className="wp-kv">
                  <span className="wp-kv-k wp-muted">Chart</span>
                  <span className="wp-kv-v" style={{ fontWeight: 400, textAlign: "right", wordBreak: "break-word" }}>{c.chartLabels.join(", ")}</span>
                </div>
              )}

              {c.replies?.map((r) => (
                <div key={r._id} style={{ marginTop: 10 }}>
                  <div
                    className="wp-note-body is-customer"
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", outline: r.read ? undefined : "2px solid #2271b1" }}
                  >
                    {r.text}
                  </div>
                  <div className="wp-note-meta">
                    <MessageSquareReply className="w-3 h-3" aria-hidden="true" />
                    <span>{r.fromName || r.fromEmail}</span>
                    <span>· {new Date(r.receivedAt).toLocaleString()}</span>
                    {!r.read && <span className="wp-strong">· New</span>}
                  </div>
                </div>
              ))}

              {c.status === "Confirmed" ? (
                <p style={{ margin: "10px 0 0", display: "flex", alignItems: "center", gap: 6, color: "#00a32a" }} className="wp-strong">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Confirmed size: {c.confirmedSize}
                </p>
              ) : (
                c.replies?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <label htmlFor={`confirmed-size-${c._id}`} className="wp-label">Confirmed size</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        id={`confirmed-size-${c._id}`}
                        type="text"
                        value={sizeInputs[c._id] || ""}
                        onChange={(e) => setSizeInputs((s) => ({ ...s, [c._id]: e.target.value }))}
                        placeholder="e.g. Medium"
                        className="wp-input"
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <button
                        type="button"
                        onClick={() => patch(c._id, { action: "confirm", size: sizeInputs[c._id] }, "Size confirmed")}
                        className="wp-btn wp-btn-primary"
                      >
                        Confirm
                      </button>
                    </div>
                    {c.unreadReplies > 0 && (
                      <button
                        type="button"
                        onClick={() => patch(c._id, { action: "markRead" })}
                        className="wp-link"
                        style={{ background: "none", border: 0, padding: 0, marginTop: 8, minHeight: 32, cursor: "pointer" }}
                      >
                        Mark replies as read
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
          ))
        )}
      </div>

      <div className="wp-box-foot" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
        <button
          type="button"
          onClick={send}
          disabled={sending || !customerEmail}
          className="wp-btn wp-btn-primary"
          style={{ justifyContent: "center" }}
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          {sending ? "Sending..." : items.length ? "Send Again" : "Send Size Confirmation"}
        </button>
        <p className="wp-muted wp-small" style={{ margin: 0, textAlign: "center", wordBreak: "break-word" }}>
          Emails {customerEmail || "the customer"} and tracks their reply here.
        </p>
      </div>
    </section>
  );
}
