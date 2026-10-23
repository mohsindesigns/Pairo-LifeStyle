"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { CheckCircle2, MessageSquareReply, RefreshCw } from "lucide-react";
import { Page, PageHeader, Postbox, Notice } from "@/components/admin/ui";
import RequirePermission from "@/components/admin/RequirePermission";
import { usePopup } from "@/context/PopupContext";
import {
  useInboxList, runBulk, readError, StatusViews, Pager, BulkActions, SearchForm,
  SkeletonRows, SelectAllBox, Drawer, DangerLink, KV, formatDateTime,
} from "../contact/_shared/inbox-ui";

const API = "/api/admin/size-confirmations";

const STATUS_STYLES = {
  "Awaiting Reply": "wp-st-draft",
  Replied: "wp-st-confirmed",
  Confirmed: "wp-st-delivered",
};

const VIEWS = [
  ["all", "All"],
  ["unread", "Unread replies"],
  ["Awaiting Reply", "Awaiting reply"],
  ["Replied", "Replied"],
  ["Confirmed", "Confirmed"],
  ["trash", "Trash"],
];

const VERBS = { markRead: "marked as read", trash: "moved to the Trash", restore: "restored", delete: "deleted permanently" };

function ConfirmationDrawer({ initial, onClose, onChanged, onTrash, onRestore, onDelete }) {
  const [item, setItem] = useState(initial);
  const [size, setSize] = useState("");
  const [sizeError, setSizeError] = useState("");
  const [busy, setBusy] = useState(false);
  const trashed = !!item.isDeleted;

  const patch = async (payload, okMsg) => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await readError(res, "Update failed");
        if (payload.action === "confirm") setSizeError(msg);
        else toast.error(msg);
        return false;
      }
      const data = await res.json();
      setItem(data.confirmation);
      onChanged(data.confirmation);
      if (okMsg) toast.success(okMsg);
      return true;
    } catch {
      toast.error("Update failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirmSize = async (e) => {
    e.preventDefault();
    if (!size.trim()) {
      setSizeError("Enter the size the customer confirmed.");
      return;
    }
    setSizeError("");
    if (await patch({ action: "confirm", size: size.trim() }, "Size confirmed")) setSize("");
  };

  const footer = trashed ? (
    <>
      <DangerLink onClick={() => onDelete(item)} disabled={busy}>Delete permanently</DangerLink>
      <button type="button" className="wp-btn" onClick={onClose}>Close</button>
      <button type="button" className="wp-btn wp-btn-primary" onClick={() => onRestore(item)} disabled={busy}>Restore</button>
    </>
  ) : (
    <>
      <DangerLink onClick={() => onTrash(item)} disabled={busy}>Move to Trash</DangerLink>
      {item.unreadReplies > 0 && (
        <button type="button" className="wp-btn" onClick={() => patch({ action: "markRead" }, "Replies marked as read")} disabled={busy}>
          Mark replies read
        </button>
      )}
      <Link href={`/admin/orders/${item.orderId}`} className="wp-btn wp-btn-primary">View order</Link>
    </>
  );

  return (
    <Drawer
      titleId="size-confirmation-title"
      title={`Order #${item.orderNumber}`}
      subtitle={<>{item.customerName || "Customer"} · <span style={{ wordBreak: "break-all" }}>{item.customerEmail}</span></>}
      onClose={onClose}
      footer={footer}
    >
      {trashed && <Notice type="warning">This size confirmation is in the Trash. The order is not affected.</Notice>}

      <Postbox title="Size confirmation" id="size-summary">
        <KV label="Status" value={<span className={`wp-pill wp-pill-sm ${STATUS_STYLES[item.status] || ""}`}>{item.status}</span>} />
        <KV label={item.auto ? "Sent automatically" : "Sent"} value={formatDateTime(item.sentAt)} />
        <KV label="Sent by" value={item.sentBy} />
        <KV label="Subject" value={item.subject} />
        <KV label="Size charts" value={item.chartLabels?.join(", ")} />
        <KV label="Confirmed size" value={item.confirmedSize} />
        <KV label="Confirmed" value={item.confirmedAt ? formatDateTime(item.confirmedAt) : ""} />
      </Postbox>

      <Postbox title={`Customer replies (${item.replies?.length || 0})`} id="size-replies">
        {!item.replies?.length ? (
          <p className="wp-muted" style={{ margin: 0 }}>No reply yet.</p>
        ) : (
          item.replies.map((r, i) => (
            <div key={r._id || i} style={{ marginTop: i ? 12 : 0 }}>
              <div
                className="wp-note-body is-customer"
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", outline: r.read ? undefined : "2px solid #2271b1" }}
              >
                {r.text}
              </div>
              <div className="wp-note-meta">
                <MessageSquareReply className="w-3 h-3" aria-hidden="true" />
                <span>{r.fromName || r.fromEmail}</span>
                <span>· {formatDateTime(r.receivedAt)}</span>
                {!r.read && <span className="wp-strong">· New</span>}
              </div>
            </div>
          ))
        )}
      </Postbox>

      {!trashed && (
        item.status === "Confirmed" ? (
          <Notice type="success">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Confirmed size: <strong>{item.confirmedSize}</strong>
            </span>
          </Notice>
        ) : (
          <form onSubmit={confirmSize}>
            <Postbox title="Record the confirmed size" id="size-confirm">
              <label htmlFor="size-confirm-input" className="wp-label">Confirmed size</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input
                  id="size-confirm-input"
                  type="text"
                  value={size}
                  onChange={(e) => { setSize(e.target.value); setSizeError(""); }}
                  placeholder="e.g. Medium"
                  className="wp-input"
                  aria-invalid={sizeError ? "true" : undefined}
                  style={{ flex: "1 1 180px", minWidth: 0 }}
                />
                <button type="submit" className="wp-btn wp-btn-primary" disabled={busy}>Confirm size</button>
              </div>
              {sizeError
                ? <p className="wp-desc" style={{ color: "#d63638" }} role="alert">{sizeError}</p>
                : <p className="wp-desc">Adds a note to the order timeline and marks the replies as read.</p>}
            </Postbox>
          </form>
        )
      )}
    </Drawer>
  );
}

