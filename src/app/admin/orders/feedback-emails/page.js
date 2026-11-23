"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Send, Mail } from "lucide-react";
import { toast } from "react-hot-toast";
import { Page, PageHeader, Postbox, Notice, Skeleton, timeAgo } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import { can } from "@/lib/rbac";

const STATUS = {
  sent: { label: "Sent", cls: "wp-st-paid" },
  failed: { label: "Failed", cls: "wp-st-failed" },
  test: { label: "Test", cls: "wp-st-draft" },
};
const fmt = (v) => (v ? new Date(v).toLocaleString() : "-");

export default function FeedbackEmailsPage() {
  const { data: session } = useSession();
  const { showConfirm } = usePopup();
  const canEdit = can(session?.user, "orders.update") || can(session?.user, "orders.edit");

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [testEmail, setTestEmail] = useState(null);
  const [testing, setTesting] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/feedback-emails", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) throw new Error(body.error || "Failed to load.");
      setData(body);
      setLoadError("");
    } catch (e) {
      setLoadError(e.message || "Failed to load.");
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  // Poll quickly while a campaign is running, slowly otherwise.
  const running = !!data?.progress?.running;
  useEffect(() => {
    const id = setInterval(load, running ? 3000 : 30000);
    return () => clearInterval(id);
  }, [load, running]);

  const adminEmail = session?.user?.email || "";
  const emailValue = testEmail ?? adminEmail;

  const sendTest = async (e) => {
    e.preventDefault();
    setTesting(true);
    try {
      const res = await fetch("/api/admin/feedback-emails", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test", email: emailValue }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) throw new Error(body.error || "The test could not be sent.");
      toast.success(`Test email sent to ${emailValue}.`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTesting(false);
    }
  };

  const startAll = async () => {
    const n = data?.counts?.pending || 0;
    const ok = await showConfirm(`This will email ${n} customer${n === 1 ? "" : "s"} who received a delivered order and have not been asked yet. Each customer is emailed once. Continue?`, "Send feedback emails?", { confirmText: `Send to ${n}` });
    if (!ok) return;
    setStarting(true);
    try {
      const res = await fetch("/api/admin/feedback-emails", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) throw new Error(body.error || "Could not start.");
      toast.success("Sending has started. You can leave this page.");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setStarting(false);
    }
  };

  const c = data?.counts;
  const p = data?.progress;

  return (
    <RequirePermission permission="orders.view">
      <Page>
        <PageHeader title="Feedback emails" />
        <p className="wp-desc" style={{ margin: "0 0 12px" }}>
          Asks customers whose order was Delivered to review PAIRO on Trustpilot and to post a video review on the website for 10% off their next order. Each customer is emailed once, however many orders they have.
        </p>

        {loadError && <Notice type="error" onDismiss={() => setLoadError("")}>{loadError}</Notice>}
        {data && !data.smtpConfigured && <Notice type="error">Email is not set up on the server, so nothing can be sent.</Notice>}

        <div className="wp-stats">
          <div className="wp-stat"><div className="wp-stat-label">Customers with a delivered order</div><div className="wp-stat-value">{c ? c.deliveredCustomers : "-"}</div></div>
          <div className="wp-stat"><div className="wp-stat-label">Already emailed</div><div className="wp-stat-value">{c ? c.alreadyEmailed : "-"}</div></div>
          <div className="wp-stat"><div className="wp-stat-label">Not asked yet</div><div className="wp-stat-value">{c ? c.pending : "-"}</div></div>
          <div className="wp-stat"><div className="wp-stat-label">Failed (will retry)</div><div className="wp-stat-value">{c ? c.failed : "-"}</div></div>
        </div>

        <div className="wp-cols">
          <div className="wp-col-side">
            <Postbox id="feedback-test" title="Send a test to me">
              <form onSubmit={sendTest}>
                <label className="wp-label" htmlFor="feedback-test-email">Send the sample email to</label>
                <input id="feedback-test-email" type="email" className="wp-input wp-full" value={emailValue} onChange={(e) => setTestEmail(e.target.value)} disabled={!canEdit} />
                <p className="wp-desc">Uses your latest delivered order. Nothing is marked as sent.</p>
                <div style={{ marginTop: 10 }}>
                  <button type="submit" className="wp-btn" disabled={!canEdit || testing || !emailValue}><Mail className="w-4 h-4" aria-hidden="true" /> {testing ? "Sending..." : "Send test"}</button>
                </div>
              </form>
            </Postbox>
          </div>

          <div className="wp-col-main">
            <Postbox id="feedback-send" title="Send to customers">
              {running ? (
                <p style={{ margin: 0 }}>Sending: {p.done} of {p.total} done{p.failed ? `, ${p.failed} failed` : ""}. You can leave this page.</p>
              ) : (
                <p style={{ margin: "0 0 10px" }}>{c ? `${c.pending} customer${c.pending === 1 ? "" : "s"} have not been asked yet.` : <Skeleton height={16} width="50%" />}</p>
              )}
              {!running && p?.total > 0 && <p className="wp-desc">Last run: {p.done} of {p.total} done{p.failed ? `, ${p.failed} failed` : ""}.</p>}
              <button type="button" className="wp-btn wp-btn-primary" onClick={startAll} disabled={!canEdit || running || starting || !c?.pending || !data?.smtpConfigured}>
                <Send className="w-4 h-4" aria-hidden="true" /> {c ? `Send to all ${c.pending}` : "Send"}
              </button>
            </Postbox>
          </div>
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "8px 0 8px", color: "var(--wp-text)" }}>Recent activity</h2>
        <div className="wp-table-box">
          <table className="wp-list-table">
            <thead><tr><th scope="col">When</th><th scope="col">Customer</th><th scope="col">Order</th><th scope="col">Result</th></tr></thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={4}><Skeleton height={14} width="60%" /></td></tr>
              ) : data.log.length === 0 ? (
                <tr><td colSpan={4} className="wp-muted">Nothing sent yet.</td></tr>
              ) : data.log.map((row) => {
                const st = STATUS[row.status] || { label: row.status, cls: "" };
                return (
                  <tr key={row._id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmt(row.createdAt)}<div className="wp-small wp-muted">{timeAgo(row.createdAt)}</div></td>
                    <td style={{ wordBreak: "break-all" }}>{row.email}{row.firstName && <div className="wp-small wp-muted">{row.firstName}</div>}</td>
                    <td>{row.orderNumber || "-"}</td>
                    <td><span className={`wp-pill wp-pill-sm ${st.cls}`}>{st.label}</span>{row.error && <div className="wp-small wp-muted" style={{ marginTop: 4, wordBreak: "break-word" }}>{row.error}</div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Page>
    </RequirePermission>
  );
}
