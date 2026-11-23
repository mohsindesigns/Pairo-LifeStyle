"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import { Page, PageHeader, Notice, Skeleton, formatDate } from "@/components/admin/ui";
import { getProductUrl } from "@/lib/routes";
import ThemedSelect from "@/components/ui/ThemedSelect";

const PER_PAGE = 20;
const VIEWS = [
  { key: "All", label: "All" },
  { key: "Pending", label: "Pending" },
  { key: "Approved", label: "Approved" },
  { key: "Hidden", label: "Hidden" },
  { key: "Trash", label: "Trash" },
];

export default function AdminProductQuestionsPage() {
  const { showConfirm } = usePopup();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [questions, setQuestions] = useState([]);
  const [stats, setStats] = useState({ pendingCount: 0, approvedCount: 0, hiddenCount: 0, trashCount: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [status, setStatus] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);

  const [replyingQuestion, setReplyingQuestion] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState("");
  const [replying, setReplying] = useState(false);
  const [expandedIds, setExpandedIds] = useState({});

  const isTrash = status === "Trash";
  const requestRef = useRef(0);

  const fetchQuestions = useCallback(async () => {
    const reqId = ++requestRef.current;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({ page, status, search: appliedSearch, limit: PER_PAGE });
      const res = await fetch(`/api/admin/products/questions?${queryParams}`);
      const data = await res.json().catch(() => ({}));
      if (reqId !== requestRef.current) return; // a newer request is on its way
      if (!res.ok) throw new Error(data?.error || "Failed to load questions");
      setQuestions(data.questions || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
      setStats(data.stats || { pendingCount: 0, approvedCount: 0, hiddenCount: 0, trashCount: 0 });
      setLoadError("");
      // A page that emptied out (e.g. after trashing its last rows) steps back one page
      if ((data.questions || []).length === 0 && page > 1) setPage((p) => Math.max(1, p - 1));
    } catch (err) {
      if (reqId !== requestRef.current) return;
      console.error(err);
      setLoadError(err.message || "Failed to load questions");
    } finally {
      if (reqId === requestRef.current) setLoading(false);
    }
  }, [page, status, appliedSearch]);

  useEffect(() => {
    Promise.resolve().then(fetchQuestions);
  }, [fetchQuestions]);

  // Live search: apply the typed term after a short pause
  useEffect(() => {
    if (searchTerm.trim() === appliedSearch) return;
    const t = setTimeout(() => {
      setPage(1);
      setSelectedIds([]);
      setAppliedSearch(searchTerm.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm, appliedSearch]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSelectedIds([]);
    setAppliedSearch(searchTerm.trim());
  };

  const handleStatusChange = (newStatus) => {
    setPage(1);
    setSelectedIds([]);
    setBulkAction("");
    setReplyingQuestion(null);
    setStatus(newStatus);
  };

  const goToPage = (n) => {
    setPage(Math.min(Math.max(1, n), totalPages));
    setSelectedIds([]);
  };

  const errorFrom = async (res, fallback) => {
    const data = await res.json().catch(() => ({}));
    return data?.error || fallback;
  };

  // ---- single-row API calls (return the Response so bulk actions can count results) ----
  const setStatusReq = (id, nextStatus) =>
    fetch(`/api/admin/products/questions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_status", status: nextStatus })
    });
  const trashReq = (id) => fetch(`/api/admin/products/questions/${id}`, { method: "DELETE" });
  const restoreReq = (id) =>
    fetch(`/api/admin/products/questions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" })
    });
  const permanentReq = (id) => fetch(`/api/admin/products/questions/${id}?permanent=true`, { method: "DELETE" });

  const runSingle = async (request, success, failure) => {
    try {
      const res = await request();
      if (!res.ok) throw new Error(await errorFrom(res, failure));
      toast.success(success);
      fetchQuestions();
    } catch (err) {
      toast.error(err.message || failure);
    }
  };

  const handleSetStatus = (q, nextStatus) =>
    runSingle(
      () => setStatusReq(q._id, nextStatus),
      nextStatus === "Approved" ? "Question approved and shown on the product page" : "Question hidden from the product page",
      "Failed to update the question"
    );

  const handleTrash = (q) => {
    if (replyingQuestion?._id === q._id) setReplyingQuestion(null);
    runSingle(() => trashReq(q._id), "Question moved to trash", "Failed to move the question to trash");
  };

  const handleRestore = (q) => runSingle(() => restoreReq(q._id), "Question restored", "Failed to restore the question");

  const handleDeletePermanently = async (q) => {
    const ok = await showConfirm(
      `Permanently delete the question from ${q.customerName || "this customer"}? This cannot be undone.`,
      "Delete permanently",
      { confirmText: "Delete permanently", danger: true }
    );
    if (!ok) return;
    runSingle(() => permanentReq(q._id), "Question permanently deleted", "Failed to delete the question");
  };

  const openReply = (q) => {
    setReplyingQuestion(q);
    setReplyText(q.replies?.[0]?.answer || "");
    setReplyError("");
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) { setReplyError("Write an answer before submitting."); return; }
    setReplying(true);
    setReplyError("");
    try {
      const res = await fetch(`/api/admin/products/questions/${replyingQuestion._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", replyText: replyText.trim() })
      });
      if (!res.ok) throw new Error(await errorFrom(res, "Failed to save the answer"));
      toast.success(replyingQuestion.replies?.length ? "Answer updated" : "Answer published");
      setReplyingQuestion(null);
      setReplyText("");
      setExpandedIds((prev) => ({ ...prev, [replyingQuestion._id]: true }));
      fetchQuestions();
    } catch (err) {
      setReplyError(err.message || "Failed to save the answer");
    } finally {
      setReplying(false);
    }
  };

  // ---- bulk ----
  const bulkOptions = isTrash
    ? [{ value: "restore", label: "Restore" }, { value: "permanent", label: "Delete permanently" }]
    : [
        { value: "approve", label: "Approve" },
        { value: "hide", label: "Hide" },
        { value: "trash", label: "Move to Trash" },
      ];

  const handleBulkApply = async () => {
    if (!bulkAction) { toast.error("Choose a bulk action first"); return; }
    if (selectedIds.length === 0) { toast.error("Select at least one question"); return; }
    const label = bulkOptions.find((o) => o.value === bulkAction)?.label || bulkAction;
    if (bulkAction === "permanent") {
      const ok = await showConfirm(
        `Permanently delete ${selectedIds.length} question${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`,
        "Delete permanently",
        { confirmText: "Delete permanently", danger: true }
      );
      if (!ok) return;
    }
    const request = {
      approve: (id) => setStatusReq(id, "Approved"),
      hide: (id) => setStatusReq(id, "Hidden"),
      trash: trashReq,
      restore: restoreReq,
      permanent: permanentReq,
    }[bulkAction];
    setBulkRunning(true);
    let ok = 0;
    let failed = 0;
    for (const id of selectedIds) {
      try {
        const res = await request(id);
        if (res.ok) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setBulkRunning(false);
    setSelectedIds([]);
    setBulkAction("");
    if (bulkAction === "trash" || bulkAction === "permanent") setReplyingQuestion(null);
    fetchQuestions();
    if (failed === 0) toast.success(`${label}: ${ok} done`);
    else toast.error(`${label}: ${ok} done, ${failed} failed`);
  };

  const visibleIds = questions.map((q) => q._id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someSelected = visibleIds.some((id) => selectedIds.includes(id));
  const toggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : visibleIds);

  const toggleExpand = (id) => setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  const statusPillClass = (s) =>
    s === "Approved" ? "wp-st-published" : s === "Pending" ? "wp-st-pending" : "wp-st-draft";

  const counts = {
    All: (stats.pendingCount || 0) + (stats.approvedCount || 0) + (stats.hiddenCount || 0),
    Pending: stats.pendingCount || 0,
    Approved: stats.approvedCount || 0,
    Hidden: stats.hiddenCount || 0,
    Trash: stats.trashCount || 0,
  };

  const initials = (name) => (name || "?").trim().charAt(0).toUpperCase();

  const pagination = (
    <div className="wp-pages">
      <span>{total} {total === 1 ? "item" : "items"}</span>
      {totalPages > 1 && (
        <>
          <button type="button" className="wp-pager" aria-label="First page" disabled={page <= 1} onClick={() => goToPage(1)}><ChevronsLeft className="w-4 h-4" /></button>
          <button type="button" className="wp-pager" aria-label="Previous page" disabled={page <= 1} onClick={() => goToPage(page - 1)}><ChevronLeft className="w-4 h-4" /></button>
          <span>{page} of {totalPages}</span>
          <button type="button" className="wp-pager" aria-label="Next page" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}><ChevronRight className="w-4 h-4" /></button>
          <button type="button" className="wp-pager" aria-label="Last page" disabled={page >= totalPages} onClick={() => goToPage(totalPages)}><ChevronsRight className="w-4 h-4" /></button>
        </>
      )}
    </div>
  );

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input
          type="checkbox"
          aria-label="Select all questions"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={toggleSelectAll}
          disabled={questions.length === 0}
        />
      </th>
      <th scope="col" className="wp-hide-sm" style={{ width: "22%" }}>Author</th>
      <th scope="col">Question</th>
      <th scope="col" className="wp-hide-sm" style={{ width: "20%" }}>In response to</th>
      <th scope="col" className="wp-hide-sm" style={{ width: 120 }}>{isTrash ? "Trashed on" : "Submitted on"}</th>
    </tr>
  );

  const emptyText = appliedSearch
    ? `No questions match "${appliedSearch}".`
    : isTrash
      ? "No questions in the Trash."
      : status === "All"
        ? "No product questions yet. Questions customers ask on product pages appear here."
        : `No ${status.toLowerCase()} questions.`;

  return (
    <RequirePermission permission={["products.view", "reviews.view"]}>
    <Page>
      <PageHeader title="Product Questions" />
      <p className="wp-desc" style={{ marginTop: 0 }}>Moderate, answer and publish the questions customers ask on product pages.</p>

      <div className="wp-subsub" role="tablist" aria-label="Filter questions by status">
        {VIEWS.map((v, i) => (
          <span key={v.key} style={{ display: "inline-flex", alignItems: "center" }}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={status === v.key}
              className={status === v.key ? "is-current" : undefined}
              onClick={() => handleStatusChange(v.key)}
            >
              {v.label} <span className="wp-count">({counts[v.key] ?? 0})</span>
            </button>
          </span>
        ))}
      </div>

      <div className="wp-toolbar">
        <label htmlFor="questions-bulk-action" className="sr-only">Select bulk action</label>
        <ThemedSelect
          id="questions-bulk-action"
          className="wp-select"
          value={bulkAction}
          onChange={(e) => setBulkAction(e.target.value)}
        >
          <option value="">Bulk actions</option>
          {bulkOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </ThemedSelect>
        <button type="button" onClick={handleBulkApply} disabled={bulkRunning} className="wp-btn">
          {bulkRunning ? "Applying…" : "Apply"}
        </button>
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

      {loadError && (
        <Notice type="error" onDismiss={() => setLoadError("")}>
          {loadError}.{" "}
          <button type="button" className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={fetchQuestions}>Try again</button>
        </Notice>
      )}

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pagination}
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading && questions.length === 0 ? (
              [0, 1, 2, 3].map((i) => (
                <tr key={`sk-${i}`}>
                  <td className="wp-check-col" />
                  <td className="wp-hide-sm"><Skeleton height={14} width="70%" /></td>
                  <td><Skeleton height={14} /><Skeleton height={12} width="60%" style={{ marginTop: 6 }} /></td>
                  <td className="wp-hide-sm"><Skeleton height={14} width="80%" /></td>
                  <td className="wp-hide-sm"><Skeleton height={14} width={80} /></td>
                </tr>
              ))
            ) : questions.length === 0 ? (
              <tr><td colSpan={5} className="wp-empty" style={{ padding: "14px 10px" }}>{emptyText}</td></tr>
            ) : (
              questions.map((q) => {
                const isExpanded = expandedIds[q._id];
                const hasReply = q.replies && q.replies.length > 0;
                const isPending = q.status === "Pending" && !isTrash;
                const isReplying = replyingQuestion?._id === q._id;
                const dateLabel = formatDate(isTrash ? (q.deletedAt || q.updatedAt) : q.createdAt);
                const isSelected = selectedIds.includes(q._id);
                const productLink = q.productId ? (
                  <a href={getProductUrl(q.productId)} target="_blank" rel="noopener noreferrer" className="wp-link" style={{ wordBreak: "break-word" }}>
                    {q.productId.name}
                  </a>
                ) : (
                  <span style={{ color: "#d63638" }}>Deleted product</span>
                );
                const rowStyle = isSelected ? undefined : isPending ? { background: "#fef7f1" } : undefined;
                return (
                  <tr key={q._id} className={isSelected ? "is-selected" : undefined} style={rowStyle}>
                    <td className="wp-check-col" style={{ boxShadow: isPending ? "inset 4px 0 0 #d63638" : undefined }}>
                      <input
                        type="checkbox"
                        aria-label={`Select question from ${q.customerName || "Anonymous"}`}
                        checked={isSelected}
                        onChange={() => toggleSelect(q._id)}
                      />
                    </td>
                    <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div className="wp-avatar" aria-hidden="true">{initials(q.customerName)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="wp-strong">{q.customerName || "Anonymous"}</div>
                          {q.customerEmail && <a href={`mailto:${q.customerEmail}`} className="wp-link wp-small" style={{ wordBreak: "break-all" }}>{q.customerEmail}</a>}
                        </div>
                      </div>
                    </td>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      <div className="wp-mobile-meta" style={{ marginTop: 0, marginBottom: 4 }}>
                        <span className="wp-strong">{q.customerName || "Anonymous"}</span>
                        {q.customerEmail ? <span style={{ wordBreak: "break-all" }}>{` · ${q.customerEmail}`}</span> : ""}
                      </div>
                      <div className="wp-small wp-muted" style={{ marginBottom: 4, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        <span className={`wp-pill wp-pill-sm ${statusPillClass(q.status)}`}>{q.status}</span>
                        {hasReply && <span>Answered</span>}
                      </div>
                      <p style={{ margin: 0, color: "#1d2327" }}>{q.question}</p>
                      <div className="wp-mobile-meta">In response to: {productLink} · {dateLabel}</div>

                      <div className="wp-row-actions">
                        {isTrash ? (
                          <>
                            <span><button type="button" onClick={() => handleRestore(q)}>Restore</button></span>
                            <span><button type="button" onClick={() => handleDeletePermanently(q)} className="is-danger">Delete permanently</button></span>
                          </>
                        ) : (
                          <>
                            {q.status !== "Approved" && (
                              <span><button type="button" onClick={() => handleSetStatus(q, "Approved")} style={{ color: "#007017" }}>Approve</button></span>
                            )}
                            {q.status === "Approved" && (
                              <span><button type="button" onClick={() => handleSetStatus(q, "Hidden")} style={{ color: "#996800" }}>Unapprove</button></span>
                            )}
                            {q.status === "Pending" && (
                              <span><button type="button" onClick={() => handleSetStatus(q, "Hidden")} style={{ color: "#996800" }}>Hide</button></span>
                            )}
                            <span>
                              <button type="button" onClick={() => openReply(q)}>{hasReply ? "Edit answer" : "Answer"}</button>
                            </span>
                            {hasReply && (
                              <span>
                                <button type="button" onClick={() => toggleExpand(q._id)} aria-expanded={!!isExpanded}>
                                  {isExpanded ? "Hide answer" : "View answer"}
                                </button>
                              </span>
                            )}
                            <span><button type="button" onClick={() => handleTrash(q)} className="is-danger">Trash</button></span>
                          </>
                        )}
                      </div>

                      {(isExpanded || isTrash) && hasReply && (
                        <div className="wp-note-body" style={{ marginTop: 8 }}>
                          <span className="wp-small wp-muted">Store answer{q.replies[0].staffName ? ` by ${q.replies[0].staffName}` : ""}:</span>
                          <div style={{ whiteSpace: "pre-wrap" }}>{q.replies[0].answer}</div>
                        </div>
                      )}

                      {isReplying && !isTrash && (
                        <div style={{ marginTop: 10, border: "1px solid #c3c4c7", background: "#fff", padding: 10 }} role="group" aria-labelledby={`q-reply-label-${q._id}`}>
                          <label id={`q-reply-label-${q._id}`} htmlFor={`q-reply-${q._id}`} className="wp-label">{hasReply ? "Edit answer" : "Answer question"}</label>
                          <textarea
                            id={`q-reply-${q._id}`}
                            value={replyText}
                            onChange={(e) => { setReplyText(e.target.value); if (replyError) setReplyError(""); }}
                            rows={4}
                            placeholder="Type your official store answer here..."
                            className="wp-textarea wp-full"
                            aria-invalid={!!replyError}
                            aria-describedby={`q-reply-help-${q._id}`}
                          />
                          {replyError && <p className="wp-small" role="alert" style={{ color: "#d63638", margin: "4px 0 0" }}>{replyError}</p>}
                          <p id={`q-reply-help-${q._id}`} className="wp-desc">Saving approves the question, shows the answer on the product page and emails it to the customer.</p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                            <button type="button" onClick={handleSendReply} disabled={replying} className="wp-btn wp-btn-primary">
                              {replying ? "Saving…" : hasReply ? "Update answer" : "Submit answer"}
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
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pagination}
      </div>
    </Page>
    </RequirePermission>
  );
}
