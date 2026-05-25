"use client";

import React, { useState, useEffect, useCallback } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { 
  Star, 
  Search, 
  MessageSquare, 
  Trash2, 
  Check, 
  X, 
  AlertTriangle,
  ArrowRight,
  Eye,
  Filter,
  CheckSquare,
  Square,
  ThumbsUp,
  ThumbsDown,
  Info,
  CornerDownRight
} from "lucide-react";
import { toast } from "react-hot-toast";

export default function AdminReviewsPage() {
  // State variables
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Filters & Search
  const [statusFilter, setStatusFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("");
  
  // Selected review for side drawer/detail panel
  const [selectedReview, setSelectedReview] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [moderatingId, setModeratingId] = useState(null);

  // Fetch reviews from API
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

    if (bulkAction === "delete" && !window.confirm(`Are you sure you want to delete ${selectedIds.length} reviews?`)) {
      return;
    }

    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action: bulkAction })
      });

      if (res.ok) {
        toast.success(`Bulk action '${bulkAction}' completed successfully`);
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

  // Moderate single review
  const handleModerateSingle = async (reviewId, newStatus) => {
    setModeratingId(reviewId);
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        toast.success(`Review status updated to ${newStatus}`);
        fetchReviews();
        if (selectedReview && selectedReview._id === reviewId) {
          setSelectedReview(prev => ({ ...prev, status: newStatus }));
        }
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update review status");
      }
    } catch (err) {
      console.error(err);
      toast.error("Connection error");
    } finally {
      setModeratingId(null);
    }
  };

  // Toggle Featured state
  const handleToggleFeatured = async (reviewId, currentFeatured) => {
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured: !currentFeatured })
      });

      if (res.ok) {
        toast.success(currentFeatured ? "Review unfeatured" : "Review marked as featured");
        fetchReviews();
        if (selectedReview && selectedReview._id === reviewId) {
          setSelectedReview(prev => ({ ...prev, isFeatured: !currentFeatured }));
        }
      } else {
        toast.error("Failed to update featured state");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete single review (soft-delete)
  const handleDeleteSingle = async (reviewId) => {
    if (window.confirm("Are you sure you want to delete this review?")) {
      try {
        const res = await fetch(`/api/admin/reviews/${reviewId}`, {
          method: "DELETE"
        });

        if (res.ok) {
          toast.success("Review deleted successfully");
          setSelectedReview(null);
          fetchReviews();
        } else {
          toast.error("Failed to delete review");
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Submit admin reply
  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!selectedReview) return;

    try {
      const res = await fetch(`/api/admin/reviews/${selectedReview._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyComment: replyText })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(replyText.trim() === "" ? "Admin reply cleared" : "Admin reply updated");
        setSelectedReview(data.review);
        fetchReviews();
      } else {
        toast.error("Failed to update reply");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Set side panel review detail
  const handleOpenDetail = (review) => {
    setSelectedReview(review);
    setReplyText(review.replies?.[0]?.comment || "");
  };

  return (
    <AdminPageLayout 
      title="Product Reviews" 
      breadcrumbs={[{ label: "Store", href: "/admin/orders" }, { label: "Reviews" }]}
    >
      <div className="flex flex-col xl:flex-row gap-6 pb-20 items-start">
        {/* Main Content Area */}
        <div className="flex-1 w-full space-y-4">
          
          {/* Filtering & Searching Controls Bar */}
          <div className="bg-white border border-[#c3c4c7] p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm rounded-sm">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Filter by Status */}
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="text-[12px] border border-[#c3c4c7] px-2.5 py-1.5 bg-white outline-none focus:border-[#2271b1] text-gray-700"
              >
                <option value="">Filter Status</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Spam">Spam</option>
                <option value="Featured">Featured</option>
              </select>

              {/* Filter by Rating */}
              <select
                value={ratingFilter}
                onChange={e => { setRatingFilter(e.target.value); setPage(1); }}
                className="text-[12px] border border-[#c3c4c7] px-2.5 py-1.5 bg-white outline-none focus:border-[#2271b1] text-gray-700"
              >
                <option value="">Filter Rating</option>
                <option value="5">5 Star</option>
                <option value="4">4 Star</option>
                <option value="3">3 Star</option>
                <option value="2">2 Star</option>
                <option value="1">1 Star</option>
              </select>
            </div>

            {/* Search input */}
            <div className="relative w-full md:w-72">
              <input
                type="text"
                placeholder="Search author, email, comment..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full text-[12px] pl-8 pr-3 py-1.5 border border-[#c3c4c7] bg-white outline-none focus:border-[#2271b1]"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Bulk actions tools */}
          {selectedIds.length > 0 && (
            <div className="bg-[#f0f2f1] border border-[#c3c4c7] p-3 flex gap-3 items-center rounded-sm">
              <span className="text-[11px] font-bold text-gray-500 uppercase">
                {selectedIds.length} Reviews Selected
              </span>
              <select
                value={bulkAction}
                onChange={e => setBulkAction(e.target.value)}
                className="text-[12px] border border-[#c3c4c7] px-2.5 py-1 bg-white outline-none focus:border-[#2271b1]"
              >
                <option value="">Bulk Actions</option>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
                <option value="spam">Mark as Spam</option>
                <option value="delete">Delete</option>
              </select>
              <button
                onClick={handleBulkAction}
                className="bg-[#2271b1] text-white px-3.5 py-1 text-[11px] font-bold uppercase hover:bg-[#135e96] transition-all rounded-sm"
              >
                Apply
              </button>
            </div>
          )}

          {/* Reviews Table */}
          <div className="bg-white border border-[#c3c4c7] shadow-sm rounded-sm overflow-x-auto">
            {loading ? (
              <div className="p-20 text-center space-y-4">
                <div className="w-6 h-6 border-2 border-[#2271b1] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Loading reviews...</p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="p-20 text-center space-y-3">
                <MessageSquare className="w-10 h-10 text-gray-300 mx-auto" />
                <h4 className="text-[13px] font-bold text-gray-700 uppercase">No reviews found</h4>
                <p className="text-[11px] text-gray-400">Adjust your search or filters to see more results.</p>
              </div>
            ) : (
              <table className="w-full text-[13px] text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-[#f6f7f7] border-b border-[#c3c4c7] text-[#50575e] font-bold text-[11px] uppercase tracking-wider select-none">
                    <th className="py-3 px-4 w-10">
                      <button onClick={toggleSelectAll}>
                        {selectedIds.length === reviews.length ? (
                          <CheckSquare className="w-4 h-4 text-[#2271b1]" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4 w-28">Rating</th>
                    <th className="py-3 px-4 w-44">Author</th>
                    <th className="py-3 px-4">Review Content</th>
                    <th className="py-3 px-4 w-44">Product</th>
                    <th className="py-3 px-4 w-28">Date</th>
                    <th className="py-3 px-4 w-28">Status</th>
                    <th className="py-3 px-4 w-24 text-center">Featured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f1]">
                  {reviews.map(review => {
                    const isSelected = selectedIds.includes(review._id);
                    const isReported = review.reported && review.reportsCount > 0;
                    
                    return (
                      <tr 
                        key={review._id} 
                        className={`hover:bg-[#f6f7f7]/30 transition-colors ${
                          isSelected ? "bg-[#f0f6fa]/60" : ""
                        } ${isReported ? "bg-red-50/30" : ""}`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-4">
                          <button onClick={() => toggleSelectOne(review._id)}>
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#2271b1]" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-300" />
                            )}
                          </button>
                        </td>

                        {/* Rating stars */}
                        <td className="py-3 px-4">
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
                        </td>

                        {/* Author info */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-gray-700">{review.customerName}</div>
                          <div className="text-[11px] text-gray-400 font-mono truncate max-w-[150px]">{review.customerEmail}</div>
                          {review.verifiedPurchase && (
                            <span className="text-[9px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-150 uppercase font-black tracking-tight mt-1 inline-block">
                              Verified
                            </span>
                          )}
                        </td>

                        {/* Review text */}
                        <td className="py-3 px-4 max-w-sm">
                          <div className="font-bold text-gray-800 line-clamp-1">{review.title || "No Title"}</div>
                          <p className="text-gray-500 text-[12px] line-clamp-2 mt-0.5 leading-relaxed font-medium">
                            {review.comment || "No comment content provided."}
                          </p>
                          
                          {/* Inline admin reply preview */}
                          {review.replies && review.replies.length > 0 && (
                            <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-1 font-bold">
                              <CornerDownRight className="w-3 h-3 text-neutral-400" />
                              Replied by {review.replies[0].staffName}
                            </div>
                          )}

                          {/* Hover action row */}
                          <div className="flex items-center gap-3 mt-2 text-[11px] font-bold text-[#2271b1] hover-actions">
                            <button onClick={() => handleOpenDetail(review)} className="hover:underline flex items-center gap-1">
                              <Eye className="w-3 h-3" /> View & Reply
                            </button>
                            <span className="text-gray-200">|</span>
                            {review.status !== "Approved" && (
                              <>
                                <button 
                                  onClick={() => handleModerateSingle(review._id, "Approved")} 
                                  className="text-green-600 hover:underline"
                                >
                                  Approve
                                </button>
                                <span className="text-gray-200">|</span>
                              </>
                            )}
                            {review.status !== "Rejected" && (
                              <>
                                <button 
                                  onClick={() => handleModerateSingle(review._id, "Rejected")} 
                                  className="text-neutral-500 hover:underline"
                                >
                                  Reject
                                </button>
                                <span className="text-gray-200">|</span>
                              </>
                            )}
                            {review.status !== "Spam" && (
                              <>
                                <button 
                                  onClick={() => handleModerateSingle(review._id, "Spam")} 
                                  className="text-amber-600 hover:underline"
                                >
                                  Spam
                                </button>
                                <span className="text-gray-200">|</span>
                              </>
                            )}
                            <button onClick={() => handleDeleteSingle(review._id)} className="text-[#d63638] hover:underline flex items-center gap-0.5">
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </div>
                        </td>

                        {/* Product reference */}
                        <td className="py-3 px-4 font-medium text-gray-700">
                          {review.productId ? (
                            <div className="truncate max-w-[150px]" title={review.productId.name}>
                              {review.productId.name}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Deleted Product</span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 text-gray-400 text-[11px] font-mono">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border select-none ${
                            review.status === "Approved" ? "bg-green-50 text-green-700 border-green-150" :
                            review.status === "Pending" ? "bg-amber-50 text-amber-700 border-amber-150 animate-pulse" :
                            review.status === "Spam" ? "bg-red-50 text-red-700 border-red-150" :
                            "bg-gray-50 text-gray-600 border-gray-150"
                          }`}>
                            {review.status}
                          </span>
                          
                          {/* Reported flag badge */}
                          {isReported && (
                            <span className="flex items-center gap-0.5 text-[9px] text-red-600 font-bold uppercase mt-1">
                              <AlertTriangle className="w-3 h-3 text-red-500" />
                              Reported ({review.reportsCount})
                            </span>
                          )}
                        </td>

                        {/* Featured Star toggle */}
                        <td className="py-3 px-4 text-center">
                          <button 
                            type="button"
                            onClick={() => handleToggleFeatured(review._id, review.isFeatured)}
                            className="hover:scale-110 transition-transform"
                          >
                            <Star 
                              className={`w-4 h-4 mx-auto ${
                                review.isFeatured ? "fill-[#FFC633] text-[#FFC633]" : "text-gray-300 fill-transparent"
                              }`} 
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-end gap-2 items-center text-xs text-gray-500 font-mono select-none">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 bg-white border border-[#c3c4c7] hover:border-black disabled:opacity-50"
              >
                ‹ Prev
              </button>
              <span>Page {page} of {pagination.totalPages}</span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 bg-white border border-[#c3c4c7] hover:border-black disabled:opacity-50"
              >
                Next ›
              </button>
            </div>
          )}
        </div>

        {/* Side Panel / Detail Drawer */}
        {selectedReview && (
          <div className="w-full xl:w-96 bg-white border border-[#c3c4c7] shadow-lg rounded-sm p-5 space-y-6 shrink-0 relative animate-slide-in">
            <button 
              onClick={() => setSelectedReview(null)}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:bg-neutral-100 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-[13px] font-bold text-gray-700 uppercase border-b border-neutral-100 pb-2 mb-4">
                Review Details
              </h3>

              {/* Review summary info */}
              <div className="space-y-4">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4.5 h-4.5 ${
                        i < selectedReview.rating ? "fill-[#FFC633] text-[#FFC633]" : "fill-gray-200 text-gray-200"
                      }`}
                    />
                  ))}
                </div>

                <div className="space-y-2 text-[12px] font-medium text-gray-600">
                  <div className="flex justify-between"><span className="text-gray-400">Author:</span> <strong className="text-gray-800">{selectedReview.customerName}</strong></div>
                  <div className="flex justify-between"><span className="text-gray-400">Email:</span> <strong className="text-gray-800 font-mono">{selectedReview.customerEmail}</strong></div>
                  <div className="flex justify-between"><span className="text-gray-400">IP Address:</span> <strong className="text-gray-800 font-mono">{selectedReview.ipAddress || "N/A"}</strong></div>
                  <div className="flex justify-between"><span className="text-gray-400">Status:</span> <strong className="text-gray-800">{selectedReview.status}</strong></div>
                  <div className="flex justify-between"><span className="text-gray-400">Votes:</span> 
                    <strong className="text-gray-800 flex items-center gap-1.5">
                      <ThumbsUp className="w-3 h-3" /> {selectedReview.helpfulVotes} / <ThumbsDown className="w-3 h-3" /> {selectedReview.unhelpfulVotes}
                    </strong>
                  </div>
                  <div className="flex justify-between"><span className="text-gray-400">Reports:</span> <strong className="text-gray-800">{selectedReview.reportsCount || 0}</strong></div>
                  <div className="flex justify-between"><span className="text-gray-400">Recommendation:</span> <strong className="text-gray-800">{selectedReview.recommend ? "Yes" : "No"}</strong></div>
                </div>

                <div className="border-t border-neutral-100 pt-3">
                  <h4 className="font-bold text-gray-800 text-[13px]">{selectedReview.title || "No Title"}</h4>
                  <p className="text-neutral-500 text-[12px] leading-relaxed font-medium mt-1">
                    {selectedReview.comment || "No comment content provided."}
                  </p>
                </div>
              </div>
            </div>

            {/* Moderation Controls Drawer Section */}
            <div className="border-t border-neutral-100 pt-4 space-y-3">
              <h4 className="text-[12px] font-bold text-gray-500 uppercase">Status Moderation</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleModerateSingle(selectedReview._id, "Approved")}
                  className={`py-1.5 rounded-sm text-xs font-bold uppercase ${
                    selectedReview.status === "Approved" ? "bg-green-600 text-white" : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                  }`}
                >
                  Approve
                </button>
                <button
                  onClick={() => handleModerateSingle(selectedReview._id, "Rejected")}
                  className={`py-1.5 rounded-sm text-xs font-bold uppercase ${
                    selectedReview.status === "Rejected" ? "bg-neutral-600 text-white" : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                  }`}
                >
                  Reject
                </button>
                <button
                  onClick={() => handleModerateSingle(selectedReview._id, "Spam")}
                  className={`py-1.5 rounded-sm text-xs font-bold uppercase col-span-2 ${
                    selectedReview.status === "Spam" ? "bg-red-600 text-white" : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                  }`}
                >
                  Mark as Spam
                </button>
              </div>
            </div>

            {/* Admin Response form */}
            <form onSubmit={handleReplySubmit} className="border-t border-neutral-100 pt-4 space-y-2.5">
              <div className="flex justify-between items-center">
                <label className="text-[12px] font-bold text-gray-500 uppercase">Public Reply</label>
                {selectedReview.replies && selectedReview.replies.length > 0 && (
                  <span className="text-[10px] text-green-600 font-bold">Replied</span>
                )}
              </div>
              <textarea
                rows={3}
                placeholder="Write a public response as Pairo Studio..."
                className="w-full text-xs border border-[#c3c4c7] p-2 bg-white outline-none focus:border-[#2271b1] resize-none"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
              />
              <div className="flex gap-2">
                {selectedReview.replies && selectedReview.replies.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setReplyText(""); }}
                    className="w-1/3 border border-neutral-200 text-[11px] font-bold hover:bg-neutral-50 uppercase py-2"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 bg-black text-white hover:bg-neutral-800 text-[11px] font-bold uppercase py-2"
                >
                  Save Reply
                </button>
              </div>
            </form>

            <button
              onClick={() => handleDeleteSingle(selectedReview._id)}
              className="w-full border border-red-200 text-[#d63638] hover:bg-red-50 py-2.5 text-[11px] font-bold uppercase rounded-sm flex items-center justify-center gap-1 mt-4"
            >
              <Trash2 className="w-3.5 h-3.5" /> Permanent/Soft Delete
            </button>
          </div>
        )}
      </div>
    </AdminPageLayout>
  );
}
