"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, Download, RefreshCw, Send } from "lucide-react";
import { toast } from "react-hot-toast";
import { Page, PageHeader, Postbox, Notice, Skeleton, formatMoney, timeAgo } from "@/components/admin/ui";
import RequirePermission from "@/components/admin/RequirePermission";
import { can } from "@/lib/rbac";

const VIEWS = [
  { value: "all", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
  { value: "gave-up", label: "Gave up" },
];

const STATUS = {
  sent: { label: "Sent", cls: "wp-st-paid" },
  failed: { label: "Failed", cls: "wp-st-failed" },
  skipped: { label: "Skipped", cls: "wp-st-draft" },
  "gave-up": { label: "Gave up", cls: "wp-st-failed" },
};

const REASONS = {
  "order-exists": "The shopper already placed an order",
  "invalid-email": "The cart has no valid email address",
  "send-error": "The mail server could not send it",
  "logged-before-activity-tracking": "Sent before activity tracking was added",
};

const TRIGGERS = { scheduler: "Automatic", cron: "Server cron", manual: "Manual" };

const fmtDateTime = (v) => (v ? new Date(v).toLocaleString() : "-");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

async function readError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export default function RecoveryEmailsPage() {
  const { data: session } = useSession();
  const canEdit = can(session?.user, "orders.update") || can(session?.user, "orders.edit");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const searchTimer = useRef(null);
  const pageRef = useRef(1);
  const loadRef = useRef(null);
  const latestRequest = useRef(0); // only the newest request may change the screen

  const load = useCallback(async (page = 1, { silent = false } = {}) => {
    const mine = ++latestRequest.current;
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), status: view, search, limit: "25" });
      const res = await fetch(`/api/admin/abandoned-carts/emails?${params.toString()}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (mine !== latestRequest.current) return; // a newer search / tab / refresh was started: this answer is out of date
      if (!res.ok || !body.success) throw new Error(body.error || "Failed to load the recovery emails.");
      pageRef.current = body.pagination?.currentPage || 1;
      setData(body);
      setForm((current) => current ?? {
        enabled: body.settings.enabled,
        idleMinutes: String(body.settings.idleMinutes),
        maxAgeHours: String(body.settings.maxAgeHours),
      });
      setLoadError("");
    } catch (e) {
      console.error(e);
      if (!silent && mine === latestRequest.current) setLoadError(e.message || "Failed to load the recovery emails.");
    } finally {
      if (mine === latestRequest.current) setLoading(false);
    }
  }, [view, search]);

  // Live search (debounced); the first load and tab changes run straight away.
  useEffect(() => {
    searchTimer.current = setTimeout(() => load(1), search ? 400 : 0);
    return () => clearTimeout(searchTimer.current);
  }, [load, search]);

  // Keep the timers and the activity list fresh while the page stays open.
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadRef.current?.(pageRef.current, { silent: true });
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const saveSettings = async (e) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/abandoned-carts/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: !!form.enabled,
          idleMinutes: Number(form.idleMinutes),
          maxAgeHours: Number(form.maxAgeHours),
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not save the settings."));
      const saved = await res.json();
      setForm({ enabled: saved.settings.enabled, idleMinutes: String(saved.settings.idleMinutes), maxAgeHours: String(saved.settings.maxAgeHours) });
      toast.success("Settings saved.");
      load(pageRef.current, { silent: true });
    } catch (err) {
      toast.error(err.message || "Could not save the settings.");
    } finally {
      setSaving(false);
    }
  };

  const checkNow = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/admin/abandoned-carts/scan", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "The check failed.");
      if (body.disabled) toast("Automatic recovery emails are turned off, so nothing was sent.");
      else if (body.scanned === 0) toast.success("Checked: no carts are due for an email right now.");
      else toast.success(`Checked ${plural(body.scanned, "cart")}: ${body.sent} sent, ${body.failed} failed.`);
      load(1, { silent: true });
    } catch (err) {
      toast.error(err.message || "The check failed.");
    } finally {
      setScanning(false);
    }
  };

  const sendNow = async (cart) => {
    setSendingId(cart._id);
    try {
      const res = await fetch(`/api/admin/abandoned-carts/${cart._id}/send`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) throw new Error(body.error || "The email could not be sent.");
      toast.success(`Recovery email sent to ${cart.email}.`);
    } catch (err) {
      toast.error(err.message || "The email could not be sent.");
    } finally {
      setSendingId(null);
      load(1, { silent: true });
    }
  };

  const changeView = (v) => {
    setView(v);
    setExpanded(null);
  };

  const items = data?.items || [];
  const counts = data?.counts || { all: 0, sent: 0, failed: 0, skipped: 0, "gave-up": 0 };
  const pagination = data?.pagination || { total: 0, pages: 1, currentPage: 1 };
  const waiting = data?.waiting || [];
  const carts = data?.diagnostics?.carts || {};
  const settings = data?.settings;
  const lastScan = data?.scheduler?.lastScan;
  const builtIn = data?.scheduler?.builtInScheduler;
  const lastScanAgeMin = data?.scheduler?.lastScanAgeMinutes ?? null;
  const schedulerStale = !!builtIn && settings?.enabled && (lastScanAgeMin === null || lastScanAgeMin > 15);
  const waitingTotal = (carts.waitingForQuietPeriod || 0) + (carts.eligibleNow || 0);
  const csvHref = `/api/admin/abandoned-carts/emails?format=csv&status=${encodeURIComponent(view)}&search=${encodeURIComponent(search)}`;

  const pager = (
    <div className="wp-pages">
      <span>{plural(pagination.total, "item")}</span>
      <button type="button" className="wp-pager" aria-label="Previous page" disabled={loading || pagination.currentPage <= 1} onClick={() => load(pagination.currentPage - 1)}>
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>
      <span>{pagination.currentPage} of {pagination.pages}</span>
      <button type="button" className="wp-pager" aria-label="Next page" disabled={loading || pagination.currentPage >= pagination.pages} onClick={() => load(pagination.currentPage + 1)}>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <RequirePermission permission="orders.view">
      <Page>
        <PageHeader
          title="Recovery emails"
          actions={<Link href="/admin/abandoned-carts" className="wp-btn">Back to Abandoned Carts</Link>}
          aside={
            <>
              <a className="wp-btn" href={csvHref} download>
                <Download className="w-4 h-4" aria-hidden="true" /> Export CSV
              </a>
              {canEdit && (
                <button type="button" className="wp-btn wp-btn-primary" onClick={checkNow} disabled={scanning || settings?.enabled === false} title={settings?.enabled === false ? "Turn on automatic emails first" : undefined}>
                  <RefreshCw className="w-4 h-4" aria-hidden="true" /> {scanning ? "Checking..." : "Check now"}
                </button>
              )}
            </>
          }
        />
        <p className="wp-desc" style={{ margin: "0 0 12px" }}>
          Every email sent to a shopper who left checkout, with the result of each one. A shopper is emailed once they have been idle for the time set below.
          Each email carries a personal one-time 15% code made from the shopper&apos;s first name (for example DONALD15). It only works with that shopper&apos;s email address, and only once.
        </p>

        {loadError && (
          <Notice type="error" onDismiss={() => setLoadError("")}>
            {loadError}{" "}
            <button type="button" className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => load(pagination.currentPage)}>Try again</button>
          </Notice>
        )}
        {data && !data.mail?.smtpConfigured && (
          <Notice type="error">Email is not set up on the server (SMTP login is missing), so no recovery email can go out.</Notice>
        )}
        {settings && !settings.enabled && (
          <Notice type="warning">Automatic recovery emails are turned off. Turn them on in the settings below. You can still use Send now on a waiting cart.</Notice>
        )}
        {schedulerStale && (
          <Notice type="warning">
            {lastScan?.at
              ? `The last automatic check was ${timeAgo(lastScan.at)}. It should run every 5 minutes, so the server may have restarted or the scheduler is not running.`
              : "No automatic check has run yet. It starts about a minute after the server starts and then repeats every 5 minutes."}
          </Notice>
        )}
        {lastScan?.error && lastScan.error !== "disabled in settings" && (
          <Notice type="error">The last check reported a problem: {lastScan.error}</Notice>
        )}

        <div className="wp-stats">
          <div className="wp-stat">
            <div className="wp-stat-label">Sent in the last 24 hours</div>
            <div className="wp-stat-value">{data ? data.sentLast24h : "-"}</div>
          </div>
          <div className="wp-stat">
            <div className="wp-stat-label">Emails sent in total</div>
            <div className="wp-stat-value">{data ? counts.sent : "-"}</div>
          </div>
          <div className="wp-stat">
            <div className="wp-stat-label">Carts waiting for an email</div>
            <div className="wp-stat-value">{data ? waitingTotal : "-"}</div>
            {settings && <div className="wp-stat-delta">emailed after {settings.idleMinutes} min idle</div>}
          </div>
          <div className="wp-stat">
            <div className="wp-stat-label">Failed or gave up</div>
            <div className="wp-stat-value">{data ? counts.failed + counts["gave-up"] : "-"}</div>
            {data && lastScan?.at && <div className="wp-stat-delta">last check {timeAgo(lastScan.at)}</div>}
          </div>
        </div>

        <div className="wp-cols">
          <div className="wp-col-side">
            <Postbox
              id="recovery-settings"
              title="Settings"
              footer={
                canEdit ? (
                  <button type="submit" form="recovery-settings-form" className="wp-btn wp-btn-primary" disabled={saving || !form}>
                    {saving ? "Saving..." : "Save settings"}
                  </button>
                ) : (
                  <span className="wp-desc">You can view these settings but not change them.</span>
                )
              }
            >
              {!form ? (
                <><Skeleton height={16} width="70%" /><Skeleton height={30} width="50%" style={{ marginTop: 12 }} /></>
              ) : (
                // noValidate: the server checks the numbers and answers with a message shown in the admin's own toast, never the browser's popup
                <form id="recovery-settings-form" onSubmit={saveSettings} noValidate>
                  <div className="wp-field">
                    <label className="wp-check">
                      <input type="checkbox" checked={!!form.enabled} disabled={!canEdit} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
                      <span>Automatically email shoppers who leave checkout</span>
                    </label>
                  </div>
                  <div className="wp-field">
                    <label className="wp-label" htmlFor="recovery-idle">Send after (minutes idle)</label>
                    <input
                      id="recovery-idle" type="number" min="5" max="1440" step="1" inputMode="numeric"
                      className="wp-input" style={{ width: 120 }} disabled={!canEdit}
                      value={form.idleMinutes} onChange={(e) => setForm({ ...form, idleMinutes: e.target.value })}
                    />
                    <p className="wp-desc">How long a shopper must stay inactive after typing their email before they are emailed. 5 to 1440.</p>
                  </div>
                  <div className="wp-field" style={{ marginBottom: 0 }}>
                    <label className="wp-label" htmlFor="recovery-age">Stop after (hours)</label>
                    <input
                      id="recovery-age" type="number" min="1" max="720" step="1" inputMode="numeric"
                      className="wp-input" style={{ width: 120 }} disabled={!canEdit}
                      value={form.maxAgeHours} onChange={(e) => setForm({ ...form, maxAgeHours: e.target.value })}
                    />
                    <p className="wp-desc">Carts older than this are never emailed. 1 to 720.</p>
                  </div>
                </form>
              )}
            </Postbox>

            <Postbox id="recovery-status" title="Status">
              {!data ? (
                <Skeleton height={16} width="80%" />
              ) : (
                <div className="wp-misc" style={{ padding: 0 }}>
                  <div className="wp-misc-row"><span className="wp-strong">Last check:</span> {lastScan?.at ? `${timeAgo(lastScan.at)} (${TRIGGERS[lastScan.trigger] || lastScan.trigger})` : "not yet"}</div>
                  {lastScan?.at && (
                    <div className="wp-misc-row wp-muted">{plural(lastScan.scanned || 0, "cart")} due, {lastScan.sent || 0} sent, {lastScan.failed || 0} failed</div>
                  )}
                  <div className="wp-misc-row"><span className="wp-strong">Automatic checks:</span> {builtIn ? "every 5 minutes" : "run by the server cron"}</div>
                  <div className="wp-misc-row"><span className="wp-strong">Sent from:</span> <span style={{ wordBreak: "break-all" }}>{data.mail?.sender || "-"}</span></div>
                  <div className="wp-misc-row wp-muted">
                    {carts.noEmail || 0} without an email, {carts.invalidEmail || 0} with an invalid email, {carts.gaveUp || 0} given up on, {carts.recovered || 0} completed an order
                  </div>
                </div>
              )}
            </Postbox>
          </div>

          <div className="wp-col-main">
            <Postbox id="recovery-waiting" title="Waiting to be emailed" aside={data ? plural(waiting.length, "cart") : undefined} flush>
              <div className="wp-table-box" style={{ border: 0, boxShadow: "none" }}>
                <table className="wp-list-table">
                  <thead>
                    <tr>
                      <th scope="col">Shopper</th>
                      <th scope="col" className="wp-hide-sm wp-num">Cart</th>
                      <th scope="col">Email goes out</th>
                      {canEdit && <th scope="col" style={{ width: 1 }}><span className="sr-only">Action</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {!data ? (
                      <tr><td colSpan={canEdit ? 4 : 3}><Skeleton height={16} width="60%" /></td></tr>
                    ) : waiting.length === 0 ? (
                      <tr><td colSpan={canEdit ? 4 : 3} className="wp-muted">No one is waiting. Shoppers who stop at checkout after entering their email show up here.</td></tr>
                    ) : (
                      waiting.map((cart) => (
                        <tr key={cart._id}>
                          <td style={{ minWidth: 0, wordBreak: "break-all" }}>
                            <div className="wp-strong">{cart.name || cart.email}</div>
                            {cart.name && <div className="wp-small wp-muted">{cart.email}</div>}
                            {cart.lastError && <div className="wp-small" style={{ color: "var(--wp-danger)" }}>Last attempt failed: {cart.lastError}</div>}
                          </td>
                          <td className="wp-hide-sm wp-num" style={{ whiteSpace: "nowrap" }}>
                            <div className="wp-strong">{formatMoney(cart.cartTotal)}</div>
                            <div className="wp-small wp-muted">{plural(cart.itemCount, "item")}</div>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <div>{cart.gaveUp ? "gave up after 3 failed tries" : cart.dueInMinutes > 0 ? `in about ${cart.dueInMinutes} min` : "at the next check"}</div>
                            <div className="wp-small wp-muted">idle {cart.idleMinutes} min</div>
                          </td>
                          {canEdit && (
                            <td>
                              <button type="button" className="wp-btn" disabled={sendingId === cart._id} onClick={() => sendNow(cart)}>
                                <Send className="w-4 h-4" aria-hidden="true" /> {sendingId === cart._id ? "Sending..." : "Send now"}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Postbox>
          </div>
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "8px 0 0", color: "var(--wp-text)" }}>Activity</h2>
        <nav className="wp-subsub" aria-label="Filter the activity by result">
          {VIEWS.map((tab, i) => (
            <Fragment key={tab.value}>
              {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
              <button type="button" className={view === tab.value ? "is-current" : undefined} aria-current={view === tab.value ? "page" : undefined} onClick={() => changeView(tab.value)}>
                {tab.label} <span className="wp-count">({data ? (counts[tab.value] ?? 0) : "-"})</span>
              </button>
            </Fragment>
          ))}
        </nav>

        <div className="wp-toolbar">
          <span className="wp-spacer" />
          <form className="wp-search" role="search" onSubmit={(e) => { e.preventDefault(); clearTimeout(searchTimer.current); load(1); }}>
            <label htmlFor="recovery-search" className="sr-only">Search the activity</label>
            <input id="recovery-search" type="search" className="wp-input" placeholder="Search email, code or error..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <button type="submit" className="wp-btn">Search</button>
          </form>
          {pager}
        </div>

        <div className="wp-table-box">
          <table className="wp-list-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Shopper</th>
                <th scope="col">Result</th>
                <th scope="col" className="wp-hide-sm">Voucher</th>
                <th scope="col" className="wp-hide-sm wp-num">Cart</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                [0, 1, 2, 3].map((i) => (
                  <tr key={`sk-${i}`} aria-hidden="true">
                    <td><Skeleton height={14} width="80%" /></td>
                    <td><Skeleton height={14} width="70%" /></td>
                    <td><Skeleton height={22} width={70} /></td>
                    <td className="wp-hide-sm"><Skeleton height={14} width="60%" /></td>
                    <td className="wp-hide-sm"><Skeleton height={14} width={60} style={{ marginLeft: "auto" }} /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="wp-muted">
                    {search ? <>No emails match &ldquo;{search}&rdquo;.</> : view === "all" ? "No recovery emails have been sent yet. They appear here as soon as the first one goes out." : "Nothing here."}
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const st = STATUS[row.status] || { label: row.status, cls: "" };
                  const earlier = row.reason === "logged-before-activity-tracking";
                  const isOpen = expanded === row._id;
                  const toggle = () => setExpanded(isOpen ? null : row._id);
                  return (
                    <Fragment key={row._id}>
                      <tr className={isOpen ? "is-selected" : undefined}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <div>{fmtDateTime(row.createdAt)}</div>
                          <div className="wp-small wp-muted">{earlier ? "Earlier send" : TRIGGERS[row.trigger] || row.trigger}{row.attempt > 1 ? `, attempt ${row.attempt}` : ""}</div>
                        </td>
                        <td style={{ minWidth: 0, wordBreak: "break-all" }}>
                          <button type="button" className="wp-row-title" aria-expanded={isOpen} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }} onClick={toggle}>
                            {row.email || "-"}
                          </button>
                          {row.firstName && <div className="wp-small wp-muted">{row.firstName}</div>}
                          <div className="wp-mobile-meta">
                            {row.voucherCode ? <span className="font-mono">{row.voucherCode}</span> : null}{row.voucherCode ? " · " : ""}{formatMoney(row.cartTotal)}
                          </div>
                          <div className="wp-row-actions">
                            <span><button type="button" onClick={toggle}>{isOpen ? "Hide details" : "View details"}</button></span>
                          </div>
                        </td>
                        <td>
                          <span className={`wp-pill wp-pill-sm ${st.cls}`}>{st.label}</span>
                          {row.status !== "sent" && (row.reason || row.error) && (
                            <div className="wp-small wp-muted" style={{ marginTop: 4, maxWidth: 260, wordBreak: "break-word" }}>{REASONS[row.reason] || row.error || row.reason}</div>
                          )}
                        </td>
                        <td className="wp-hide-sm">
                          {row.voucherCode ? (
                            <>
                              <div className="font-mono wp-strong">{row.voucherCode}</div>
                              <div className="wp-small wp-muted">
                                {row.voucherKind === "personal" ? "personal, one use" : row.voucherKind === "campaign" ? "campaign code" : ""}
                                {row.discountLabel ? `${row.voucherKind ? ", " : ""}${row.discountLabel}` : ""}
                              </div>
                            </>
                          ) : "-"}
                        </td>
                        <td className="wp-hide-sm wp-num" style={{ whiteSpace: "nowrap" }}>
                          <div className="wp-strong">{formatMoney(row.cartTotal)}</div>
                          <div className="wp-small wp-muted">{plural(row.itemCount || 0, "item")}</div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="is-selected">
                          <td colSpan={5}>
                            <div className="wp-order-cols" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", padding: "4px 0" }}>
                              <div style={{ minWidth: 0 }}>
                                <h3>What was sent</h3>
                                <p style={{ margin: 0, wordBreak: "break-word" }}><span className="wp-strong">Subject:</span> {row.subject || "-"}</p>
                                <p style={{ margin: "6px 0 0", wordBreak: "break-word" }}><span className="wp-strong">Cart:</span> {(row.itemNames || []).join(", ") || "-"}</p>
                                <p style={{ margin: "6px 0 0" }}><span className="wp-strong">Shopper idle for:</span> {row.idleMinutes != null ? `${row.idleMinutes} min` : "-"}</p>
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <h3>Delivery</h3>
                                {earlier && <p className="wp-muted" style={{ margin: "0 0 6px" }}>This email went out before activity tracking was added, so the mail server&apos;s reply was not recorded.</p>}
                                <p style={{ margin: 0, wordBreak: "break-all" }}><span className="wp-strong">Message ID:</span> {row.messageId || "-"}</p>
                                <p style={{ margin: "6px 0 0", wordBreak: "break-word" }}><span className="wp-strong">Mail server said:</span> {row.smtpResponse || "-"}</p>
                                <p style={{ margin: "6px 0 0", wordBreak: "break-all" }}>
                                  <span className="wp-strong">Accepted:</span> {(row.accepted || []).join(", ") || "-"}
                                  {(row.rejected || []).length > 0 && <> · <span className="wp-strong">Rejected:</span> {row.rejected.join(", ")}</>}
                                </p>
                                {row.error && <p style={{ margin: "6px 0 0", color: "var(--wp-danger)", wordBreak: "break-word" }}><span className="wp-strong">Error:</span> {row.error}</p>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
      </Page>
    </RequirePermission>
  );
}
