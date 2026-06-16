"use client";

import React, { useState, useEffect, useCallback } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { Star, Search, MessageSquare, Edit2, CornerDownRight, X, Square, CheckSquare } from "lucide-react";
import { toast } from "react-hot-toast";

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
    status: "Pending"
  });

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
  }, [page, statusFilter, ratingFilter, searchQuery]);

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

    if (!window.confirm(`Are you sure you want to ${actionText} ${selectedIds.length} review(s)?`)) {
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
    if (window.confirm("Are you sure you want to move this review to Trash?")) {
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
    if (window.confirm("Are you sure you want to PERMANENTLY delete this review? This action is irreversible.")) {
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
      status: review.status || "Pending"
    });
  };

  const handleQuickEditSubmit = async (reviewId) => {
    if (!quickEditData.customerName.trim() || !quickEditData.customerEmail.trim() || !quickEditData.comment.trim()) {
      toast.error("Author name, email, and comment content are required");
      return;
    }
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quickEditData)
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

  // Get background color of row based on status and state
  const getRowBgColor = (review) => {
    if (review.isDeleted) return "bg-[#f6f7f7]/60 text-gray-500";
    if (review.status === "Pending") return "bg-[#fffbdf]";
    if (review.status === "Spam") return "bg-[#fcf0f1]";
    if (review.status === "Rejected") return "bg-gray-50/50";
    return "bg-white hover:bg-[#f6f7f7]/30";
  };

  // Render WP style row actions list
  const renderRowActions = (review) => {
    const actions = [];
    
    if (review.isDeleted) {
      actions.push(
        <button key="restore" onClick={() => handleRestoreSingle(review._id)} className="text-green-600 hover:text-green-800 hover:underline">
          Restore
        </button>
      );
      actions.push(
        <button key="delete_perm" onClick={() => handleDeletePermanentlySingle(review._id)} className="text-[#d63638] hover:text-[#b32d2f] hover:underline">
          Delete Permanently
        </button>
      );
    } else {
      // Approve / Unapprove
      if (review.status === "Approved") {
        actions.push(
          <button key="unapprove" onClick={() => handleModerateSingle(review._id, "Pending")} className="text-amber-600 hover:underline font-semibold">
            Unapprove
          </button>
        );
      } else {
        actions.push(
          <button key="approve" onClick={() => handleModerateSingle(review._id, "Approved")} className="text-green-600 hover:underline font-bold">
            Approve
          </button>
        );
      }
      
      // Reply
      actions.push(
        <button key="reply" onClick={() => { setReplyingId(review._id); setInlineReplyText(""); setQuickEditingId(null); }} className="hover:underline">
          Reply
        </button>
      );
      
      // Quick Edit / Edit (both open inline Quick Edit in WP Comments page)
      actions.push(
        <button key="quick-edit" onClick={() => handleStartQuickEdit(review)} className="hover:underline">
          Quick Edit
        </button>
      );
      
      actions.push(
        <button key="edit" onClick={() => handleStartQuickEdit(review)} className="hover:underline">
          Edit
        </button>
      );
      
      // Spam / Not Spam
      if (review.status === "Spam") {
        actions.push(
          <button key="not-spam" onClick={() => handleModerateSingle(review._id, "Pending")} className="text-green-600 hover:underline">
            Not Spam
          </button>
        );
      } else {
        actions.push(
          <button key="spam" onClick={() => handleModerateSingle(review._id, "Spam")} className="text-amber-600 hover:underline">
            Spam
          </button>
        );
      }
      
      // Trash
      actions.push(
        <button key="trash" onClick={() => handleTrashSingle(review._id)} className="text-[#d63638] hover:underline">
          Trash
        </button>
      );
    }
    
    return actions.map((action, i) => (
      <React.Fragment key={i}>
        {action}
        {i < actions.length - 1 && <span className="text-gray-300 font-normal">|</span>}
      </React.Fragment>
    ));
  };

  const inputClass = "w-full border border-[#ccd0d4] bg-white text-xs px-2.5 py-1.5 outline-none focus:border-[#2271b1] focus:ring-0 rounded-[3px] font-medium";
  const btnClass = "bg-[#f6f7f7] border border-[#ccd0d4] hover:bg-[#f0f0f1] text-[#2c3338] text-xs font-semibold px-3 py-1.5 rounded-[3px] cursor-pointer inline-block transition-colors outline-none select-none";
  const primaryBtnClass = "bg-[#2271b1] border border-[#135e96] hover:bg-[#135e96] text-white text-xs font-semibold px-4 py-1.5 rounded-[3px] cursor-pointer inline-block transition-colors outline-none select-none";

  return (
    <AdminPageLayout 
      title="Comments" 
      breadcrumbs={[{ label: "Store", href: "/admin/orders" }, { label: "Reviews" }]}
    >
      <div className="flex flex-col gap-4 pb-20 items-start w-full">
        
        {/* Subsubsub Navigation & Search */}
        <div className="flex flex-wrap items-center justify-between border-b border-[#c3c4c7] pb-2 w-full">
          <ul className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#2c3338] font-medium select-none">
            <li>
              <button 
                onClick={() => { setStatusFilter("All"); setPage(1); }} 
                className={`hover:text-[#2271b1] transition-colors ${statusFilter === "All" ? "font-bold text-[#000]" : "text-[#2271b1]"}`}
              >
                All <span className="text-gray-400 text-xs font-normal">({stats.allCount || 0})</span>
              </button>
              <span className="text-gray-300 ml-1.5">|</span>
            </li>
            <li>
              <button 
                onClick={() => { setStatusFilter("Pending"); setPage(1); }} 
                className={`hover:text-[#2271b1] transition-colors ${statusFilter === "Pending" ? "font-bold text-[#000]" : "text-[#2271b1]"}`}
              >
                Pending <span className="text-[#d54e21] text-xs font-bold">({stats.pendingCount || 0})</span>
              </button>
              <span className="text-gray-300 ml-1.5">|</span>
            </li>
            <li>
              <button 
                onClick={() => { setStatusFilter("Approved"); setPage(1); }} 
                className={`hover:text-[#2271b1] transition-colors ${statusFilter === "Approved" ? "font-bold text-[#000]" : "text-[#2271b1]"}`}
              >
                Approved <span className="text-gray-400 text-xs">({stats.approvedCount || 0})</span>
              </button>
              <span className="text-gray-300 ml-1.5">|</span>
            </li>
            <li>
              <button 
                onClick={() => { setStatusFilter("Rejected"); setPage(1); }} 
                className={`hover:text-[#2271b1] transition-colors ${statusFilter === "Rejected" ? "font-bold text-[#000]" : "text-[#2271b1]"}`}
              >
                Rejected <span className="text-gray-400 text-xs">({stats.rejectedCount || 0})</span>
              </button>
              <span className="text-gray-300 ml-1.5">|</span>
            </li>
            <li>
              <button 
                onClick={() => { setStatusFilter("Spam"); setPage(1); }} 
                className={`hover:text-[#2271b1] transition-colors ${statusFilter === "Spam" ? "font-bold text-[#000]" : "text-[#2271b1]"}`}
              >
                Spam <span className="text-[#d63638] text-xs font-bold">({stats.spamCount || 0})</span>
              </button>
              <span className="text-gray-300 ml-1.5">|</span>
            </li>
            <li>
              <button 
                onClick={() => { setStatusFilter("Trash"); setPage(1); }} 
                className={`hover:text-[#2271b1] transition-colors ${statusFilter === "Trash" ? "font-bold text-[#000]" : "text-[#2271b1]"}`}
              >
                Trash <span className="text-gray-400 text-xs font-normal">({stats.trashCount || 0})</span>
              </button>
            </li>
          </ul>

          {/* Search Input */}
          <div className="relative w-full md:w-56 mt-2 md:mt-0">
            <input
              type="text"
              placeholder="Search comments..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full text-xs pl-8 pr-3 py-1.5 border border-[#ccd0d4] bg-white outline-none focus:border-[#2271b1] rounded-[3px] font-medium"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap gap-2 items-center justify-between w-full select-none">
          <div className="flex items-center gap-1.5">
            <select
              value={bulkAction}
              onChange={e => setBulkAction(e.target.value)}
              className="text-xs border border-[#ccd0d4] bg-white px-2 py-1.5 outline-none text-[#2c3338] font-medium rounded-[3px] focus:border-[#2271b1]"
            >
              <option value="">Bulk Actions</option>
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
            <button onClick={handleBulkAction} disabled={selectedIds.length === 0} className={btnClass}>
              Apply
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-500">Filter:</span>
            <select
              value={ratingFilter}
              onChange={e => { setRatingFilter(e.target.value); setPage(1); }}
              className="text-xs border border-[#ccd0d4] bg-white px-2 py-1.5 outline-none text-[#2c3338] font-medium rounded-[3px] focus:border-[#2271b1]"
            >
              <option value="">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        </div>

        {/* Table list */}
        <div className="bg-white border border-[#c3c4c7] w-full overflow-hidden">
          {loading ? (
            <div className="p-16 text-center italic text-gray-400 font-medium">Loading comments database...</div>
          ) : reviews.length === 0 ? (
            <div className="p-16 text-center italic text-gray-400 font-medium">No comments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px] table-fixed text-[13px]">
                <thead>
                  <tr className="bg-[#f6f7f7] border-b border-[#c3c4c7] text-[#2c3338] font-bold select-none">
                    <th className="py-2.5 px-3 w-10 text-center align-middle">
                      <button onClick={toggleSelectAll} className="flex items-center justify-center w-full">
                        {selectedIds.length === reviews.length ? (
                          <CheckSquare className="w-4 h-4 text-[#2271b1]" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3 w-48 font-bold text-[#1d2327]">Author</th>
                    <th className="py-2.5 px-3 font-bold text-[#1d2327] w-[450px]">Comment</th>
                    <th className="py-2.5 px-3 w-44 font-bold text-[#1d2327]">In Response To</th>
                    <th className="py-2.5 px-3 w-40 font-bold text-[#1d2327]">Submitted On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c4c7]">
                  {reviews.map(review => {
                    const isSelected = selectedIds.includes(review._id);
                    const isReplying = replyingId === review._id;
                    const isQuickEditing = quickEditingId === review._id;
                    const bgClass = getRowBgColor(review);
                    
                    if (isQuickEditing) {
                      return (
                        <tr key={review._id} className="bg-[#f6f7f7] border-y-2 border-[#c3c4c7]">
                          <td colSpan={5} className="p-4 align-top">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-3">
                                <h4 className="text-[12px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-200 pb-1 flex items-center gap-1.5 select-none">
                                  <Edit2 className="w-3.5 h-3.5 text-gray-505" /> Edit Author Info
                                </h4>
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Author Name</label>
                                    <input 
                                      type="text" 
                                      className={inputClass}
                                      value={quickEditData.customerName}
                                      onChange={e => setQuickEditData({ ...quickEditData, customerName: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Author Email</label>
                                    <input 
                                      type="email" 
                                      className={inputClass}
                                      value={quickEditData.customerEmail}
                                      onChange={e => setQuickEditData({ ...quickEditData, customerEmail: e.target.value })}
                                    />
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-3">
                                <h4 className="text-[12px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-200 pb-1 flex items-center gap-1.5 select-none">
                                  <MessageSquare className="w-3.5 h-3.5 text-gray-505" /> Edit Comment Content
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Rating</label>
                                    <select 
                                      className="w-full border border-[#ccd0d4] bg-white text-xs p-1.5 outline-none rounded-[3px] focus:border-[#2271b1]"
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
                                  <div>
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Status</label>
                                    <select 
                                      className="w-full border border-[#ccd0d4] bg-white text-xs p-1.5 outline-none rounded-[3px] focus:border-[#2271b1]"
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
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Comment Content</label>
                                  <textarea 
                                    rows={3}
                                    className={`${inputClass} resize-none`}
                                    value={quickEditData.comment}
                                    onChange={e => setQuickEditData({ ...quickEditData, comment: e.target.value })}
                                  />
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex justify-end gap-1.5 mt-3 select-none">
                              <button 
                                type="button" 
                                onClick={() => setQuickEditingId(null)}
                                className={btnClass}
                              >
                                Cancel
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleQuickEditSubmit(review._id)}
                                className={primaryBtnClass}
                              >
                                Update Comment
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={review._id} className={`group transition-colors ${bgClass} ${isSelected ? "bg-[#f0f6fa]/80" : ""}`}>
                        {/* Checkbox column */}
                        <td className={`py-4 px-3 align-top w-10 text-center ${review.status === "Pending" ? "border-l-4 border-l-[#d54e21]" : ""}`}>
                          <button onClick={() => toggleSelectOne(review._id)} className="flex items-center justify-center w-full">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#2271b1]" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
                            )}
                          </button>
                        </td>

                        {/* Author column */}
                        <td className="py-4 px-3 align-top text-xs">
                          <div className="flex items-start gap-2.5">
                            <img 
                              src="https://secure.gravatar.com/avatar/?d=mm&s=32" 
                              className="w-8 h-8 rounded-none border border-[#ccd0d4] shrink-0" 
                              alt=""
                            />
                            <div className="space-y-0.5 min-w-0">
                              <div className="font-bold text-[#1d2327]">
                                {review.customerName}
                              </div>
                              <a href={`mailto:${review.customerEmail}`} className="text-[#2271b1] hover:underline font-mono text-[11px] truncate block" title={review.customerEmail}>
                                {review.customerEmail}
                              </a>
                              <div className="text-[11px] text-gray-500 font-mono">
                                {review.ipAddress || "127.0.0.1"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Comment details column */}
                        <td className="py-4 px-3 align-top">
                          <div className="space-y-1.5 text-xs">
                            {/* Rating & Title */}
                            <div className="flex items-center gap-1.5 select-none">
                              <div className="flex gap-0.5">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-3.5 h-3.5 ${
                                      i < review.rating ? "fill-[#FFC633] text-[#FFC633]" : "fill-gray-200 text-gray-200"
                                    }`}
                                  />
                                ))}
                              </div>
                              {review.title && (
                                <span className="font-bold text-[#1d2327] text-[12px]">{review.title}</span>
                              )}
                            </div>

                            {/* Comment text */}
                            <p className="text-[#2c3338] text-[13px] leading-relaxed break-words whitespace-pre-wrap select-text">
                              {review.comment}
                            </p>

                            {/* Staff Reply */}
                            {review.replies && review.replies.length > 0 && (
                              <div className="bg-[#f6f7f7] border border-[#d5d7d9] p-2 rounded-sm mt-2 relative text-[12px] text-[#2c3338] space-y-1">
                                <div className="font-bold flex items-center gap-1 select-none">
                                  <CornerDownRight className="w-3.5 h-3.5 text-gray-400" />
                                  <span>Reply from {review.replies[0].staffName}</span>
                                  <span className="text-[10px] text-gray-400 font-normal">on {formatDate(review.replies[0].createdAt)}</span>
                                </div>
                                <p className="text-gray-650 font-medium pl-4 select-text">
                                  {review.replies[0].comment}
                                </p>
                              </div>
                            )}

                            {/* Hover Actions */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] font-bold text-[#2271b1] select-none opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                              {renderRowActions(review)}
                            </div>
                          </div>

                          {/* Inline Reply Editor Drawer under comment content */}
                          {isReplying && (
                            <div className="bg-[#f0f6fa] border border-[#c3c4c7] p-3 rounded-sm mt-3 space-y-2">
                              <label className="block text-[11px] font-bold text-gray-700 uppercase select-none">
                                Submit Staff Reply
                              </label>
                              <textarea
                                rows={2}
                                placeholder="Write response..."
                                className={`${inputClass} resize-none`}
                                value={inlineReplyText}
                                onChange={e => setInlineReplyText(e.target.value)}
                              />
                              <div className="flex justify-end gap-1.5 select-none">
                                <button type="button" onClick={() => setReplyingId(null)} className={btnClass}>
                                  Cancel
                                </button>
                                <button type="button" onClick={() => handleInlineReplySubmit(review._id)} className={primaryBtnClass}>
                                  Submit Reply
                                </button>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* In Response To column */}
                        <td className="py-4 px-3 align-top text-xs">
                          {review.productId ? (
                            <div className="space-y-1">
                              <a 
                                href={`/product/${review.productId.slug}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-[#2271b1] hover:underline font-semibold block truncate max-w-[150px]"
                                title={review.productId.name}
                              >
                                {review.productId.name}
                              </a>
                              <div className="flex items-center gap-1 select-none">
                                <a 
                                  href={`/product/${review.productId.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-[#2271b1] text-[11px]"
                                >
                                  View Product
                                </a>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-450 italic">Deleted Product</span>
                          )}
                        </td>

                        {/* Submitted On column */}
                        <td className="py-4 px-3 align-top text-gray-500 font-mono text-[11px] leading-relaxed">
                          {formatDate(review.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-end gap-1.5 items-center text-xs text-[#2c3338] select-none w-full">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className={btnClass}
            >
              ‹ Prev
            </button>
            <span className="font-medium">Page {page} of {pagination.totalPages}</span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(page + 1)}
              className={btnClass}
            >
              Next ›
            </button>
          </div>
        )}
      </div>
    </AdminPageLayout>
  );
}
