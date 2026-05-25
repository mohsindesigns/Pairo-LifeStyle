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
  CornerDownRight,
  ShieldAlert,
  Clock,
  TrendingUp,
  Activity,
  UserX,
  Edit2,
  RefreshCw,
  Trash
} from "lucide-react";
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

// Helper for initials
const getInitials = (name) => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
};

// Avatar colors based on name hash
const avatarColors = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-indigo-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-teal-600",
  "bg-purple-600"
];
const getAvatarColor = (name) => {
  if (!name) return "bg-gray-500";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarColors.length;
  return avatarColors[index];
};

export default function AdminReviewsPage() {
  // State variables
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ 
    averageRating: 0, 
    pendingCount: 0, 
    approvedCount: 0, 
    rejectedCount: 0, 
    spamCount: 0, 
    trashCount: 0, 
    allCount: 0, 
    spamRatio: 0, 
    approvalRate: 0 
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Filters & Search
  const [statusFilter, setStatusFilter] = useState("All");
  const [ratingFilter, setRatingFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("");
  
  // Selected review for side drawer/detail panel
  const [selectedReview, setSelectedReview] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [moderatingId, setModeratingId] = useState(null);

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

  // Fetch complete review details + chronological timeline history
  const fetchReviewDetail = async (reviewId) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedReview(data.review);
        setTimeline(data.timeline || []);
        setReplyText(data.review.replies?.[0]?.comment || "");
      } else {
        toast.error("Failed to load review timeline");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Keyboard Shortcuts Handler when drawer detail is open
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if no review is selected or if user is currently typing in an input/textarea
      if (!selectedReview) return;
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable)) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "escape") {
        e.preventDefault();
        setSelectedReview(null);
        setTimeline([]);
      } else if (key === "a") {
        e.preventDefault();
        handleModerateSingle(selectedReview._id, "Approved");
      } else if (key === "r") {
        e.preventDefault();
        handleModerateSingle(selectedReview._id, "Rejected");
      } else if (key === "s") {
        e.preventDefault();
        handleModerateSingle(selectedReview._id, "Spam");
      } else if (key === "d") {
        e.preventDefault();
        handleTrashSingle(selectedReview._id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedReview]);

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
          await fetchReviewDetail(reviewId);
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
          await fetchReviewDetail(reviewId);
        }
      } else {
        toast.error("Failed to update featured state");
      }
    } catch (err) {
      console.error(err);
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
          if (selectedReview && selectedReview._id === reviewId) {
            setSelectedReview(null);
            setTimeline([]);
          }
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

  // Single review shadow ban toggle
  const handleToggleShadowBanSingle = async (review) => {
    const isBanned = review.shadowBanned;
    const action = isBanned ? "unban" : "ban";
    
    if (action === "ban" && !window.confirm(`Are you sure you want to shadow-ban the reviewer: ${review.customerEmail}? Future submissions from this user will silently flag as Spam.`)) {
      return;
    }

    try {
      const res = await fetch("/api/admin/reviews/shadow-ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: review.customerEmail,
          type: "email",
          action,
          reason: "Administrative moderation flag"
        })
      });

      if (res.ok) {
        toast.success(`Reviewer successfully ${isBanned ? "un-shadow-banned" : "shadow-banned"}`);
        fetchReviews();
        if (selectedReview && selectedReview._id === review._id) {
          await fetchReviewDetail(review._id);
        }
      } else {
        toast.error("Failed to apply shadow-ban status");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit admin reply (Drawer form)
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
        toast.success(replyText.trim() === "" ? "Admin reply cleared" : "Admin reply updated");
        fetchReviews();
        await fetchReviewDetail(selectedReview._id);
      } else {
        toast.error("Failed to update reply");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Inline action forms handlers
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

  // Set side panel review detail
  const handleOpenDetail = (review) => {
    setSelectedReview(review);
    setTimeline([]);
    fetchReviewDetail(review._id);
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
          <button key="unapprove" onClick={() => handleModerateSingle(review._id, "Pending")} className="text-amber-600 hover:underline">
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
      
      // Quick Edit
      actions.push(
        <button key="quick-edit" onClick={() => handleStartQuickEdit(review)} className="hover:underline">
          Quick Edit
        </button>
      );
      
      // Edit (Opens drawer)
      actions.push(
        <button key="edit" onClick={() => handleOpenDetail(review)} className="hover:underline">
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
      
      // Shadow Ban toggle
      actions.push(
        <button 
          key="shadow-ban" 
          onClick={() => handleToggleShadowBanSingle(review)} 
          className="text-purple-600 hover:underline"
        >
          {review.shadowBanned ? "Un-Shadow Ban" : "Shadow Ban"}
        </button>
      );
      
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

  return (
    <AdminPageLayout 
      title="Product Reviews" 
      breadcrumbs={[{ label: "Store", href: "/admin/orders" }, { label: "Reviews" }]}
    >
      {/* 4 Analytics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 select-none">
        {/* Average Rating */}
        <div className="bg-white border border-[#c3c4c7] p-5 shadow-sm rounded-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Average Rating</span>
            <span className="text-3xl font-black text-gray-800">{stats.averageRating.toFixed(1)} <span className="text-sm font-normal text-gray-400">/ 5</span></span>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg text-amber-500">
            <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
          </div>
        </div>

        {/* Pending Moderation */}
        <div className="bg-white border border-[#c3c4c7] p-5 shadow-sm rounded-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Pending Reviews</span>
            <span className="text-3xl font-black text-gray-800 flex items-center gap-1.5">
              {stats.pendingCount}
              {stats.pendingCount > 0 && <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />}
            </span>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-blue-500">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Approval Rate */}
        <div className="bg-white border border-[#c3c4c7] p-5 shadow-sm rounded-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Approval Rate</span>
            <span className="text-3xl font-black text-gray-800">{stats.approvalRate.toFixed(1)}%</span>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-green-500">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Spam Ratio */}
        <div className="bg-white border border-[#c3c4c7] p-5 shadow-sm rounded-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Spam Ratio</span>
            <span className="text-3xl font-black text-gray-800">{stats.spamRatio.toFixed(1)}%</span>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-red-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 pb-20 items-start">
        {/* Main Content Area */}
        <div className="flex-1 w-full space-y-4">
          
          {/* WordPress Subsubsub Navigation Links */}
          <div className="flex flex-wrap items-center justify-between border-b border-[#c3c4c7] pb-2">
            <ul className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#2c3338] font-medium select-none">
              <li>
                <button 
                  onClick={() => { setStatusFilter("All"); setPage(1); }} 
                  className={`hover:text-[#2271b1] transition-colors ${statusFilter === "All" ? "font-bold text-[#000]" : "text-[#2271b1]"}`}
                >
                  All <span className="text-gray-400 text-xs">({stats.allCount || 0})</span>
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
                  Trash <span className="text-gray-400 text-xs font-bold">({stats.trashCount || 0})</span>
                </button>
              </li>
            </ul>

            {/* Quick search input */}
            <div className="relative w-full md:w-64 mt-2 md:mt-0">
              <input
                type="text"
                placeholder="Search reviews..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full text-xs pl-8 pr-3 py-1 border border-[#c3c4c7] bg-white outline-none focus:border-[#2271b1]"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
            </div>
          </div>

          {/* Filtering & Bulk Actions Controls Bar */}
          <div className="bg-[#f6f7f7] border border-[#c3c4c7] p-3 flex flex-wrap gap-3 items-center justify-between shadow-sm rounded-sm select-none">
            <div className="flex flex-wrap items-center gap-3">
              {/* Bulk actions tools */}
              <select
                value={bulkAction}
                onChange={e => setBulkAction(e.target.value)}
                className="text-xs border border-[#c3c4c7] px-2 py-1 bg-white outline-none focus:border-[#2271b1]"
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
              <button
                onClick={handleBulkAction}
                disabled={selectedIds.length === 0}
                className="bg-white border border-[#c3c4c7] hover:border-[#135e96] hover:text-[#135e96] text-gray-700 px-3 py-1 text-xs font-bold disabled:opacity-50 disabled:hover:border-[#c3c4c7] disabled:hover:text-gray-700 transition-all rounded-sm"
              >
                Apply
              </button>
            </div>

            {/* Filter by Rating */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-450 uppercase">Filter:</span>
              <select
                value={ratingFilter}
                onChange={e => { setRatingFilter(e.target.value); setPage(1); }}
                className="text-xs border border-[#c3c4c7] px-2 py-1 bg-white outline-none focus:border-[#2271b1] text-gray-700"
              >
                <option value="">All Ratings</option>
                <option value="5">5 Star</option>
                <option value="4">4 Star</option>
                <option value="3">3 Star</option>
                <option value="2">2 Star</option>
                <option value="1">1 Star</option>
              </select>
            </div>
          </div>

          {/* WordPress comments table */}
          <div className="bg-white border border-[#c3c4c7] shadow-sm rounded-sm overflow-hidden">
            {loading ? (
              <div className="p-20 text-center space-y-4">
                <div className="w-6 h-6 border-2 border-[#2271b1] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-450">Loading reviews database...</p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="p-20 text-center space-y-3">
                <MessageSquare className="w-10 h-10 text-gray-300 mx-auto" />
                <h4 className="text-[13px] font-bold text-gray-700 uppercase">No reviews found</h4>
                <p className="text-[11px] text-gray-450">There are no reviews matching your current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px] table-fixed">
                  <thead>
                    <tr className="bg-[#f6f7f7] border-b border-[#c3c4c7] text-[#2c3338] font-bold text-[13px] select-none">
                      <th className="py-2.5 px-4 w-12 text-center align-middle">
                        <button onClick={toggleSelectAll} className="flex items-center justify-center w-full">
                          {selectedIds.length === reviews.length ? (
                            <CheckSquare className="w-4 h-4 text-[#2271b1]" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th className="py-2.5 px-4 w-52 font-semibold">Author</th>
                      <th className="py-2.5 px-4 font-semibold w-[420px]">Comment</th>
                      <th className="py-2.5 px-4 w-48 font-semibold">In Response To</th>
                      <th className="py-2.5 px-4 w-44 font-semibold">Submitted On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#c3c4c7]">
                    {reviews.map(review => {
                      const isSelected = selectedIds.includes(review._id);
                      const isReplying = replyingId === review._id;
                      const isQuickEditing = quickEditingId === review._id;
                      const bgClass = getRowBgColor(review);
                      
                      // Render normal row vs quick edit inline editor
                      if (isQuickEditing) {
                        return (
                          <tr key={review._id} className="bg-[#f6f7f7] border-y-2 border-[#c3c4c7]">
                            <td colSpan={5} className="p-4 align-top">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Column: Author fields */}
                                <div className="space-y-3">
                                  <h4 className="text-[12px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-200 pb-1 flex items-center gap-1.5 select-none">
                                    <Edit2 className="w-3.5 h-3.5" /> Edit Author Information
                                  </h4>
                                  <div className="space-y-3">
                                    <div>
                                      <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Author Name</label>
                                      <input 
                                        type="text" 
                                        className="w-full text-xs border border-[#c3c4c7] p-2 bg-white outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                                        value={quickEditData.customerName}
                                        onChange={e => setQuickEditData({ ...quickEditData, customerName: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Author Email</label>
                                      <input 
                                        type="email" 
                                        className="w-full text-xs border border-[#c3c4c7] p-2 bg-white outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                                        value={quickEditData.customerEmail}
                                        onChange={e => setQuickEditData({ ...quickEditData, customerEmail: e.target.value })}
                                      />
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Right Column: Review fields */}
                                <div className="space-y-3">
                                  <h4 className="text-[12px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-200 pb-1 flex items-center gap-1.5 select-none">
                                    <MessageSquare className="w-3.5 h-3.5" /> Edit Review Content
                                  </h4>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Rating</label>
                                      <select 
                                        className="w-full text-xs border border-[#c3c4c7] p-2 bg-white outline-none focus:border-[#2271b1]"
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
                                        className="w-full text-xs border border-[#c3c4c7] p-2 bg-white outline-none focus:border-[#2271b1]"
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
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Review Title</label>
                                    <input 
                                      type="text" 
                                      className="w-full text-xs border border-[#c3c4c7] p-2 bg-white outline-none focus:border-[#2271b1]"
                                      value={quickEditData.title}
                                      onChange={e => setQuickEditData({ ...quickEditData, title: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Review Comment</label>
                                    <textarea 
                                      rows={3}
                                      className="w-full text-xs border border-[#c3c4c7] p-2 bg-white outline-none focus:border-[#2271b1] resize-none"
                                      value={quickEditData.comment}
                                      onChange={e => setQuickEditData({ ...quickEditData, comment: e.target.value })}
                                    />
                                  </div>
                                </div>
                              </div>
                              
                              {/* Quick Edit inline actions row */}
                              <div className="flex justify-end gap-2 mt-4 select-none">
                                <button 
                                  type="button" 
                                  onClick={() => setQuickEditingId(null)}
                                  className="border border-[#c3c4c7] bg-white hover:bg-neutral-50 px-4 py-1.5 text-xs font-bold uppercase transition-all rounded-sm text-gray-700"
                                >
                                  Cancel
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => handleQuickEditSubmit(review._id)}
                                  className="bg-black text-white hover:bg-neutral-800 px-4 py-1.5 text-xs font-bold uppercase transition-all rounded-sm"
                                >
                                  Update Review
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr 
                          key={review._id} 
                          className={`group transition-colors ${bgClass} ${
                            isSelected ? "bg-[#f0f6fa]/80" : ""
                          }`}
                        >
                          {/* Checkbox column */}
                          <td className={`py-4 px-4 align-top w-12 text-center ${review.status === "Pending" ? "border-l-4 border-l-[#d54e21]" : ""}`}>
                            <button onClick={() => toggleSelectOne(review._id)} className="flex items-center justify-center w-full">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-[#2271b1]" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
                              )}
                            </button>
                          </td>

                          {/* Author column */}
                          <td className="py-4 px-4 align-top">
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-full ${getAvatarColor(review.customerName)} text-white flex items-center justify-center font-bold text-xs select-none shadow-sm shrink-0`}>
                                {getInitials(review.customerName)}
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <div className="font-bold text-gray-800 truncate">
                                  {review.customerName}
                                </div>
                                <div className="text-[11px] text-[#2271b1] hover:underline font-mono truncate block" title={review.customerEmail}>
                                  {review.customerEmail}
                                </div>
                                <div className="text-[10px] text-gray-400 font-mono">
                                  IP: {review.ipAddress || "N/A"}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1.5 select-none">
                                  {review.verifiedPurchase && (
                                    <span className="text-[9px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-150 uppercase font-black tracking-tight inline-block">
                                      Verified
                                    </span>
                                  )}
                                  {review.shadowBanned && (
                                    <span className="text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-150 uppercase font-black tracking-tight inline-block">
                                      Banned
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Comment details column */}
                          <td className="py-4 px-4 align-top">
                            <div className="space-y-1.5">
                              {/* Rating & Title */}
                              <div className="flex items-center gap-2">
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
                                  <span className="font-bold text-gray-800 text-[12px]">{review.title}</span>
                                )}
                              </div>

                              {/* Review Comment text */}
                              <p className="text-[#2c3338] text-[13px] leading-relaxed font-medium break-words whitespace-pre-wrap select-text">
                                {review.comment}
                              </p>

                              {/* Spam score label */}
                              {review.spamScore !== undefined && (
                                <div className="select-none inline-block">
                                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                    review.spamScore >= 5 
                                      ? "bg-amber-50 text-amber-700 border-amber-200" 
                                      : "bg-neutral-50 text-neutral-400 border-neutral-100"
                                  }`}>
                                    Spam Score: {review.spamScore}
                                  </span>
                                </div>
                              )}

                              {/* Nested replies list */}
                              {review.replies && review.replies.length > 0 && (
                                <div className="bg-[#f6f7f7] border border-[#d5d7d9] p-2.5 rounded-sm mt-3 relative text-[12px] text-[#2c3338] space-y-1">
                                  <div className="font-bold flex items-center gap-1">
                                    <CornerDownRight className="w-3.5 h-3.5 text-gray-400" />
                                    <span>Reply from {review.replies[0].staffName}</span>
                                    <span className="text-[10px] text-gray-400 font-normal">on {formatDate(review.replies[0].createdAt)}</span>
                                  </div>
                                  <p className="text-gray-600 font-medium pl-4 select-text">
                                    {review.replies[0].comment}
                                  </p>
                                </div>
                              )}

                              {/* Hover Action Row (Desktop) vs Block actions row (Mobile) */}
                              <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-[11px] font-bold text-[#2271b1] select-none opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                                {renderRowActions(review)}
                              </div>
                            </div>

                            {/* Inline Reply Editor Drawer under comment content */}
                            {isReplying && (
                              <div className="bg-[#f0f6fa] border border-[#c3c4c7] p-4.5 rounded-sm mt-4.5 space-y-3">
                                <label className="block text-[12px] font-bold text-gray-700 uppercase select-none">
                                  Submit Public Staff Reply
                                </label>
                                <textarea
                                  rows={3}
                                  placeholder="Write response as shop administration..."
                                  className="w-full text-xs border border-[#c3c4c7] p-2 bg-white outline-none focus:border-[#2271b1] resize-none"
                                  value={inlineReplyText}
                                  onChange={e => setInlineReplyText(e.target.value)}
                                />
                                <div className="flex justify-end gap-2 select-none">
                                  <button
                                    type="button"
                                    onClick={() => setReplyingId(null)}
                                    className="border border-[#c3c4c7] bg-white hover:bg-neutral-50 px-3 py-1.5 text-xs font-bold uppercase transition-all rounded-sm text-gray-700"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleInlineReplySubmit(review._id)}
                                    className="bg-[#2271b1] text-white hover:bg-[#135e96] px-3.5 py-1.5 text-xs font-bold uppercase transition-all rounded-sm"
                                  >
                                    Submit Reply
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* In Response To column */}
                          <td className="py-4 px-4 align-top">
                            {review.productId ? (
                              <div className="space-y-1">
                                <a 
                                  href={`/products/${review.productId.slug}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-[#2271b1] hover:text-[#135e96] font-semibold hover:underline block truncate max-w-[180px]"
                                  title={review.productId.name}
                                >
                                  {review.productId.name}
                                </a>
                                <div className="flex items-center gap-1.5 select-none">
                                  <button
                                    onClick={() => {
                                      // Search reviews specifically for this product
                                      setSearchQuery(review.productId._id);
                                    }}
                                    className="flex items-center gap-1 bg-[#f6f7f7] hover:bg-[#e0e0e0] border border-[#c3c4c7] px-1.5 py-0.5 rounded text-[11px] font-bold text-gray-600 hover:text-black transition-colors"
                                    title="View comments for this product"
                                  >
                                    <MessageSquare className="w-3 h-3 text-gray-400" />
                                    <span>{review.productId.reviewCount || 0}</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">Deleted Product</span>
                            )}
                          </td>

                          {/* Submitted On column */}
                          <td className="py-4 px-4 align-top text-gray-550 text-[12px]">
                            <div className="font-mono whitespace-pre-line text-xs font-medium text-gray-500 leading-relaxed">
                              {formatDate(review.createdAt)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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

        {/* Side Panel / Sticky Detail Drawer */}
        {selectedReview && (
          <div className="w-full xl:w-96 bg-white border border-[#c3c4c7] shadow-lg rounded-sm p-5 space-y-6 shrink-0 relative animate-slide-in sticky top-6 self-start max-h-[calc(100vh-120px)] overflow-y-auto">
            <button 
              onClick={() => { setSelectedReview(null); setTimeline([]); }}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:bg-neutral-100 rounded-full transition-colors"
              title="Close drawer (Esc)"
            >
              <X className="w-4 h-4" />
            </button>

            {detailLoading ? (
              <div className="py-20 text-center space-y-4">
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Loading audit history...</span>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex justify-between items-center border-b border-neutral-100 pb-2 mb-4">
                    <h3 className="text-[13px] font-bold text-gray-700 uppercase">
                      Review Details
                    </h3>
                    <div className="text-[9px] font-black uppercase text-neutral-450 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-205 select-none">
                      Hotkeys Active
                    </div>
                  </div>

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
                      <div className="flex justify-between"><span className="text-gray-400">Spam Score:</span> 
                        <strong className={`px-1.5 py-0.1 rounded border font-mono ${
                          (selectedReview.spamScore || 0) >= 5 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-neutral-50 text-neutral-400 border-neutral-100"
                        }`}>
                          {selectedReview.spamScore || 0}
                        </strong>
                      </div>
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

                {/* Timeline / History of Moderation Actions */}
                {timeline.length > 0 && (
                  <div className="border-t border-neutral-100 pt-4 space-y-3">
                    <h4 className="text-[12px] font-bold text-gray-500 uppercase flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-neutral-450" />
                      Activity History
                    </h4>
                    <div className="relative border-l border-neutral-200 pl-4 ml-1 space-y-3 max-h-40 overflow-y-auto">
                      {timeline.map((log) => (
                        <div key={log._id} className="relative text-[11px] leading-relaxed">
                          {/* Timeline dot */}
                          <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-neutral-450 border border-white" />
                          <div className="font-bold text-gray-700">{log.action.replace(/_/g, " ")}</div>
                          <div className="text-[10px] text-gray-400 font-medium">
                            By {log.staffId?.name || "System"} on {new Date(log.createdAt).toLocaleDateString()}
                          </div>
                          {log.details?.message && (
                            <p className="text-gray-550 font-medium">{log.details.message}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Moderation Controls Section */}
                <div className="border-t border-neutral-100 pt-4 space-y-3 select-none">
                  <h4 className="text-[12px] font-bold text-gray-500 uppercase">Status Moderation</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleModerateSingle(selectedReview._id, "Approved")}
                      className={`py-1.5 rounded-sm text-xs font-bold uppercase transition-all ${
                        selectedReview.status === "Approved" ? "bg-green-600 text-white shadow-sm" : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                      }`}
                      title="Hotkey: A"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleModerateSingle(selectedReview._id, "Rejected")}
                      className={`py-1.5 rounded-sm text-xs font-bold uppercase transition-all ${
                        selectedReview.status === "Rejected" ? "bg-neutral-600 text-white shadow-sm" : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                      }`}
                      title="Hotkey: R"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleModerateSingle(selectedReview._id, "Spam")}
                      className={`py-1.5 rounded-sm text-xs font-bold uppercase col-span-2 transition-all ${
                        selectedReview.status === "Spam" ? "bg-[#d63638] text-white shadow-sm" : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                      }`}
                      title="Hotkey: S"
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
                      <span className="text-[10px] text-green-605 font-bold">Replied</span>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Write a public response as shop administration..."
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

                {/* Silent Shadow Ban Actions */}
                <div className="border-t border-neutral-100 pt-4 space-y-3">
                  <h4 className="text-[12px] font-bold text-gray-500 uppercase font-bold">Security Actions</h4>
                  <button
                    onClick={() => handleToggleShadowBanSingle(selectedReview)}
                    className={`w-full py-2.5 text-[11px] font-bold uppercase rounded-sm flex items-center justify-center gap-1.5 transition-all border ${
                      selectedReview.shadowBanned
                        ? "bg-purple-600 hover:bg-purple-750 text-white border-purple-600"
                        : "bg-white border-purple-200 text-purple-600 hover:bg-purple-50"
                    }`}
                  >
                    <UserX className="w-3.5 h-3.5" />
                    {selectedReview.shadowBanned ? "Un-Shadow Ban Reviewer" : "Shadow Ban Reviewer"}
                  </button>
                </div>

                <button
                  onClick={() => handleTrashSingle(selectedReview._id)}
                  className="w-full border border-red-200 text-[#d63638] hover:bg-red-50 py-2.5 text-[11px] font-bold uppercase rounded-sm flex items-center justify-center gap-1 mt-4"
                  title="Hotkey: D"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Trash Review
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </AdminPageLayout>
  );
}
