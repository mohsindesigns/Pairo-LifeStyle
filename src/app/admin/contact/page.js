"use client";

import { useCallback, useEffect, useState } from "react";
import { Flag, Send } from "lucide-react";
import { toast } from "react-hot-toast";
import { Page, PageHeader, Postbox, Notice } from "@/components/admin/ui";
import RequirePermission from "@/components/admin/RequirePermission";
import { usePopup } from "@/context/PopupContext";
import { buildCsv } from "@/lib/csv-escape";
import {
  useInboxList, runBulk, readError, StatusViews, Pager, BulkActions, SearchForm,
  SkeletonRows, SelectAllBox, Drawer, DangerLink, KV, formatDateTime,
} from "./_shared/inbox-ui";
import ThemedSelect from "@/components/ui/ThemedSelect";

const API = "/api/admin/submissions";

const VIEWS = [
  ["all", "All"],
  ["New", "New"],
  ["Read", "Read"],
  ["Replied", "Replied"],
  ["Archived", "Archived"],
  ["Spam", "Spam"],
  ["trash", "Trash"],
];

const BULK = {
  markRead: { label: "Mark as read", verb: "marked as read" },
  markUnread: { label: "Mark as unread", verb: "marked as unread" },
  archive: { label: "Archive", verb: "archived" },
  markSpam: { label: "Mark as spam", verb: "marked as spam" },
  notSpam: { label: "Not spam", verb: "moved out of spam" },
  trash: { label: "Move to Trash", verb: "moved to the Trash" },
  restore: { label: "Restore", verb: "restored" },
  delete: { label: "Delete permanently", verb: "deleted permanently" },
};

const statusPillClass = (st) =>
  st === "New" ? "wp-st-out" :
  st === "Replied" ? "wp-st-delivered" :
  st === "Spam" ? "wp-st-cancelled" :
  st === "Archived" ? "wp-st-refunded" :
  "wp-st-draft";

const priorityColor = (pr) => (pr === "High" ? "#d63638" : pr === "Medium" ? "#dba617" : "#72aee6");

const sourcePillClass = (src) =>
  src === "Email Subscriber" || src === "Newsletter" ? "wp-st-packed" :
  src === "Contact" || !src ? "wp-st-shipped" :
  "wp-st-draft";

