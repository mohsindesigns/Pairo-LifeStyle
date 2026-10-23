"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import { Page, PageHeader } from "@/components/admin/ui";
import { getProductUrl } from "@/lib/routes";

export default function AdminProductQuestionsPage() {
  const { showConfirm } = usePopup();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [stats, setStats] = useState({ pendingCount: 0, approvedCount: 0, hiddenCount: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [status, setStatus] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [replyingQuestion, setReplyingQuestion] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [expandedIds, setExpandedIds] = useState({});

  useEffect(() => {
    fetchQuestions();
  }, [page, status, appliedSearch]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({ page, status, search: appliedSearch, limit: 10 });
      const res = await fetch(`/api/admin/products/questions?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch questions");
      const data = await res.json();
      setQuestions(data.questions || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setStats(data.stats || { pendingCount: 0, approvedCount: 0, hiddenCount: 0 });
    } catch (err) {
      console.error(err);
      toast.error("Error loading questions");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchTerm);
  };

  const handleStatusChange = (newStatus) => {
    setPage(1);
    setStatus(newStatus);
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === "Approved" ? "Hidden" : "Approved";
    try {
      const res = await fetch(`/api/admin/products/questions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_status", status: nextStatus })
      });
      if (!res.ok) throw new Error("Failed to toggle status");
      toast.success(`Question ${nextStatus === "Approved" ? "made public" : "hidden"}`);
      fetchQuestions();
    } catch (err) {
      toast.error("Error updating status");
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) { toast.error("Reply cannot be empty"); return; }
    setReplying(true);
    try {
      const res = await fetch(`/api/admin/products/questions/${replyingQuestion._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", replyText: replyText.trim() })
      });
      if (!res.ok) throw new Error("Failed to submit reply");
      toast.success("Reply saved successfully");
      setReplyingQuestion(null);
      setReplyText("");
      fetchQuestions();
    } catch (err) {
      toast.error("Failed to submit reply");
    } finally {
      setReplying(false);
    }
  };

  const handleDeleteQuestion = async (id) => {
    const ok = await showConfirm("Delete this question permanently?");
    if (ok) {
      try {
        const res = await fetch(`/api/admin/products/questions/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        toast.success("Question deleted");
        fetchQuestions();
      } catch {
        toast.error("Error deleting question");
      }
    }
  };

  const toggleExpand = (id) => setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));

  const statusPillClass = (s) =>
    s === "Approved" ? "wp-st-published" : s === "Pending" ? "wp-st-pending" : "wp-st-draft";

  const counts = {
    All: (stats.pendingCount || 0) + (stats.approvedCount || 0) + (stats.hiddenCount || 0),
    Pending: stats.pendingCount,
    Approved: stats.approvedCount,
    Hidden: stats.hiddenCount,
  };

  const initials = (name) => (name || "?").trim().charAt(0).toUpperCase();

  const pagination = totalPages > 1 && (
    <div className="wp-pages">
      <button
        type="button"
        className="wp-pager"
        onClick={() => setPage(p => Math.max(1, p - 1))}
        disabled={page === 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span>{page} of {totalPages}</span>
      <button
        type="button"
        className="wp-pager"
        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <RequirePermission permission="products.view">
    <Page>
      <PageHeader title="Product Questions" />
      <p className="wp-desc" style={{ marginTop: 0 }}>Moderate, reply to, and publish customer questions.</p>

      <div className="wp-subsub" role="tablist" aria-label="Filter questions by status">
        {["All", "Pending", "Approved", "Hidden"].map((s, i) => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center" }}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={status === s}
              className={status === s ? "is-current" : undefined}
              onClick={() => handleStatusChange(s)}
            >
              {s} <span className="wp-count">({counts[s] ?? 0})</span>
            </button>
          </span>
        ))}
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <form onSubmit={handleSearchSubmit} className="wp-search" role="search">
          <label htmlFor="questions-search" className="sr-only">Search questions</label>
          <input
            id="questions-search"
            type="search"
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="wp-input"
          />
          <button type="submit" className="wp-btn">Search questions</button>
        </form>
      </div>

      {pagination && (
        <div className="wp-toolbar">
          <span className="wp-spacer" />
          {pagination}
        </div>
      )}

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>
            <tr>
              <th scope="col" className="wp-hide-sm" style={{ width: "22%" }}>Author</th>
              <th scope="col">Question</th>
              <th scope="col" className="wp-hide-sm" style={{ width: "20%" }}>In response to</th>
              <th scope="col" className="wp-hide-sm" style={{ width: 120 }}>Submitted on</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="wp-muted">Loading questions…</td></tr>
            ) : questions.length === 0 ? (
              <tr><td colSpan={4} className="wp-muted">No questions found.</td></tr>
            ) : (
              questions.map((q) => {
                const isExpanded = expandedIds[q._id];
                const hasReply = q.replies && q.replies.length > 0;
                const isPending = q.status === "Pending";
                const isReplying = replyingQuestion?._id === q._id;
                const dateLabel = new Date(q.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                const productLink = q.productId ? (
                  <a href={getProductUrl(q.productId)} target="_blank" rel="noopener noreferrer" className="wp-link" style={{ wordBreak: "break-word" }}>
                    {q.productId.name}
                  </a>
                ) : (
                  <span style={{ color: "#d63638" }}>Deleted product</span>
                );
                return (
                    <tr key={q._id} style={isPending ? { background: "#fef7f1" } : undefined}>
                      <td className="wp-hide-sm" style={{ boxShadow: isPending ? "inset 4px 0 0 #d63638" : undefined, wordBreak: "break-word" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <div className="wp-avatar" aria-hidden="true">{initials(q.customerName)}</div>
                          <div style={{ minWidth: 0 }}>
                            <div className="wp-strong">{q.customerName || "Anonymous"}</div>
                            {q.customerEmail && <a href={`mailto:${q.customerEmail}`} className="wp-link wp-small" style={{ wordBreak: "break-all" }}>{q.customerEmail}</a>}
                          </div>
                        </div>
                      </td>
                      <td className={isPending ? "max-[782px]:shadow-[inset_4px_0_0_#d63638]" : undefined} style={{ minWidth: 0, wordBreak: "break-word" }}>
                        <div className="wp-mobile-meta" style={{ marginTop: 0, marginBottom: 4 }}>
                          <span className="wp-strong">{q.customerName || "Anonymous"}</span>
                          {q.customerEmail ? ` · ${q.customerEmail}` : ""}
                        </div>
                        <div className="wp-small wp-muted" style={{ marginBottom: 4, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                          <span className={`wp-pill wp-pill-sm ${statusPillClass(q.status)}`}>{q.status}</span>
                          {hasReply && <span>Replied</span>}
                        </div>
                        <p style={{ margin: 0, color: "#1d2327" }}>{q.question}</p>
                        <div className="wp-mobile-meta">In response to: {productLink} · {dateLabel}</div>

                        <div className="wp-row-actions">
                          <span>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(q._id, q.status)}
                              style={{ color: q.status === "Approved" ? "#996800" : "#00a32a" }}
                            >
                              {q.status === "Approved" ? "Unapprove" : "Approve"}
                            </button>
                          </span>
                          <span>
                            <button type="button" onClick={() => { setReplyingQuestion(q); setReplyText(q.replies?.[0]?.answer || ""); }}>
                              {hasReply ? "Edit reply" : "Reply"}
                            </button>
                          </span>
                          <span>
                            <button type="button" onClick={() => toggleExpand(q._id)} aria-expanded={!!isExpanded}>
                              {isExpanded ? "Hide answer" : "View answer"}
                            </button>
                          </span>
                          <span>
                            <button type="button" onClick={() => handleDeleteQuestion(q._id)} className="is-danger">Delete permanently</button>
                          </span>
                        </div>

                        {isExpanded && (
                          <div style={{ marginTop: 8 }}>
                            {hasReply ? (
                              <div className="wp-note-body">
                                <span className="wp-small wp-muted">Store answer:</span>
                                <div>{q.replies[0].answer}</div>
                              </div>
                            ) : (
                              <p className="wp-muted wp-small" style={{ margin: 0 }}>No reply yet — use Reply to answer this question.</p>
                            )}
                          </div>
                        )}

                        {isReplying && (
                          <div style={{ marginTop: 10, border: "1px solid #c3c4c7", background: "#fff", padding: 10 }} role="group" aria-labelledby={`q-reply-label-${q._id}`}>
                            <label id={`q-reply-label-${q._id}`} htmlFor={`q-reply-${q._id}`} className="wp-label">Reply to question</label>
                            <textarea
                              id={`q-reply-${q._id}`}
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              rows={4}
                              placeholder="Type your official store response here..."
                              className="wp-textarea wp-full"
                            />
                            <p className="wp-desc">Replying will auto-approve the question and email your response to the customer.</p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                              <button type="button" onClick={handleSendReply} disabled={replying} className="wp-btn wp-btn-primary">
                                {replying ? "Submitting..." : "Submit Answer"}
                              </button>
                              <button type="button" onClick={() => setReplyingQuestion(null)} className="wp-btn">Cancel</button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          {q.productId?.images?.[0] && (
                            <div className="wp-thumb" style={{ width: 32, height: 32 }}>
                              <img src={q.productId.images[0]} alt="" />
                            </div>
                          )}
                          <div style={{ minWidth: 0 }}>{productLink}</div>
                        </div>
                      </td>
                      <td className="wp-hide-sm wp-muted">{dateLabel}</td>
                    </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="wp-toolbar">
          <span className="wp-spacer" />
          {pagination}
        </div>
      )}
    </Page>
    </RequirePermission>
  );
}