export default function SizeConfirmationsPage() {
  const { showConfirm } = usePopup();
  const list = useInboxList(API, { itemsKey: "confirmations" });
  const { view, items, selectedIds, reload, setItems } = list;
  const isTrash = view === "trash";
  const [bulkAction, setBulkAction] = useState("");
  const [open, setOpen] = useState(null);
  const [checking, setChecking] = useState(false);
  const [inboxOff, setInboxOff] = useState(false);
  // The list endpoint reports whether the IMAP inbox is set up.
  const inboxConfigured = !inboxOff && list.meta.inboxConfigured !== false;

  const checkReplies = async () => {
    setChecking(true);
    try {
      const res = await fetch(`${API}/sync?force=1`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.configured === false) {
        setInboxOff(true);
        toast.error("Reply inbox not connected — set IMAP_HOST in the server environment.");
      } else if (!res.ok || data.error) toast.error(`Could not check inbox: ${data.error || res.statusText}`);
      else toast.success(data.newReplies ? `${data.newReplies} new repl${data.newReplies === 1 ? "y" : "ies"}` : "No new replies");
      await reload();
    } catch {
      toast.error("Could not check the inbox.");
    } finally {
      setChecking(false);
    }
  };

  const bulkOptions = isTrash
    ? [["restore", "Restore"], ["delete", "Delete permanently"]]
    : [["markRead", "Mark replies as read"], ["trash", "Move to Trash"]];

  const act = async (action, ids) => {
    const n = ids.length;
    if (action === "delete") {
      const ok = await showConfirm(
        `${n} size confirmation${n === 1 ? "" : "s"} will be deleted permanently, with the customer replies. The orders are not changed. This cannot be undone.`,
        "Delete permanently?",
        { confirmText: "Delete Permanently", danger: true }
      );
      if (!ok) return false;
    }
    const done = await runBulk(API, action, ids, { verb: VERBS[action], noun: "size confirmation" });
    reload();
    return done;
  };

  const applyBulk = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    if (await act(bulkAction, selectedIds)) list.setSelectedIds([]);
    setBulkAction("");
  };

  const onChanged = useCallback((c) => {
    setItems((prev) => prev.map((x) => (x._id === c._id ? c : x)));
    reload({ silent: true });
  }, [reload, setItems]);

  const closeAfter = (fn) => async (c) => { if (await fn(c)) setOpen(null); };

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <SelectAllBox label="Select all size confirmations" list={list} />
      </th>
      <th scope="col">Order</th>
      <th scope="col" className="wp-hide-sm">Customer</th>
      <th scope="col" className="wp-hide-sm">Sent</th>
      <th scope="col" className="wp-hide-sm">Status</th>
      <th scope="col" className="wp-hide-sm">Latest reply</th>
      <th scope="col" className="wp-hide-sm">Size</th>
    </tr>
  );

  return (
    <RequirePermission permission="orders.view">
      <Page>
        <PageHeader
          title="Size Confirmations"
          actions={
            <button type="button" onClick={checkReplies} disabled={checking} className="wp-btn">
              <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} aria-hidden="true" /> Check for replies
            </button>
          }
        />
        <p className="wp-muted" style={{ margin: "0 0 4px" }}>
          Emails sent to customers to confirm jacket sizes, and their replies. Send one from an order page.
        </p>

        {!inboxConfigured && (
          <Notice type="warning">
            Replies can&apos;t be picked up yet — add <code>IMAP_HOST</code> (plus <code>IMAP_USER</code> / <code>IMAP_PASS</code>) to the server environment.
          </Notice>
        )}

        <StatusViews
          label="Filter size confirmations"
          views={VIEWS}
          current={view}
          counts={list.counts}
          onChange={(v) => { list.setView(v); setBulkAction(""); }}
        />

        <div className="wp-toolbar">
          <BulkActions
            id="size-bulk-action"
            options={bulkOptions}
            value={bulkAction}
            onChange={setBulkAction}
            onApply={applyBulk}
            disabled={!bulkAction || selectedIds.length === 0}
          />
          <span className="wp-spacer" />
          <SearchForm
            id="size-search"
            label="Search size confirmations"
            placeholder="Order #, customer, email, size..."
            value={list.searchInput}
            onChange={list.onSearchChange}
            onSubmit={list.submitSearch}
          />
        </div>

        <div className="wp-toolbar">
          <span className="wp-spacer" />
          <Pager pagination={list.pagination} onPage={list.goToPage} />
        </div>

        {list.error && <Notice type="error">{list.error}</Notice>}

        <div className="wp-table-box">
          <table className="wp-list-table">
            <thead>{headerRow}</thead>
            <tbody>
              {list.loading ? (
                <SkeletonRows cols={6} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="wp-muted">
                    {list.query
                      ? `No size confirmations match “${list.query}”.`
                      : isTrash ? "The Trash is empty." : "Nothing here yet. Send a size confirmation from an order page."}
                  </td>
                </tr>
              ) : (
                items.map((c) => {
                  const last = c.replies?.[c.replies.length - 1];
                  const selected = selectedIds.includes(c._id);
                  const unread = c.unreadReplies > 0 && !isTrash;
                  return (
                    <tr
                      key={c._id}
                      className={selected ? "is-selected" : undefined}
                      style={unread && !selected ? { boxShadow: "inset 3px 0 0 #2271b1" } : undefined}
                    >
                      <td className="wp-check-col">
                        <input type="checkbox" aria-label={`Select size confirmation for order ${c.orderNumber}`} checked={selected} onChange={() => list.toggleSelect(c._id)} />
                      </td>
                      <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                        <button
                          type="button"
                          onClick={() => setOpen(c)}
                          className="wp-row-title"
                          style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left", fontWeight: unread ? 700 : 600 }}
                        >
                          #{c.orderNumber}
                        </button>
                        {unread && (
                          <span className="wp-pill wp-pill-sm wp-st-failed" style={{ marginLeft: 6 }}>{c.unreadReplies} new</span>
                        )}
                        <div className="wp-mobile-meta">
                          {c.customerName || "—"}{c.customerEmail ? <> · <span style={{ wordBreak: "break-all" }}>{c.customerEmail}</span></> : null}
                          <br />
                          <span className={`wp-pill wp-pill-sm ${STATUS_STYLES[c.status] || ""}`}>{c.status}</span>
                          {c.confirmedSize ? ` · Size ${c.confirmedSize}` : ""} · {new Date(c.sentAt).toLocaleDateString()}
                        </div>
                        <div className="wp-row-actions">
                          <span><button type="button" onClick={() => setOpen(c)}>View</button></span>
                          <span><Link href={`/admin/orders/${c.orderId}`}>Order</Link></span>
                          {isTrash ? (
                            <>
                              <span><button type="button" onClick={() => act("restore", [c._id])}>Restore</button></span>
                              <span><button type="button" className="is-danger" onClick={() => act("delete", [c._id])}>Delete permanently</button></span>
                            </>
                          ) : (
                            <>
                              {c.unreadReplies > 0 && (
                                <span><button type="button" onClick={() => act("markRead", [c._id])}>Mark read</button></span>
                              )}
                              <span><button type="button" className="is-danger" onClick={() => act("trash", [c._id])}>Trash</button></span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>
                        <div className="wp-strong">{c.customerName || "—"}</div>
                        <div className="wp-muted wp-small" style={{ wordBreak: "break-all" }}>{c.customerEmail}</div>
                      </td>
                      <td className="wp-hide-sm wp-muted" style={{ whiteSpace: "nowrap" }}>{formatDateTime(c.sentAt)}</td>
                      <td className="wp-hide-sm">
                        <span className={`wp-pill ${STATUS_STYLES[c.status] || ""}`}>{c.status}</span>
                      </td>
                      <td className="wp-hide-sm" style={{ maxWidth: 320 }}>
                        {last ? <span className="line-clamp-2">{last.text}</span> : <span className="wp-muted">—</span>}
                      </td>
                      <td className="wp-hide-sm wp-strong">{c.confirmedSize || "—"}</td>
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
          <Pager pagination={list.pagination} onPage={list.goToPage} />
        </div>

        {open && (
          <ConfirmationDrawer
            key={open._id}
            initial={open}
            onClose={() => setOpen(null)}
            onChanged={onChanged}
            onTrash={closeAfter((c) => act("trash", [c._id]))}
            onRestore={closeAfter((c) => act("restore", [c._id]))}
            onDelete={closeAfter((c) => act("delete", [c._id]))}
          />
        )}
      </Page>
    </RequirePermission>
  );
}