function SubmissionDrawer({ initial, onClose, onChanged, onTrash, onRestore, onDelete }) {
  const [item, setItem] = useState(initial);
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState({ subject: "", message: "" });
  const [replyError, setReplyError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const trashed = !!item.isDeleted;

  // Opening marks a New submission as Read (server side) and loads the populated notes.
  useEffect(() => {
    let alive = true;
    fetch(`${API}/${initial._id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?._id) {
          setItem(data);
          if (initial.status === "New" && data.status !== "New") onChanged(data);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [initial._id, initial.status, onChanged]);

  const patch = async (payload, okMsg) => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error(await readError(res, "Update failed"));
        return false;
      }
      const updated = await res.json();
      setItem((prev) => ({ ...prev, ...updated }));
      onChanged(updated);
      if (okMsg) toast.success(okMsg);
      return true;
    } catch {
      toast.error("Update failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openReply = () => {
    setReply({ subject: `Re: ${item.subject || "Your inquiry"}`, message: "" });
    setReplyError("");
    setReplyOpen(true);
  };

  const sendReply = async (e) => {
    e.preventDefault();
    if (!reply.subject.trim() || !reply.message.trim()) {
      setReplyError("Enter a subject and a message.");
      return;
    }
    setBusy(true);
    setReplyError("");
    try {
      const res = await fetch(`${API}/${item._id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reply),
      });
      if (!res.ok) {
        setReplyError(await readError(res, "The reply could not be sent."));
        return;
      }
      toast.success("Reply sent");
      setReplyOpen(false);
      const fresh = await fetch(`${API}/${item._id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (fresh?._id) {
        setItem(fresh);
        onChanged(fresh);
      }
    } catch {
      setReplyError("The reply could not be sent. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const addNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    if (await patch({ action: "ADD_NOTE", note: note.trim() }, "Note added")) setNote("");
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
      <button type="button" className="wp-btn" onClick={onClose}>Close</button>
      {!replyOpen && (
        <button type="button" className="wp-btn wp-btn-primary" onClick={openReply} disabled={busy}>
          <Send className="w-4 h-4" aria-hidden="true" /> Reply
        </button>
      )}
    </>
  );

  return (
    <Drawer
      titleId="submission-detail-title"
      title={item.subject || `Message from ${item.name}`}
      subtitle={<>{item.name} · <a href={`mailto:${item.email}`} className="wp-link" style={{ wordBreak: "break-all" }}>{item.email}</a></>}
      onClose={onClose}
      footer={footer}
    >
      {trashed && <Notice type="warning">This submission is in the Trash. Restore it to reply or change its status.</Notice>}

      <Postbox title="Message" id="submission-message">
        <div className="wp-note-body is-customer" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {item.message}
        </div>
        <div className="wp-note-meta">
          <span>Received {formatDateTime(item.createdAt)}</span>
          {item.sourcePage && <span>· Page: {item.sourcePage}</span>}
        </div>
      </Postbox>

      {replyOpen && !trashed && (
        <form onSubmit={sendReply}>
          <Postbox
            title="Send email reply"
            id="submission-reply"
            footer={
              <>
                <span className="wp-spacer" />
                <button type="button" onClick={() => setReplyOpen(false)} className="wp-btn">Cancel</button>
                <button type="submit" disabled={busy} className="wp-btn wp-btn-primary">
                  {busy ? "Sending..." : "Send reply"}
                </button>
              </>
            }
          >
            {replyError && <Notice type="error">{replyError}</Notice>}
            <div className="wp-field">
              <label htmlFor="submission-reply-subject" className="wp-label">Subject</label>
              <input
                id="submission-reply-subject"
                type="text"
                className="wp-input wp-full"
                value={reply.subject}
                onChange={(e) => setReply({ ...reply, subject: e.target.value })}
              />
            </div>
            <div className="wp-field" style={{ marginBottom: 0 }}>
              <label htmlFor="submission-reply-message" className="wp-label">Message</label>
              <textarea
                id="submission-reply-message"
                rows={6}
                placeholder="Type your response here..."
                className="wp-textarea wp-full"
                value={reply.message}
                onChange={(e) => setReply({ ...reply, message: e.target.value })}
              />
              <p className="wp-desc">Emailed to {item.email}. A copy is saved in the activity below.</p>
            </div>
          </Postbox>
        </form>
      )}

      <Postbox title="Details" id="submission-details">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0 12px" }}>
          <div className="wp-field">
            <label htmlFor="submission-status" className="wp-label">Status</label>
            <ThemedSelect
              id="submission-status"
              className="wp-select wp-full"
              value={item.status === "Trash" ? "Read" : item.status}
              disabled={trashed || busy}
              onChange={(e) => patch({ action: "SET_STATUS", status: e.target.value }, "Status updated")}
            >
              <option value="New">New</option>
              <option value="Read">Read</option>
              <option value="Replied">Replied</option>
              <option value="Archived">Archived</option>
              <option value="Spam">Spam</option>
            </ThemedSelect>
          </div>
          <div className="wp-field">
            <label htmlFor="submission-priority" className="wp-label">Priority</label>
            <ThemedSelect
              id="submission-priority"
              className="wp-select wp-full"
              value={item.priority || "Medium"}
              disabled={trashed || busy}
              onChange={(e) => patch({ action: "SET_PRIORITY", priority: e.target.value }, "Priority updated")}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </ThemedSelect>
          </div>
        </div>
        <KV label="Phone" value={item.phone} />
        <KV label="Source" value={item.sourceForm || "Contact"} />
        <KV label="Source page" value={item.sourcePage} />
        <KV label="Replied" value={item.repliedAt ? formatDateTime(item.repliedAt) : ""} />
        <KV label="Last opened" value={item.lastViewedAt ? formatDateTime(item.lastViewedAt) : "First time"} />
        <KV label="IP address" value={item.ipAddress || "Not recorded"} mono />
        <KV label="ID" value={item._id} mono />
      </Postbox>

      <Postbox title="Activity & internal notes" id="submission-notes">
        {(item.internalNotes || []).length === 0 && (
          <p className="wp-muted" style={{ margin: "0 0 12px" }}>No internal activity recorded yet.</p>
        )}
        {item.internalNotes?.map((n, i) => (
          <div key={n._id || i} style={{ marginBottom: 12 }}>
            <div className="wp-note-body" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{n.content}</div>
            <div className="wp-note-meta">
              <span>by {n.author?.name || "Staff"}</span>
              <span>· {formatDateTime(n.createdAt)}</span>
            </div>
          </div>
        ))}
        {!trashed && (
          <form onSubmit={addNote}>
            <label htmlFor="submission-internal-note" className="wp-label">Add note</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                id="submission-internal-note"
                type="text"
                placeholder="Internal note (not sent to the customer)"
                className="wp-input"
                style={{ flex: 1, minWidth: 0 }}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button type="submit" className="wp-btn" disabled={busy || !note.trim()}>Add</button>
            </div>
          </form>
        )}
      </Postbox>
    </Drawer>
  );
}

export default function AdminContact() {
  const { showConfirm } = usePopup();
  const list = useInboxList(API);
  const { view, items, selectedIds, reload, setItems } = list;
  const isTrash = view === "trash";
  const [bulkAction, setBulkAction] = useState("");
  const [open, setOpen] = useState(null);
  const [isLive, setIsLive] = useState(false);

  // Live refresh polling
  useEffect(() => {
    if (!isLive) return undefined;
    const t = setInterval(() => reload({ silent: true }), 60000);
    return () => clearInterval(t);
  }, [isLive, reload]);

  const bulkOptions = isTrash
    ? ["restore", "delete"]
    : view === "Spam"
      ? ["notSpam", "trash"]
      : ["markRead", "markUnread", "archive", "markSpam", "trash"];

  const act = async (action, ids) => {
    const def = BULK[action];
    if (action === "delete") {
      const n = ids.length;
      const ok = await showConfirm(
        `${n} submission${n === 1 ? "" : "s"} will be deleted permanently. This cannot be undone.`,
        "Delete permanently?",
        { confirmText: "Delete Permanently", danger: true }
      );
      if (!ok) return false;
    }
    const done = await runBulk(API, action, ids, { verb: def.verb, noun: "submission" });
    reload();
    return done;
  };

  const applyBulk = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    if (await act(bulkAction, selectedIds)) list.setSelectedIds([]);
    setBulkAction("");
  };

  const onChanged = useCallback((updated) => {
    setItems((prev) => prev.map((it) => (it._id === updated._id ? { ...it, ...updated } : it)));
    reload({ silent: true });
  }, [reload, setItems]);

  const closeAfter = (fn) => async (item) => {
    if (await fn(item)) setOpen(null);
  };

  const exportToCSV = () => {
    if (items.length === 0) return;
    const headers = ["Name", "Email", "Phone", "Subject", "Message", "Source", "Status", "Priority", "Date"];
    const rows = items.map((it) => [
      it.name, it.email, it.phone || "", it.subject || "", it.message || "",
      it.sourceForm || "Contact", it.status, it.priority, new Date(it.createdAt).toLocaleString(),
    ]);
    const blob = new Blob([buildCsv([headers, ...rows])], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `submissions_export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <SelectAllBox label="Select all submissions" list={list} />
      </th>
      <th scope="col" className="wp-hide-sm" style={{ width: "22%" }}>Author</th>
      <th scope="col">Submission</th>
      <th scope="col" className="wp-hide-sm">Source</th>
      <th scope="col" className="wp-hide-sm">Status</th>
      <th scope="col" className="wp-hide-sm">Submitted on</th>
    </tr>
  );

  return (
    <RequirePermission permission="submissions.view">
      <Page>
        <PageHeader title="Contact Submissions" />

        <StatusViews
          label="Filter submissions by status"
          views={VIEWS}
          current={view}
          counts={list.counts}
          onChange={(v) => { list.setView(v); setBulkAction(""); }}
        />

        <div className="wp-toolbar">
          <BulkActions
            id="submissions-bulk-action"
            options={bulkOptions.map((k) => [k, BULK[k].label])}
            value={bulkAction}
            onChange={setBulkAction}
            onApply={applyBulk}
            disabled={!bulkAction || selectedIds.length === 0}
          />
          <button type="button" onClick={exportToCSV} className="wp-btn" disabled={items.length === 0}>
            Export to CSV
          </button>
          <button
            type="button"
            className="wp-btn"
            onClick={() => setIsLive(!isLive)}
            aria-pressed={isLive}
            title="Refresh the list automatically every 60 seconds"
          >
            <span
              aria-hidden="true"
              className={isLive ? "animate-pulse" : undefined}
              style={{ width: 8, height: 8, borderRadius: "50%", background: isLive ? "#00a32a" : "#c3c4c7", display: "inline-block" }}
            />
            Live refresh: {isLive ? "On" : "Off"}
          </button>
          <span className="wp-spacer" />
          <SearchForm
            id="submissions-search"
            label="Search submissions"
            placeholder="Name, email, subject, message..."
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
                <SkeletonRows cols={5} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="wp-muted">
                    {list.query ? `No submissions match “${list.query}”.` : isTrash ? "The Trash is empty." : "No submissions found."}
                  </td>
                </tr>
              ) : (
                items.map((s) => {
                  const selected = selectedIds.includes(s._id);
                  const unread = s.status === "New" && !isTrash;
                  return (
                    <tr
                      key={s._id}
                      className={selected ? "is-selected" : undefined}
                      style={unread && !selected ? { boxShadow: "inset 3px 0 0 #2271b1" } : undefined}
                    >
                      <td className="wp-check-col">
                        <input
                          type="checkbox"
                          aria-label={`Select submission from ${s.name}`}
                          checked={selected}
                          onChange={() => list.toggleSelect(s._id)}
                        />
                      </td>
                      <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <span className="wp-avatar" aria-hidden="true">{s.name?.charAt(0).toUpperCase()}</span>
                          <div style={{ minWidth: 0 }}>
                            <div className="wp-strong" style={{ fontWeight: unread ? 700 : 600 }}>{s.name}</div>
                            <a href={`mailto:${s.email}`} className="wp-link wp-small" style={{ wordBreak: "break-all" }}>{s.email}</a>
                            {s.phone && <div className="wp-muted wp-small">{s.phone}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                        <button
                          type="button"
                          onClick={() => setOpen(s)}
                          className="wp-row-title"
                          style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left", fontWeight: unread ? 700 : 600 }}
                        >
                          {s.subject || `Message from ${s.name}`}
                        </button>
                        <p className="line-clamp-2" style={{ margin: "2px 0 0", maxWidth: 640 }}>{s.message}</p>
                        <div className="wp-mobile-meta">
                          <span style={{ wordBreak: "break-all" }}>{s.name} · {s.email}</span>
                          <br />
                          <span className={`wp-pill wp-pill-sm ${statusPillClass(s.status)}`}>{s.status}</span>
                          {" · "}{s.priority} priority · {new Date(s.createdAt).toLocaleDateString()}
                        </div>
                        <div className="wp-row-actions">
                          <span><button type="button" onClick={() => setOpen(s)}>View</button></span>
                          {isTrash ? (
                            <>
                              <span><button type="button" onClick={() => act("restore", [s._id])}>Restore</button></span>
                              <span><button type="button" className="is-danger" onClick={() => act("delete", [s._id])}>Delete permanently</button></span>
                            </>
                          ) : (
                            <>
                              {s.status === "New" ? (
                                <span><button type="button" onClick={() => act("markRead", [s._id])}>Mark read</button></span>
                              ) : s.status === "Read" ? (
                                <span><button type="button" onClick={() => act("markUnread", [s._id])}>Mark unread</button></span>
                              ) : null}
                              {s.status !== "Spam" && s.status !== "Archived" && (
                                <span><button type="button" onClick={() => act("archive", [s._id])}>Archive</button></span>
                              )}
                              {s.status === "Spam" ? (
                                <span><button type="button" onClick={() => act("notSpam", [s._id])}>Not spam</button></span>
                              ) : (
                                <span><button type="button" className="is-danger" onClick={() => act("markSpam", [s._id])}>Spam</button></span>
                              )}
                              <span><button type="button" className="is-danger" onClick={() => act("trash", [s._id])}>Trash</button></span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="wp-hide-sm">
                        <span className={`wp-pill wp-pill-sm ${sourcePillClass(s.sourceForm)}`}>{s.sourceForm || "Contact"}</span>
                      </td>
                      <td className="wp-hide-sm">
                        <span className={`wp-pill ${statusPillClass(s.status)}`}>{s.status}</span>
                        <div className="wp-muted wp-small" style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, whiteSpace: "nowrap" }}>
                          <Flag className="w-3 h-3" aria-hidden="true" style={{ color: priorityColor(s.priority) }} />
                          {s.priority} priority
                        </div>
                      </td>
                      <td className="wp-hide-sm wp-muted" style={{ whiteSpace: "nowrap" }}>
                        {formatDateTime(s.createdAt)}
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
          <Pager pagination={list.pagination} onPage={list.goToPage} />
        </div>

        {open && (
          <SubmissionDrawer
            key={open._id}
            initial={open}
            onClose={() => setOpen(null)}
            onChanged={onChanged}
            onTrash={closeAfter((it) => act("trash", [it._id]))}
            onRestore={closeAfter((it) => act("restore", [it._id]))}
            onDelete={closeAfter((it) => act("delete", [it._id]))}
          />
        )}
      </Page>
    </RequirePermission>
  );
}
