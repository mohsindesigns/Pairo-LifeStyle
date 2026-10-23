"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Send,
  X,
} from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { toast } from "react-hot-toast";
import RequirePermission from "@/components/admin/RequirePermission";

export default function AdminContact() {
  // --- State: Data & Pagination ---
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ all: 0, New: 0, Read: 0, Replied: 0, Archived: 0, Spam: 0 });
  const [pagination, setPagination] = useState({ total: 0, pages: 1, page: 1, limit: 20 });
  
  // --- State: Filters & Search ---
  const [status, setStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState(""); // Only trigger fetch on search button or enter
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");

  // --- State: CRM Detail View ---
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [replyMode, setReplyMode] = useState(false);
  const [replyData, setReplyData] = useState({ subject: "", message: "" });
  const [internalNote, setInternalNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isLive, setIsLive] = useState(false); // New: Live mode

  // --- Fetch Logic ---
  const fetchSubmissions = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        status,
        search: searchQuery,
      });
      const res = await fetch(`/api/admin/submissions?${params}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items);
        setPagination(data.pagination);
        setCounts(data.counts);
      }
    } catch (err) {
      if (!isSilent) toast.error("Failed to load submissions");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [pagination.page, pagination.limit, status, searchQuery]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchSubmissions();
    });
  }, [fetchSubmissions]);

  // Live Refresh Polling
  useEffect(() => {
    let interval;
    if (isLive) {
      interval = setInterval(() => {
        fetchSubmissions(true);
      }, 60000); // Poll every 60 seconds
    }
    return () => clearInterval(interval);
  }, [isLive, fetchSubmissions]);

  // --- CRM Actions ---
  const handleAction = async (id, action, payload = {}) => {
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, action })
      });
      if (res.ok) {
        const updated = await res.json();
        setItems(items.map(it => it._id === id ? updated : it));
        if (selectedItem?._id === id) setSelectedItem(updated);
        toast.success(`Action: ${action} successful`);
      }
    } catch (err) {
      toast.error("Action failed");
    }
  };

  const handleBulkAction = async () => {
    if (selectedIds.length === 0 || bulkAction === "Bulk actions") return;
    
    const actionMap = {
      "Mark as read": "markRead",
      "Move to Trash": "trash",
      "Mark as Spam": "markSpam"
    };
    
    const action = actionMap[bulkAction];
    if (!action) return;

    try {
      const res = await fetch("/api/admin/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: selectedIds })
      });
      if (res.ok) {
        toast.success("Bulk action completed");
        setSelectedIds([]);
        fetchSubmissions();
      }
    } catch (err) {
      toast.error("Bulk action failed");
    }
  };

  const sendReply = async () => {
    if (!replyData.subject || !replyData.message) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/submissions/${selectedItem._id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyData)
      });
      if (res.ok) {
        toast.success("Reply sent successfully");
        setReplyMode(false);
        setReplyData({ subject: "", message: "" });
        // Refresh detail to show the note
        const updatedRes = await fetch(`/api/admin/submissions/${selectedItem._id}`);
        const updated = await updatedRes.json();
        setSelectedItem(updated);
        setItems(items.map(it => it._id === updated._id ? updated : it));
      }
    } catch (err) {
      toast.error("Failed to send reply");
    } finally {
      setSubmitting(false);
    }
  };

  const addNote = async () => {
    if (!internalNote) return;
    try {
      const res = await fetch(`/api/admin/submissions/${selectedItem._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: internalNote, action: 'ADD_NOTE' })
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedItem(updated);
        setInternalNote("");
        toast.success("Note added");
      }
    } catch (err) {
      toast.error("Failed to add note");
    }
  };

  const exportToCSV = () => {
    if (items.length === 0) return;
    const headers = ["Name", "Email", "Subject", "Status", "Priority", "Date"];
    const rows = items.filter(it => it !== null).map(it => [
      it.name,
      it.email,
      it.subject || "N/A",
      it.status,
      it.priority,
      new Date(it.createdAt).toLocaleString()
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `submissions_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Helpers ---
  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) setSelectedIds([]);
    else setSelectedIds(items.filter(i => i !== null).map(i => i._id));
  };

  const toggleSelectOne = (id) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(x => x !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const STATUS_TABS = [
    ["all", "All", counts.all],
    ["New", "Pending", counts.New],
    ["Read", "Read", counts.Read],
    ["Replied", "Replied", counts.Replied],
    ["Spam", "Spam", counts.Spam],
  ];

  const statusPillClass = (st) =>
    st === 'New' ? 'wp-st-out' :
    st === 'Replied' ? 'wp-st-delivered' :
    st === 'Spam' ? 'wp-st-cancelled' :
    'wp-st-draft';

  const priorityColor = (pr) =>
    pr === 'High' ? '#d63638' :
    pr === 'Medium' ? '#dba617' :
    '#72aee6';

  const sourcePillClass = (src) =>
    src === 'Email Subscriber' || src === 'Newsletter' ? 'wp-st-packed' :
    src === 'Contact' || !src ? 'wp-st-shipped' :
    'wp-st-draft';

  const headerRow = (id) => (
    <tr>
      <td className="wp-check-col">
        <input
          id={id}
          type="checkbox"
          aria-label="Select all submissions"
          checked={selectedIds.length === items.length && items.length > 0}
          onChange={toggleSelectAll}
        />
      </td>
      <th scope="col">Author</th>
      <th scope="col">Submission</th>
      <th scope="col" className="wp-hide-sm">Source</th>
      <th scope="col" className="wp-hide-sm">Status / Priority</th>
      <th scope="col" className="wp-hide-sm">Submitted on</th>
    </tr>
  );

  const pager = (
    <div className="wp-pages">
      <span>{pagination.total} items</span>
      <button
        type="button"
        className="wp-pager"
        aria-label="Previous page"
        disabled={pagination.page <= 1}
        onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>
      <span>{pagination.page} of {pagination.pages}</span>
      <button
        type="button"
        className="wp-pager"
        aria-label="Next page"
        disabled={pagination.page >= pagination.pages}
        onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
      >
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <RequirePermission permission="submissions.view">
    <AdminPageLayout
      title="Submissions"
      breadcrumbs={[{ label: "Submissions" }]}
    >
      {/* --- 1. Filter Links --- */}
      <div className="wp-subsub" role="tablist" aria-label="Filter submissions by status">
        {STATUS_TABS.map(([val, label, count], i) => (
          <Fragment key={val}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={status === val}
              className={status === val ? "is-current" : undefined}
              onClick={() => setStatus(val)}
            >
              {label} <span className="wp-count">({count})</span>
            </button>
          </Fragment>
        ))}
        <span className="wp-sep" aria-hidden="true">|</span>
        <button
          type="button"
          onClick={() => setIsLive(!isLive)}
          aria-pressed={isLive}
          title="Refresh the list automatically every 60 seconds"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <span
            aria-hidden="true"
            className={isLive ? "animate-pulse" : undefined}
            style={{ width: 8, height: 8, borderRadius: "50%", background: isLive ? "#00a32a" : "#c3c4c7", display: "inline-block" }}
          />
          Live refresh: {isLive ? "On" : "Off"}
        </button>
      </div>

      {/* --- 2. Action Bar --- */}
      <div className="wp-toolbar">
        <label htmlFor="submissions-bulk-action" className="sr-only">Select bulk action</label>
        <select
          id="submissions-bulk-action"
          value={bulkAction}
          onChange={(e) => setBulkAction(e.target.value)}
          className="wp-select"
        >
          <option>Bulk actions</option>
          <option>Mark as read</option>
          <option>Move to Trash</option>
          <option>Mark as Spam</option>
        </select>
        <button type="button" onClick={handleBulkAction} className="wp-btn">
          Apply
        </button>
        <button type="button" onClick={exportToCSV} className="wp-btn">
          Export to CSV
        </button>

        <span className="wp-spacer" />

        <div className="wp-search" role="search">
          <label htmlFor="submissions-search" className="sr-only">Search submissions</label>
          <input
            id="submissions-search"
            type="search"
            placeholder="Search submissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearchQuery(searchTerm)}
            className="wp-input"
          />
          <button type="button" onClick={() => setSearchQuery(searchTerm)} className="wp-btn">
            Search submissions
          </button>
        </div>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pager}
      </div>

      {/* --- 3. WP List Table --- */}
      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow("submissions-select-all-top")}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="wp-muted">Loading submissions...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="wp-muted">No submissions found.</td></tr>
            ) : (
              items.filter(s => s !== null).map((s) => (
                <tr
                  key={s._id}
                  className={selectedIds.includes(s._id) ? "is-selected" : undefined}
                  style={s?.status === 'New' && !selectedIds.includes(s._id) ? { boxShadow: "inset 3px 0 0 #2271b1" } : undefined}
                >
                  <td className="wp-check-col">
                    <input
                      type="checkbox"
                      aria-label={`Select submission from ${s.name}`}
                      checked={selectedIds.includes(s._id)}
                      onChange={() => toggleSelectOne(s._id)}
                    />
                  </td>
                  <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span className="wp-avatar wp-hide-sm" aria-hidden="true">
                        {s.name?.charAt(0).toUpperCase()}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="wp-strong" style={{ fontWeight: s.status === 'New' ? 700 : 600 }}>{s.name}</div>
                        <a href={`mailto:${s.email}`} className="wp-link wp-small" style={{ wordBreak: "break-all" }}>{s.email}</a>
                        {s.phone && <div className="wp-muted wp-small">{s.phone}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                    {s.subject && (
                      <button
                        type="button"
                        onClick={() => { setSelectedItem(s); setIsDetailOpen(true); }}
                        className="wp-row-title"
                        style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left", fontWeight: s.status === 'New' ? 700 : 600 }}
                      >
                        {s.subject}
                      </button>
                    )}
                    <p className="line-clamp-2" style={{ margin: "2px 0 0", maxWidth: 640 }}>{s.message}</p>
                    <div className="wp-mobile-meta">
                      <span className={`wp-pill wp-pill-sm ${statusPillClass(s.status)}`}>{s.status}</span>
                      {" · "}{s.priority} priority
                      {" · "}{new Date(s.createdAt).toLocaleDateString()}
                    </div>

                    {/* Row actions */}
                    <div className="wp-row-actions">
                      <span><button type="button" onClick={() => { setSelectedItem(s); setIsDetailOpen(true); }}>View Detail</button></span>
                      {s.status === 'New' ? (
                        <span><button type="button" onClick={() => handleAction(s._id, 'SET_STATUS', { status: 'Read' })}>Mark as Read</button></span>
                      ) : (
                        <span><button type="button" onClick={() => { setSelectedItem(s); setIsDetailOpen(true); setReplyMode(true); }}>Reply</button></span>
                      )}
                      <span><button type="button" onClick={() => handleAction(s._id, 'trash')} className="is-danger">Trash</button></span>
                      <span><button type="button" onClick={() => handleAction(s._id, 'SET_STATUS', { status: 'Spam' })} className="is-danger">Spam</button></span>
                    </div>
                  </td>
                  <td className="wp-hide-sm">
                    <span className={`wp-pill wp-pill-sm ${sourcePillClass(s.sourceForm)}`}>
                      {s.sourceForm || 'Contact'}
                    </span>
                  </td>
                  <td className="wp-hide-sm">
                    <span className={`wp-pill ${statusPillClass(s.status)}`}>
                      {s.status}
                    </span>
                    <div className="wp-muted wp-small" style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <Flag className="w-3 h-3" aria-hidden="true" style={{ color: priorityColor(s.priority) }} />
                      {s.priority} Priority
                    </div>
                  </td>
                  <td className="wp-hide-sm wp-muted">
                    {new Date(s.createdAt).toLocaleDateString()} at {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>{headerRow("submissions-select-all-bottom")}</tfoot>
        </table>
      </div>

      {/* --- 4. Pagination --- */}
      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pager}
      </div>

      {/* --- 5. Detail view --- */}
      {isDetailOpen && selectedItem && (
        <div className="wp-modal-backdrop">
          <div
            className="wp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submission-detail-title"
            style={{ maxWidth: 1000 }}
          >
            {/* Header */}
            <div className="wp-modal-head" style={{ gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span className="wp-avatar" aria-hidden="true">
                  {selectedItem.name?.charAt(0).toUpperCase()}
                </span>
                <div style={{ minWidth: 0 }}>
                  <h2 id="submission-detail-title" style={{ wordBreak: "break-word" }}>{selectedItem.name}</h2>
                  <a href={`mailto:${selectedItem.email}`} className="wp-link" style={{ wordBreak: "break-all" }}>{selectedItem.email}</a>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="wp-btn"
                aria-label="Close"
                style={{ minWidth: 32, padding: "0 6px", flex: "none" }}
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="wp-modal-body" style={{ background: "#f0f0f1" }}>
              <div className="wp-cols">
                {/* Main */}
                <div className="wp-col-main">
                  <section className="wp-postbox" aria-labelledby="submission-message-title">
                    <div className="wp-postbox-head">
                      <h2 id="submission-message-title">{selectedItem.subject || "Message"}</h2>
                    </div>
                    <div className="wp-inside">
                      <div className="wp-note-body is-customer" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {selectedItem.message}
                      </div>
                      <div className="wp-note-meta">
                        <span>Received {new Date(selectedItem.createdAt).toLocaleString()}</span>
                        {selectedItem.sourcePage && <span>· Page: {selectedItem.sourcePage}</span>}
                      </div>
                    </div>
                    <div className="wp-box-foot">
                      <span className="wp-spacer" />
                      <button
                        type="button"
                        onClick={() => { setReplyMode(!replyMode); setReplyData({ subject: `Re: ${selectedItem.subject || 'Your Inquiry'}`, message: "" }); }}
                        className={replyMode ? "wp-btn" : "wp-btn wp-btn-primary"}
                      >
                        <Send className="w-4 h-4" aria-hidden="true" /> {replyMode ? "Cancel Reply" : "Reply to Customer"}
                      </button>
                    </div>
                  </section>

                  {/* Reply Interface */}
                  {replyMode && (
                    <section className="wp-postbox" aria-labelledby="submission-reply-title">
                      <div className="wp-postbox-head">
                        <h2 id="submission-reply-title">Send email reply</h2>
                      </div>
                      <div className="wp-inside">
                        <div className="wp-field">
                          <label htmlFor="submission-reply-subject" className="wp-label">Subject</label>
                          <input
                            id="submission-reply-subject"
                            type="text"
                            placeholder="Subject"
                            className="wp-input wp-full"
                            value={replyData.subject}
                            onChange={(e) => setReplyData({...replyData, subject: e.target.value})}
                          />
                        </div>
                        <div className="wp-field" style={{ marginBottom: 0 }}>
                          <label htmlFor="submission-reply-message" className="wp-label">Message</label>
                          <textarea
                            id="submission-reply-message"
                            rows={6}
                            placeholder="Type your response here..."
                            className="wp-textarea wp-full"
                            value={replyData.message}
                            onChange={(e) => setReplyData({...replyData, message: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="wp-box-foot">
                        <span className="wp-spacer" />
                        <button type="button" onClick={() => setReplyMode(false)} className="wp-btn">Cancel</button>
                        <button
                          type="button"
                          onClick={sendReply}
                          disabled={submitting}
                          className="wp-btn wp-btn-primary"
                        >
                          {submitting ? "Sending..." : "Dispatch Reply"}
                        </button>
                      </div>
                    </section>
                  )}

                  {/* Internal Notes & History */}
                  <section className="wp-postbox" aria-labelledby="submission-notes-title">
                    <div className="wp-postbox-head">
                      <h2 id="submission-notes-title">Activity &amp; internal notes</h2>
                    </div>
                    <div className="wp-inside">
                      {(selectedItem.internalNotes || []).length === 0 && (
                        <p className="wp-muted" style={{ margin: "0 0 12px" }}>No internal activity recorded yet.</p>
                      )}
                      {selectedItem.internalNotes?.map((note, i) => (
                        <div key={i} style={{ marginBottom: 12 }}>
                          <div className="wp-note-body" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{note.content}</div>
                          <div className="wp-note-meta">
                            <span>by {note.author?.name || 'Staff'}</span>
                            <span>· {new Date(note.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}

                      <label htmlFor="submission-internal-note" className="wp-label">Add note</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          id="submission-internal-note"
                          type="text"
                          placeholder="Add an internal note..."
                          className="wp-input"
                          style={{ flex: 1, minWidth: 0 }}
                          value={internalNote}
                          onChange={(e) => setInternalNote(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addNote()}
                        />
                        <button type="button" onClick={addNote} className="wp-btn">Add</button>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Side */}
                <div className="wp-col-side">
                  <section className="wp-postbox" aria-labelledby="submission-status-title">
                    <div className="wp-postbox-head">
                      <h2 id="submission-status-title">Submission</h2>
                    </div>
                    <div className="wp-inside">
                      <div className="wp-field">
                        <label htmlFor="submission-status" className="wp-label">Status</label>
                        <select
                          id="submission-status"
                          className="wp-select wp-full"
                          value={selectedItem.status}
                          onChange={(e) => handleAction(selectedItem._id, 'SET_STATUS', { status: e.target.value })}
                        >
                          <option value="New">New</option>
                          <option value="Read">Read</option>
                          <option value="Replied">Replied</option>
                          <option value="Archived">Archived</option>
                          <option value="Spam">Spam</option>
                        </select>
                      </div>
                      <div className="wp-field">
                        <label htmlFor="submission-priority" className="wp-label">Priority</label>
                        <select
                          id="submission-priority"
                          className="wp-select wp-full"
                          value={selectedItem.priority}
                          onChange={(e) => handleAction(selectedItem._id, 'SET_PRIORITY', { priority: e.target.value })}
                        >
                          <option value="Low">Low Priority</option>
                          <option value="Medium">Medium Priority</option>
                          <option value="High">High Priority</option>
                        </select>
                      </div>

                      <div className="wp-kv">
                        <span className="wp-kv-k wp-muted">Source page</span>
                        <span className="wp-kv-v" style={{ textAlign: "right", wordBreak: "break-all", minWidth: 0 }}>{selectedItem.sourcePage || 'N/A'}</span>
                      </div>
                      <div className="wp-kv">
                        <span className="wp-kv-k wp-muted">IP address</span>
                        <span className="wp-kv-v font-mono" style={{ wordBreak: "break-all" }}>{selectedItem.ipAddress || '127.0.0.1'}</span>
                      </div>
                      <div className="wp-kv">
                        <span className="wp-kv-k wp-muted">Last viewed</span>
                        <span className="wp-kv-v" style={{ textAlign: "right" }}>{selectedItem.lastViewedAt ? new Date(selectedItem.lastViewedAt).toLocaleString() : 'Never'}</span>
                      </div>
                      <div className="wp-kv">
                        <span className="wp-kv-k wp-muted">System ID</span>
                        <span className="wp-kv-v font-mono wp-small" style={{ fontWeight: 400, wordBreak: "break-all", minWidth: 0 }}>{selectedItem._id}</span>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>

            <div className="wp-modal-foot">
              <button type="button" onClick={() => setIsDetailOpen(false)} className="wp-btn">Close</button>
            </div>
          </div>
        </div>
      )}
    </AdminPageLayout>
    </RequirePermission>
  );
}
