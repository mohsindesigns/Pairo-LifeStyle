"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  Flag, 
  CheckCircle, 
  MessageSquare, 
  Plus, 
  X, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Edit2,
  Trash2,
  UploadCloud,
  Loader
} from "lucide-react";
import { toast } from "react-hot-toast";

// Helper to generate initials from customer name
const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

// Helper to generate color theme based on name hashing
const getAvatarColor = (name) => {
  if (!name) return "bg-neutral-100 text-neutral-400";
  const colors = [
    "bg-red-50 text-red-700 border-red-200",
    "bg-blue-50 text-blue-700 border-blue-200",
    "bg-green-50 text-green-700 border-green-200",
    "bg-amber-50 text-amber-700 border-amber-200",
    "bg-purple-50 text-purple-700 border-purple-200",
    "bg-pink-50 text-pink-700 border-pink-200",
    "bg-indigo-50 text-indigo-700 border-indigo-200"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export default function ProductReviews({ productId, productName }) {
  const { data: session } = useSession();
  
  // State variables
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ rating: 0, reviewCount: 0, ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
  const [pagination, setPagination] = useState({ page: 1, limit: 5, total: 0, totalPages: 1, nextCursor: null });
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  
  // Review submission drawer state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    rating: 5,
    title: "",
    comment: "",
    customerName: session?.user?.name || "",
    recommend: true,
    guestEmail: "",
    orderNumber: ""
  });

  // Customer edit review drawer state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    rating: 5,
    title: "",
    comment: "",
    recommend: true,
    guestEmail: "",
    orderNumber: ""
  });

  // Mock File Upload State
  const [mockFiles, setMockFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  // Long review expand/collapse tracking
  const [expandedReviews, setExpandedReviews] = useState({});
  // Session voting prevention and loading
  const [votedReviews, setVotedReviews] = useState({});
  const [votingIds, setVotingIds] = useState({});

  // Sync logged in user name
  useEffect(() => {
    if (session?.user) {
      Promise.resolve().then(() => {
        setFormData(prev => ({ ...prev, customerName: session.user.name || "" }));
      });
    }
  }, [session]);

  // Fetch reviews from API
  const fetchReviews = useCallback(async (pageNumber = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews?page=${pageNumber}&limit=5&sort=${sort}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        setStats(data.stats || { rating: 0, reviewCount: 0, ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
        setPagination(data.pagination || { page: 1, limit: 5, total: 0, totalPages: 1, nextCursor: null });
      } else {
        toast.error("Failed to load reviews");
      }
    } catch (err) {
      console.error("Error fetching reviews:", err);
    } finally {
      setLoading(false);
    }
  }, [productId, sort]);

  useEffect(() => {
    Promise.resolve().then(() => fetchReviews(1));
  }, [fetchReviews]);

  // Form submit handler (POST)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const submitBody = {
        rating: formData.rating,
        title: formData.title,
        comment: formData.comment,
        customerName: formData.customerName,
        recommend: formData.recommend
      };

      if (!session) {
        submitBody.guestEmail = formData.guestEmail;
        submitBody.orderNumber = formData.orderNumber;
      }

      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitBody)
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || "Review submitted successfully!");
        setIsFormOpen(false);
        setMockFiles([]);
        // Reset form
        setFormData({
          rating: 5,
          title: "",
          comment: "",
          customerName: session?.user?.name || "",
          recommend: true,
          guestEmail: "",
          orderNumber: ""
        });
        fetchReviews(1);
      } else {
        toast.error(data.error || "Review eligibility check failed.");
      }
    } catch (err) {
      toast.error("Failed to submit review. Connection error.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Form edit handler (PUT)
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const submitBody = {
        reviewId: editingReviewId,
        rating: editFormData.rating,
        title: editFormData.title,
        comment: editFormData.comment,
        recommend: editFormData.recommend
      };

      if (!session) {
        submitBody.guestEmail = editFormData.guestEmail;
        submitBody.orderNumber = editFormData.orderNumber;
      }

      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitBody)
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || "Review updated successfully!");
        setIsEditOpen(false);
        setEditingReviewId(null);
        fetchReviews(1);
      } else {
        toast.error(data.error || "Failed to update review.");
      }
    } catch (err) {
      toast.error("Failed to edit review. Connection error.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Helpful voting handler
  const handleVote = async (reviewId, type) => {
    if (votedReviews[reviewId]) {
      toast.error("You have already voted on this review.");
      return;
    }

    setVotingIds(prev => ({ ...prev, [reviewId]: true }));

    // Optimistic UI update
    setReviews(prev => prev.map(r => {
      if (r._id === reviewId) {
        return {
          ...r,
          helpfulVotes: type === "helpful" ? r.helpfulVotes + 1 : r.helpfulVotes,
          unhelpfulVotes: type === "unhelpful" ? r.unhelpfulVotes + 1 : r.unhelpfulVotes
        };
      }
      return r;
    }));
    setVotedReviews(prev => ({ ...prev, [reviewId]: type }));

    try {
      const res = await fetch(`/api/reviews/${reviewId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type })
      });

      if (!res.ok) {
        const data = await res.json();
        // Rollback on error
        setReviews(prev => prev.map(r => {
          if (r._id === reviewId) {
            return {
              ...r,
              helpfulVotes: type === "helpful" ? r.helpfulVotes - 1 : r.helpfulVotes,
              unhelpfulVotes: type === "unhelpful" ? r.unhelpfulVotes - 1 : r.unhelpfulVotes
            };
          }
          return r;
        }));
        setVotedReviews(prev => {
          const next = { ...prev };
          delete next[reviewId];
          return next;
        });
        toast.error(data.error || "Failed to log vote.");
      }
    } catch (err) {
      console.error("Voting error:", err);
    } finally {
      setVotingIds(prev => {
        const next = { ...prev };
        delete next[reviewId];
        return next;
      });
    }
  };

  // Report handler
  const handleReport = async (reviewId) => {
    if (window.confirm("Are you sure you want to report this review for violations?")) {
      try {
        const res = await fetch(`/api/reviews/${reviewId}/report`, {
          method: "POST"
        });
        if (res.ok) {
          toast.success("Review reported. Our moderators will review it shortly.");
        } else {
          toast.error("Could not report review.");
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Drag and drop mock file handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const newFiles = Array.from(e.dataTransfer.files).map(f => ({
        name: f.name,
        size: (f.size / (1024 * 1024)).toFixed(2) + " MB",
        preview: URL.createObjectURL(f)
      }));
      setMockFiles(prev => [...prev, ...newFiles].slice(0, 3));
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const newFiles = Array.from(e.target.files).map(f => ({
        name: f.name,
        size: (f.size / (1024 * 1024)).toFixed(2) + " MB",
        preview: URL.createObjectURL(f)
      }));
      setMockFiles(prev => [...prev, ...newFiles].slice(0, 3));
    }
  };

  const removeMockFile = (index) => {
    setMockFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toggleExpandReview = (reviewId) => {
    setExpandedReviews(prev => ({ ...prev, [reviewId]: !prev[reviewId] }));
  };

  // Load review data into edit form
  const handleOpenEdit = (review) => {
    setEditingReviewId(review._id);
    setEditFormData({
      rating: review.rating,
      title: review.title || "",
      comment: review.comment || "",
      recommend: review.recommend,
      guestEmail: "",
      orderNumber: ""
    });
    setIsEditOpen(true);
  };

  // Star breakdown math helper
  const totalStarVotes = Object.values(stats.ratingBreakdown || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="w-full bg-white border border-black/5 rounded-3xl p-6 md:p-10 font-sans">
      <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between border-b border-black/5 pb-8 mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase heading-font text-black mb-1">
            Ratings & Reviews
          </h2>
          <p className="text-xs text-black/40 uppercase tracking-widest font-semibold">
            Verified purchases from Pairo store
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 bg-black text-white hover:bg-neutral-800 transition-colors px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-md hover:shadow-lg"
        >
          <Plus className="w-4 h-4" />
          Write a Review
        </button>
      </div>

      {/* Ratings Dashboard & Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 items-center bg-neutral-50 rounded-2xl p-6 border border-neutral-100/50">
        <div className="text-center md:border-r border-neutral-200/60 py-4">
          <div className="text-5xl font-black heading-font text-black mb-2 flex items-center justify-center gap-1">
            {stats.rating.toFixed(1)}
            <span className="text-lg text-neutral-400 font-normal">/5</span>
          </div>
          <div className="flex justify-center gap-1.5 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-5 h-5 ${
                  i < Math.floor(stats.rating) ? "fill-[#FFC633] text-[#FFC633]" : "fill-neutral-200 text-neutral-200"
                }`}
              />
            ))}
          </div>
          <div className="text-xs font-bold text-black/50 uppercase tracking-wider">
            Based on {stats.reviewCount} reviews
          </div>
        </div>

        {/* Star breakdown bars */}
        <div className="col-span-2 space-y-2 px-0 md:px-4">
          {[5, 4, 3, 2, 1].map(stars => {
            const count = stats.ratingBreakdown[stars] || 0;
            const percent = totalStarVotes > 0 ? (count / totalStarVotes) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-3 text-xs text-neutral-600">
                <span className="w-8 font-bold text-right">{stars} Star</span>
                <div className="flex-1 bg-neutral-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#FFC633] h-full rounded-full transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="w-8 font-bold text-neutral-400 text-left">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review Submission Form Drawer */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-end transition-opacity duration-300">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl p-6 md:p-8 flex flex-col justify-between overflow-y-auto animate-slide-in">
            <div>
              <div className="flex justify-between items-center border-b border-neutral-100 pb-4 mb-6">
                <div>
                  <h3 className="text-lg font-black heading-font uppercase text-black">
                    Submit Review
                  </h3>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
                    For {productName}
                  </p>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Rating selection */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">
                    Product Rating
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, rating: star }))}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= formData.rating ? "fill-[#FFC633] text-[#FFC633]" : "fill-neutral-200 text-neutral-200"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Verification fields for guests */}
                {!session && (
                  <div className="bg-neutral-50 border border-neutral-200/60 p-4 rounded-xl space-y-4">
                    <div className="flex items-start gap-2.5 text-neutral-500 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        <strong>Verified Purchase Check:</strong> Pairo requires checkout validation. Please provide the checkout email and order number to review this item.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                          Checkout Email
                        </label>
                        <input
                          required
                          type="email"
                          placeholder="e.g. name@domain.com"
                          className="w-full border border-neutral-200 bg-white rounded-lg p-2.5 text-xs outline-none focus:border-black transition-colors"
                          value={formData.guestEmail}
                          onChange={e => setFormData(prev => ({ ...prev, guestEmail: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                          Order Number
                        </label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. PO-89021"
                          className="w-full border border-neutral-200 bg-white rounded-lg p-2.5 text-xs outline-none focus:border-black transition-colors"
                          value={formData.orderNumber}
                          onChange={e => setFormData(prev => ({ ...prev, orderNumber: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Customer name */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">
                    Your Name
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. John Doe"
                    className="w-full border border-neutral-200 rounded-lg p-3 text-xs outline-none focus:border-black transition-colors"
                    value={formData.customerName}
                    onChange={e => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                  />
                </div>

                {/* Review title */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">
                    Review Title
                  </label>
                  <input
                    type="text"
                    placeholder="Summarize your experience..."
                    className="w-full border border-neutral-200 rounded-lg p-3 text-xs outline-none focus:border-black transition-colors"
                    value={formData.title}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                {/* Review comment */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">
                    Review Description
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Tell us what you liked or disliked about this product..."
                    className="w-full border border-neutral-200 rounded-lg p-3 text-xs outline-none focus:border-black transition-colors resize-none"
                    value={formData.comment}
                    onChange={e => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                  />
                </div>

                {/* Recommend toggle */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="recommend"
                    className="rounded text-black focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                    checked={formData.recommend}
                    onChange={e => setFormData(prev => ({ ...prev, recommend: e.target.checked }))}
                  />
                  <label htmlFor="recommend" className="text-xs text-neutral-600 font-bold uppercase tracking-wider cursor-pointer">
                    I recommend this product
                  </label>
                </div>

                {/* Interactive Drag & Drop File Upload Mockup */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">
                    Add Photos/Videos
                  </label>
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-6 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                      dragActive ? "border-black bg-neutral-50 scale-[0.99]" : "border-neutral-200 hover:border-black bg-white"
                    }`}
                    onClick={() => document.getElementById("fileUploadInput").click()}
                  >
                    <UploadCloud className="w-8 h-8 text-neutral-400 animate-bounce" />
                    <span className="text-xs font-bold text-neutral-700">Drag files here or click to upload</span>
                    <span className="text-[10px] text-neutral-400">PNG, JPG, MP4 (Max 3 files, mock verification)</span>
                    <input
                      id="fileUploadInput"
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>

                  {/* Previews */}
                  {mockFiles.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      {mockFiles.map((file, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg border border-neutral-100 overflow-hidden bg-neutral-50 group">
                          <Image src={file.preview} alt="upload preview" fill className="object-cover" unoptimized />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeMockFile(idx); }}
                            className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black text-white rounded-full transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="border-t border-neutral-100 pt-4 mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="w-1/3 border border-neutral-200 hover:bg-neutral-50 px-4 py-3 rounded-full text-xs font-bold uppercase tracking-[0.1em] text-neutral-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-2/3 bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-300 transition-colors px-4 py-3 rounded-full text-xs font-bold uppercase tracking-[0.2em]"
              >
                {submitting ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Edit Review Drawer */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-end transition-opacity duration-300">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl p-6 md:p-8 flex flex-col justify-between overflow-y-auto animate-slide-in">
            <div>
              <div className="flex justify-between items-center border-b border-neutral-100 pb-4 mb-6">
                <div>
                  <h3 className="text-lg font-black heading-font uppercase text-black">
                    Edit Review
                  </h3>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
                    Modifying review for {productName}
                  </p>
                </div>
                <button
                  onClick={() => { setIsEditOpen(false); setEditingReviewId(null); }}
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-6">
                {/* Rating selection */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">
                    Product Rating
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setEditFormData(prev => ({ ...prev, rating: star }))}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= editFormData.rating ? "fill-[#FFC633] text-[#FFC633]" : "fill-neutral-200 text-neutral-200"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Verification fields for guests */}
                {!session && (
                  <div className="bg-neutral-50 border border-neutral-200/60 p-4 rounded-xl space-y-4">
                    <div className="flex items-start gap-2.5 text-neutral-500 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        <strong>Verify Purchase Info:</strong> Provide your checkout details to modify this review.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                          Checkout Email
                        </label>
                        <input
                          required
                          type="email"
                          placeholder="e.g. name@domain.com"
                          className="w-full border border-neutral-200 bg-white rounded-lg p-2.5 text-xs outline-none focus:border-black transition-colors"
                          value={editFormData.guestEmail}
                          onChange={e => setEditFormData(prev => ({ ...prev, guestEmail: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                          Order Number
                        </label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. PO-89021"
                          className="w-full border border-neutral-200 bg-white rounded-lg p-2.5 text-xs outline-none focus:border-black transition-colors"
                          value={editFormData.orderNumber}
                          onChange={e => setEditFormData(prev => ({ ...prev, orderNumber: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Review title */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">
                    Review Title
                  </label>
                  <input
                    type="text"
                    placeholder="Summarize your experience..."
                    className="w-full border border-neutral-200 rounded-lg p-3 text-xs outline-none focus:border-black transition-colors"
                    value={editFormData.title}
                    onChange={e => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                {/* Review comment */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">
                    Review Description
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Tell us what you liked or disliked about this product..."
                    className="w-full border border-neutral-200 rounded-lg p-3 text-xs outline-none focus:border-black transition-colors resize-none"
                    value={editFormData.comment}
                    onChange={e => setEditFormData(prev => ({ ...prev, comment: e.target.value }))}
                  />
                </div>

                {/* Recommend toggle */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="editRecommend"
                    className="rounded text-black focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                    checked={editFormData.recommend}
                    onChange={e => setEditFormData(prev => ({ ...prev, recommend: e.target.checked }))}
                  />
                  <label htmlFor="editRecommend" className="text-xs text-neutral-600 font-bold uppercase tracking-wider cursor-pointer">
                    I recommend this product
                  </label>
                </div>
              </form>
            </div>

            <div className="border-t border-neutral-100 pt-4 mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => { setIsEditOpen(false); setEditingReviewId(null); }}
                className="w-1/3 border border-neutral-200 hover:bg-neutral-50 px-4 py-3 rounded-full text-xs font-bold uppercase tracking-[0.1em] text-neutral-600"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={submitting}
                className="w-2/3 bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-300 transition-colors px-4 py-3 rounded-full text-xs font-bold uppercase tracking-[0.2em]"
              >
                {submitting ? "Updating..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sorting & Filter section */}
      {reviews.length > 0 && (
        <div className="flex justify-between items-center border-b border-black/5 pb-4 mb-6">
          <span className="text-[10px] font-black uppercase text-black/40 tracking-wider">
            Showing {reviews.length} of {pagination.total} reviews
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Sort:</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="border-none bg-transparent text-xs font-bold text-black uppercase tracking-wider focus:ring-0 outline-none p-1 pr-6 cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="most_helpful">Most Helpful</option>
              <option value="highest_rated">Highest Rated</option>
              <option value="lowest_rated">Lowest Rated</option>
            </select>
          </div>
        </div>
      )}

      {/* Loading state with Animated Skeleton Loaders */}
      {loading ? (
        <div className="space-y-6">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="border-b border-black/5 pb-8 last:border-0 space-y-4 animate-pulse">
              <div className="flex justify-between items-start">
                <div className="space-y-2 w-1/3">
                  <div className="h-4 bg-neutral-200 rounded w-2/3" />
                  <div className="h-3 bg-neutral-100 rounded w-1/2" />
                </div>
                <div className="h-3 bg-neutral-150 rounded w-16" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-200" />
                <div className="h-3.5 bg-neutral-100 rounded w-24" />
              </div>
              <div className="space-y-2">
                <div className="h-3.5 bg-neutral-100 rounded w-full" />
                <div className="h-3.5 bg-neutral-100 rounded w-5/6" />
              </div>
              <div className="flex justify-between pt-2">
                <div className="h-6 bg-neutral-150 rounded-full w-28" />
                <div className="h-4 bg-neutral-100 rounded w-12" />
              </div>
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        /* Empty state */
        <div className="py-16 text-center border-2 border-dashed border-neutral-150 rounded-3xl bg-neutral-50/30">
          <MessageSquare className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <h4 className="text-sm font-bold uppercase tracking-wider text-black mb-2">No reviews yet</h4>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed mb-6">
            Be the first to review this product! Share your feedback with other shoppers.
          </p>
          <button
            onClick={() => setIsFormOpen(true)}
            className="bg-black text-white hover:bg-neutral-800 transition-colors px-6 py-3 rounded-full text-xs font-bold uppercase tracking-[0.2em]"
          >
            Review product
          </button>
        </div>
      ) : (
        /* Reviews List */
        <div className="space-y-8">
          {reviews.map(review => {
            const isExpanded = expandedReviews[review._id] || false;
            const needsTruncation = review.comment && review.comment.length > 280;
            const displayComment = needsTruncation && !isExpanded 
              ? `${review.comment.substring(0, 280)}...` 
              : review.comment;
            
            // Check if reviewer is owner of this review to allow editing
            const isOwner = session && (
              review.customerId === session.user.id || 
              review.customerEmail?.toLowerCase() === session.user.email?.toLowerCase()
            );

            return (
              <div key={review._id} className="border-b border-black/5 pb-8 last:border-0 last:pb-0 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    {/* Stars */}
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < review.rating ? "fill-[#FFC633] text-[#FFC633]" : "fill-neutral-200 text-neutral-200"
                          }`}
                        />
                      ))}
                    </div>
                    {/* Review Title */}
                    {review.title && (
                      <h4 className="text-sm font-bold uppercase tracking-wide text-black">
                        {review.title}
                      </h4>
                    )}
                  </div>

                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                    {new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>

                {/* Reviewer Details with circular color-coded initials avatar */}
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${getAvatarColor(review.customerName)} shadow-sm shrink-0 select-none`}>
                    {getInitials(review.customerName)}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                    <span>{review.customerName}</span>
                    {review.verifiedPurchase && (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-150 text-[9px] font-black uppercase tracking-wider shadow-sm select-none">
                          <CheckCircle className="w-2.5 h-2.5 fill-green-700 text-white" />
                          Verified Purchase
                        </span>
                        <span className="text-[9px] text-neutral-400 font-medium normal-case">
                          Purchased on {new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    )}
                    {review.recommend ? (
                      <span className="text-neutral-400">| Recommends Product</span>
                    ) : (
                      <span className="text-neutral-400">| Does Not Recommend</span>
                    )}
                  </div>
                </div>

                {/* Review Message */}
                {review.comment && (
                  <div className="text-sm text-neutral-600 leading-relaxed font-medium">
                    <p>{displayComment}</p>
                    {needsTruncation && (
                      <button
                        onClick={() => toggleExpandReview(review._id)}
                        className="text-xs font-bold text-black hover:underline uppercase tracking-widest mt-2 flex items-center gap-0.5"
                      >
                        {isExpanded ? (
                          <>Read Less <ChevronUp className="w-3 h-3" /></>
                        ) : (
                          <>Read More <ChevronDown className="w-3 h-3" /></>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Admin Replies */}
                {review.replies && review.replies.length > 0 && (
                  <div className="bg-neutral-50 border-l-4 border-black p-4 rounded-r-xl space-y-1.5 ml-4">
                    <div className="flex items-center gap-2 text-[10px] text-black font-black uppercase tracking-wider">
                      <div className="w-1.5 h-1.5 bg-black rounded-full" />
                      {review.replies[0].staffName} Response
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                      {review.replies[0].comment}
                    </p>
                  </div>
                )}

                {/* Helpful, Edit & Report actions */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                      Was this helpful?
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleVote(review._id, "helpful")}
                        disabled={votingIds[review._id]}
                        className={`p-1.5 rounded hover:bg-neutral-100 transition-colors flex items-center gap-1.5 text-neutral-500 hover:text-black ${
                          votedReviews[review._id] === "helpful" ? "text-black bg-neutral-100" : ""
                        }`}
                      >
                        {votingIds[review._id] && votedReviews[review._id] === "helpful" ? (
                          <Loader className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ThumbsUp className="w-3.5 h-3.5" />
                        )}
                        <span className="text-xs font-bold">{review.helpfulVotes || 0}</span>
                      </button>
                      <button
                        onClick={() => handleVote(review._id, "unhelpful")}
                        disabled={votingIds[review._id]}
                        className={`p-1.5 rounded hover:bg-neutral-100 transition-colors flex items-center gap-1.5 text-neutral-500 hover:text-red-600 ${
                          votedReviews[review._id] === "unhelpful" ? "text-red-600 bg-neutral-100" : ""
                        }`}
                      >
                        {votingIds[review._id] && votedReviews[review._id] === "unhelpful" ? (
                          <Loader className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ThumbsDown className="w-3.5 h-3.5" />
                        )}
                        <span className="text-xs font-bold">{review.unhelpfulVotes || 0}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Customer editing option if they are owners (30 day check is enforced on server) */}
                    {(isOwner || !session) && (
                      <button
                        onClick={() => handleOpenEdit(review)}
                        className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-black font-bold uppercase tracking-wider"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit Review
                      </button>
                    )}
                    
                    {(isOwner || !session) && <span className="text-neutral-200 text-xs">|</span>}

                    <button
                      onClick={() => handleReport(review._id)}
                      className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-red-600 font-bold uppercase tracking-wider"
                    >
                      <Flag className="w-3 h-3" />
                      Report
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 pt-6 border-t border-black/5">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchReviews(pagination.page - 1)}
                className="px-5 py-2.5 border border-neutral-200 hover:border-black disabled:border-neutral-100 disabled:text-neutral-300 rounded-full text-xs font-bold uppercase tracking-widest transition-all"
              >
                Prev
              </button>
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchReviews(pagination.page + 1)}
                className="px-5 py-2.5 border border-neutral-200 hover:border-black disabled:border-neutral-100 disabled:text-neutral-300 rounded-full text-xs font-bold uppercase tracking-widest transition-all"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
