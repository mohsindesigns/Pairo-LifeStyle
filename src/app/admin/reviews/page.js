"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { getProductUrl } from "@/lib/routes";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import { Page, PageHeader } from "@/components/admin/ui";

// Helper to format date like WordPress: YYYY/MM/DD at hh:mm am/pm
const formatDate = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  
  let hours = d.getHours();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const minutes = String(d.getMinutes()).padStart(2, "0");
  
  return `${yyyy}/${mm}/${dd} at ${hours}:${minutes} ${ampm}`;
};

export default function AdminReviewsPage() {
  const { showConfirm } = usePopup();
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ 
    averageRating: 0, 
    pendingCount: 0, 
    approvedCount: 0, 
    rejectedCount: 0, 
    spamCount: 0, 
    trashCount: 0, 
    allCount: 0 
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Filters & Search
  const [statusFilter, setStatusFilter] = useState("All");
  const [ratingFilter, setRatingFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("");
  
  // Inline Actions State
  const [replyingId, setReplyingId] = useState(null);
  const [inlineReplyText, setInlineReplyText] = useState("");
  const [quickEditingId, setQuickEditingId] = useState(null);
  const [quickEditData, setQuickEditData] = useState({
    customerName: "",
    customerEmail: "",
    rating: 5,
    title: "",
    comment: "",
    status: "Pending",
    createdAt: ""
  });

  // Format a date/datetime value for an <input type="datetime-local">
  const toDatetimeLocal = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Fetch reviews list from API
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page,
        limit: 10
      });
      if (statusFilter) queryParams.set("status", statusFilter);
      if (ratingFilter) queryParams.set("rating", ratingFilter);
      if (searchQuery) queryParams.set("search", searchQuery);
      if (dateFrom) queryParams.set("dateFrom", dateFrom);
      if (dateTo) queryParams.set("dateTo", dateTo);

      const res = await fetch(`/api/admin/reviews?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        toast.error("Failed to load reviews");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading reviews");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, ratingFilter, searchQuery, dateFrom, dateTo]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Bulk action submission
  const handleBulkAction = async () => {
    if (!bulkAction) {
      toast.error("Please select a bulk action");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Please select at least one review");
      return;
    }

    const actionText = 
      bulkAction === "delete" ? "move to Trash" : 
      bulkAction === "delete_permanently" ? "permanently delete" :
      bulkAction === "restore" ? "restore" : bulkAction;

    const ok = await showConfirm(`Are you sure you want to ${actionText} ${selectedIds.length} review(s)?`);
    if (!ok) {
      return;
    }

    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action: bulkAction })
      });

      if (res.ok) {
        toast.success(`Bulk action '${actionText}' executed successfully`);
        setSelectedIds([]);
        setBulkAction("");
        fetchReviews();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to execute bulk action");
      }
    } catch (err) {
      console.error(err);
      toast.error("Connection error");
    }
  };

  // Selection helpers
  const toggleSelectAll = () => {
    if (selectedIds.length === reviews.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(reviews.map(r => r._id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Moderate single review status
  const handleModerateSingle = async (reviewId, newStatus) => {
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        toast.success(`Review status updated to ${newStatus}`);
        fetchReviews();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update review status");
      }
    } catch (err) {
      console.error(err);
      toast.error("Connection error");
    }
  };

  // Move review to trash (soft-delete)
  const handleTrashSingle = async (reviewId) => {
    const ok = await showConfirm("Are you sure you want to move this review to Trash?");
    if (ok) {
      try {
        const res = await fetch(`/api/admin/reviews/${reviewId}`, {
          method: "DELETE"
        });
        if (res.ok) {
          toast.success("Review moved to Trash");
          fetchReviews();
        } else {
          toast.error("Failed to move review to Trash");
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Restore review from trash
  const handleRestoreSingle = async (reviewId) => {
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true })
      });
      if (res.ok) {
        toast.success("Review restored to Pending moderation");
        fetchReviews();
      } else {
        toast.error("Failed to restore review");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Permanently delete review
  const handleDeletePermanentlySingle = async (reviewId) => {
    const ok = await showConfirm("Are you sure you want to PERMANENTLY delete this review? This action is irreversible.");
    if (ok) {
      try {
        const res = await fetch(`/api/admin/reviews/${reviewId}`, {
          method: "DELETE"
        });
        if (res.ok) {
          toast.success("Review permanently deleted");
          fetchReviews();
        } else {
          toast.error("Failed to delete review permanently");
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Submit admin reply (inline reply form)
  const handleInlineReplySubmit = async (reviewId) => {
    if (!inlineReplyText.trim()) {
      toast.error("Please enter a reply message");
      return;
    }
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyComment: inlineReplyText.trim() })
      });

      if (res.ok) {
        toast.success("Reply submitted successfully");
        setReplyingId(null);
        setInlineReplyText("");
        fetchReviews();
      } else {
        toast.error("Failed to submit reply");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error");
    }
  };

  const handleStartQuickEdit = (review) => {
    setQuickEditingId(review._id);
    setReplyingId(null);
    setQuickEditData({
      customerName: review.customerName || "",
      customerEmail: review.customerEmail || "",
      rating: review.rating || 5,
      title: review.title || "",
      comment: review.comment || "",
      status: review.status || "Pending",
      createdAt: toDatetimeLocal(review.createdAt)
    });
  };

  const handleQuickEditSubmit = async (reviewId) => {
    if (!quickEditData.customerName.trim() || !quickEditData.customerEmail.trim() || !quickEditData.comment.trim()) {
      toast.error("Author name, email, and comment content are required");
      return;
    }
    try {
      // The <input type="datetime-local"> value has no timezone attached; resolve it against
      // the browser's own local time here so the server (which may run in a different timezone)
      // doesn't reinterpret the same wall-clock string as a different instant.
      const payload = { ...quickEditData };
      if (payload.createdAt) {
        const parsed = new Date(payload.createdAt);
        if (isNaN(parsed.getTime())) {
          toast.error("Invalid submitted-on date");
          return;
        }
        payload.createdAt = parsed.toISOString();
      }

      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success("Review updated successfully");
        setQuickEditingId(null);
        fetchReviews();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update review");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error");
    }
  };

  // Row background, WordPress Comments style
  const getRowStyle = (review) => {
    if (review.isDeleted) return { color: "#646970" };
    if (review.status === "Pending") return { background: "#fef7f1" };
    if (review.status === "Spam") return { background: "#fcf0f1" };
    return undefined;
  };

  // Render WP style row actions list
  const renderRowActions = (review) => {
    if (review.isDeleted) {
      return (
        <>
          <span><button type="button" onClick={() => handleRestoreSingle(review._id)}>Restore</button></span>
          <span><button type="button" onClick={() => handleDeletePermanentlySingle(review._id)} className="is-danger">Delete permanently</button></span>
        </>
      );
    }
    return (
      <>
        {review.status === "Approved" ? (
          <span><button type="button" onClick={() => handleModerateSingle(review._id, "Pending")} style={{ color: "#996800" }}>Unapprove</button></span>
        ) : (
          <span><button type="button" onClick={() => handleModerateSingle(review._id, "Approved")} style={{ color: "#007017" }}>Approve</button></span>
        )}
        <span><button type="button" onClick={() => { setReplyingId(review._id); setInlineReplyText(""); setQuickEditingId(null); }}>Reply</button></span>
        <span><button type="button" onClick={() => handleStartQuickEdit(review)}>Quick Edit</button></span>
        <span><button type="button" onClick={() => handleStartQuickEdit(review)}>Edit</button></span>
        {review.status === "Spam" ? (
          <span><button type="button" onClick={() => handleModerateSingle(review._id, "Pending")}>Not Spam</button></span>
        ) : (
          <span><button type="button" onClick={() => handleModerateSingle(review._id, "Spam")} className="is-danger">Spam</button></span>
        )}
        <span><button type="button" onClick={() => handleTrashSingle(review._id)} className="is-danger">Trash</button></span>
      </>
    );
  };

  const statusTabs = [
    { key: "All", label: "All", count: stats.allCount },
    { key: "Pending", label: "Pending", count: stats.pendingCount },
    { key: "Approved", label: "Approved", count: stats.approvedCount },
    { key: "Rejected", label: "Rejected", count: stats.rejectedCount },
    { key: "Spam", label: "Spam", count: stats.spamCount },
    { key: "Trash", label: "Trash", count: stats.trashCount },
  ];

  const renderStars = (rating) => (
    <span role="img" aria-label={`Rated ${rating || 0} out of 5`} style={{ display: "inline-flex", gap: 1, verticalAlign: "middle" }}>
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className="w-3.5 h-3.5"
          style={i < rating ? { fill: "#dba617", color: "#dba617" } : { fill: "#dcdcde", color: "#dcdcde" }}
        />
      ))}
    </span>
  );

  const renderPager = () =>
    pagination.totalPages > 1 && (
      <div className="wp-pages">
        <span>{pagination.total} items</span>
        <button
          type="button"
          className="wp-pager"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span>{page} of {pagination.totalPages}</span>
        <button
          type="button"
          className="wp-pager"
          disabled={page >= pagination.totalPages}
          onClick={() => setPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );

  const allSelected = selectedIds.length === reviews.length;

  return (
    <RequirePermission permission="reviews.view">
    <Page>
      <PageHeader title="Reviews" />

      {/* Status filter links */}
      <div className="wp-subsub" role="tablist" aria-label="Filter reviews by status">
        {statusTabs.map((t, i) => (
          <span key={t.key} style={{ display: "inline-flex", alignItems: "center" }}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === t.key}
              className={statusFilter === t.key ? "is-current" : undefined}
              onClick={() => { setStatusFilter(t.key); setPage(1); }}
            >
              {t.label} <span className="wp-count">({t.count || 0})</span>
            </button>
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="wp-toolbar">
        <label htmlFor="reviews-bulk-action" className="sr-only">Select bulk action</label>
        <select
          id="reviews-bulk-action"
          value={bulkAction}
          onChange={e => setBulkAction(e.target.value)}
          className="wp-select"
        >
          <option value="">Bulk actions</option>
          {statusFilter === "Trash" ? (
            <>
              <option value="restore">Restore</option>
              <option value="delete_permanently">Delete Permanently</option>
            </>
          ) : (
            <>
              <option value="approve">Approve</option>
              <option value="reject">Reject</option>
              <option value="spam">Mark as Spam</option>
              <option value="delete">Move to Trash</option>
            </>
          )}
        </select>
        <button type="button" onClick={handleBulkAction} disabled={selectedIds.length === 0} className="wp-btn">
          Apply
        </button>

        <label htmlFor="reviews-rating" className="sr-only">Filter by rating</label>
        <select
          id="reviews-rating"
          value={ratingFilter}
          onChange={e => { setRatingFilter(e.target.value); setPage(1); }}
          className="wp-select"
        >
          <option value="">All ratings</option>
          <option value="5">5 Stars</option>
          <option value="4">4 Stars</option>
          <option value="3">3 Stars</option>
          <option value="2">2 Stars</option>
          <option value="1">1 Star</option>
        </select>

        <label htmlFor="reviews-date-from" className="sr-only">Submitted from</label>
        <input
          id="reviews-date-from"
          type="date"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          max={dateTo || undefined}
          className="wp-input"
        />
        <span className="wp-muted">to</span>
        <label htmlFor="reviews-date-to" className="sr-only">Submitted to</label>
        <input
          id="reviews-date-to"
          type="date"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1); }}
          min={dateFrom || undefined}
          className="wp-input"
        />
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
            className="wp-btn"
          >
            Clear dates
          </button>
        )}

        <span className="wp-spacer" />

        <div className="wp-search" role="search">
          <label htmlFor="reviews-search" className="sr-only">Search reviews</label>
          <input
            id="reviews-search"
            type="search"
            placeholder="Search reviews..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            className="wp-input"
          />
        </div>
      </div>

      {pagination.totalPages > 1 && (
        <div className="wp-toolbar">
          <span className="wp-spacer" />
          {renderPager()}
        </div>
      )}

      {/* Table list */}
      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>
            <tr>
              <th scope="col" className="wp-check-col">
                <input
                  type="checkbox"
                  aria-label="Select all reviews"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                />
              </th>
              <th scope="col" className="wp-hide-sm" style={{ width: "20%" }}>Author</th>
              <th scope="col">Review</th>
              <th scope="col" className="wp-hide-sm" style={{ width: "18%" }}>In response to</th>
              <th scope="col" className="wp-hide-sm" style={{ width: 150 }}>Submitted on</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="wp-muted">Loading reviews…</td></tr>
            ) : reviews.length === 0 ? (
              <tr><td colSpan={5} className="wp-muted">No reviews found.</td></tr>
            ) : (
              reviews.map(review => {
                const isSelected = selectedIds.includes(review._id);
                const isReplying = replyingId === review._id;
                const isQuickEditing = quickEditingId === review._id;
                const isPending = review.status === "Pending" && !review.isDeleted;

                if (isQuickEditing) {
                  return (
                    <tr key={review._id} style={{ background: "#f6f7f7" }}>
                      <td colSpan={5}>
                        <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
                          <legend className="wp-strong" style={{ marginBottom: 8 }}>Quick Edit</legend>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                            <div>
                              <div className="wp-field">
                                <label htmlFor={`qe-name-${review._id}`} className="wp-label">Name</label>
                                <input
                                  id={`qe-name-${review._id}`}
                                  type="text"
                                  className="wp-input wp-full"
                                  value={quickEditData.customerName}
                                  onChange={e => setQuickEditData({ ...quickEditData, customerName: e.target.value })}
                                />
                              </div>
                              <div className="wp-field">
                                <label htmlFor={`qe-email-${review._id}`} className="wp-label">Email</label>
                                <input
                                  id={`qe-email-${review._id}`}
                                  type="email"
                                  className="wp-input wp-full"
                                  value={quickEditData.customerEmail}
                                  onChange={e => setQuickEditData({ ...quickEditData, customerEmail: e.target.value })}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-x-3">
                                <div className="wp-field">
                                  <label htmlFor={`qe-rating-${review._id}`} className="wp-label">Rating</label>
                                  <select
                                    id={`qe-rating-${review._id}`}
                                    className="wp-select wp-full"
                                    value={quickEditData.rating}
                                    onChange={e => setQuickEditData({ ...quickEditData, rating: parseInt(e.target.value) })}
                                  >
                                    <option value="5">5 Stars</option>
                                    <option value="4">4 Stars</option>
                                    <option value="3">3 Stars</option>
                                    <option value="2">2 Stars</option>
                                    <option value="1">1 Star</option>
                                  </select>
                                </div>
                                <div className="wp-field">
                                  <label htmlFor={`qe-status-${review._id}`} className="wp-label">Status</label>
                                  <select
                                    id={`qe-status-${review._id}`}
                                    className="wp-select wp-full"
                                    value={quickEditData.status}
                                    onChange={e => setQuickEditData({ ...quickEditData, status: e.target.value })}
                                  >
                                    <option value="Pending">Pending</option>
                                    <option value="Approved">Approved</option>
                                    <option value="Rejected">Rejected</option>
                                    <option value="Spam">Spam</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="wp-field">
                                <label htmlFor={`qe-date-${review._id}`} className="wp-label">Submitted on</label>
                                <input
                                  id={`qe-date-${review._id}`}
                                  type="datetime-local"
                                  className="wp-input wp-full"
                                  value={quickEditData.createdAt}
                                  onChange={e => setQuickEditData({ ...quickEditData, createdAt: e.target.value })}
                                />
                              </div>
                              <div className="wp-field">
                                <label htmlFor={`qe-comment-${review._id}`} className="wp-label">Review</label>
                                <textarea
                                  id={`qe-comment-${review._id}`}
                                  rows={4}
                                  className="wp-textarea wp-full"
                                  value={quickEditData.comment}
                                  onChange={e => setQuickEditData({ ...quickEditData, comment: e.target.value })}
                                />
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => handleQuickEditSubmit(review._id)}
                              className="wp-btn wp-btn-primary"
                            >
                              Update Comment
                            </button>
                            <button
                              type="button"
                              onClick={() => setQuickEditingId(null)}
                              className="wp-btn"
                            >
                              Cancel
                            </button>
                          </div>
                        </fieldset>
                      </td>
                    </tr>
                  );
                }

                const productLink = review.productId ? (
                  <a
                    href={getProductUrl(review.productId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wp-link"
                    style={{ wordBreak: "break-word" }}
                  >
                    {review.productId.name}
                  </a>
                ) : (
                  <span className="wp-muted" style={{ fontStyle: "italic" }}>Deleted product</span>
                );

                return (
                  <tr key={review._id} className={isSelected ? "is-selected" : undefined} style={getRowStyle(review)}>
                    {/* Checkbox column */}
                    <td className="wp-check-col" style={isPending ? { boxShadow: "inset 4px 0 0 #d63638" } : undefined}>
                      <input
                        type="checkbox"
                        aria-label={`Select review by ${review.customerName || "author"}`}
                        checked={isSelected}
                        onChange={() => toggleSelectOne(review._id)}
                      />
                    </td>

                    {/* Author column */}
                    <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <img
                          src="https://secure.gravatar.com/avatar/?d=mm&s=32"
                          className="wp-avatar"
                          style={{ width: 32, height: 32, borderRadius: 0 }}
                          alt=""
                        />
                        <div style={{ minWidth: 0 }}>
                          <div className="wp-strong">{review.customerName}</div>
                          <a href={`mailto:${review.customerEmail}`} className="wp-link wp-small" style={{ wordBreak: "break-all" }} title={review.customerEmail}>
                            {review.customerEmail}
                          </a>
                          <div className="wp-muted wp-small">{review.ipAddress || "127.0.0.1"}</div>
                        </div>
                      </div>
                    </td>

                    {/* Review column */}
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      <div className="wp-mobile-meta" style={{ marginTop: 0, marginBottom: 4 }}>
                        <span className="wp-strong">{review.customerName}</span> · {review.customerEmail}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        {renderStars(review.rating)}
                        {review.title && <span className="wp-strong">{review.title}</span>}
                        {review.isDeleted ? (
                          <span className="wp-pill wp-pill-sm wp-st-cancelled">Trash</span>
                        ) : review.status !== "Approved" ? (
                          <span className={`wp-pill wp-pill-sm ${review.status === "Pending" ? "wp-st-pending" : review.status === "Spam" ? "wp-st-failed" : "wp-st-draft"}`}>{review.status}</span>
                        ) : null}
                      </div>

                      <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "#1d2327" }}>{review.comment}</p>

                      {/* Staff Reply */}
                      {review.replies && review.replies.length > 0 && (
                        <div className="wp-note-body" style={{ marginTop: 8 }}>
                          <div className="wp-small wp-muted">
                            Reply from <span className="wp-strong">{review.replies[0].staffName}</span> on {formatDate(review.replies[0].createdAt)}
                          </div>
                          <div>{review.replies[0].comment}</div>
                        </div>
                      )}

                      <div className="wp-mobile-meta">In response to: {productLink} · {formatDate(review.createdAt)}</div>

                      <div className="wp-row-actions">
                        {renderRowActions(review)}
                      </div>

                      {/* Inline reply box */}
                      {isReplying && (
                        <div style={{ marginTop: 10, border: "1px solid #c3c4c7", background: "#fff", padding: 10 }}>
                          <label htmlFor={`reply-${review._id}`} className="wp-label">Reply to review</label>
                          <textarea
                            id={`reply-${review._id}`}
                            rows={3}
                            placeholder="Write response..."
                            className="wp-textarea wp-full"
                            value={inlineReplyText}
                            onChange={e => setInlineReplyText(e.target.value)}
                          />
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                            <button type="button" onClick={() => handleInlineReplySubmit(review._id)} className="wp-btn wp-btn-primary">
                              Submit Reply
                            </button>
                            <button type="button" onClick={() => setReplyingId(null)} className="wp-btn">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* In Response To column */}
                    <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>
                      {productLink}
                      {review.productId && (
                        <div>
                          <a
                            href={getProductUrl(review.productId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="wp-link wp-small"
                          >
                            View Product
                          </a>
                        </div>
                      )}
                    </td>

                    {/* Submitted On column */}
                    <td className="wp-hide-sm wp-muted">
                      {formatDate(review.createdAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="wp-toolbar">
          <span className="wp-spacer" />
          {renderPager()}
        </div>
      )}
    </Page>
    </RequirePermission>
  );
}
