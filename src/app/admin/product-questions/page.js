"use client";

import React, { useState, useEffect } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { MessageSquare, Check, EyeOff, Trash2, Reply, Eye, Search, AlertCircle, X, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "react-hot-toast";
import { usePopup } from "@/context/PopupContext";

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

  const statusBadge = (s) => {
    const map = {
      Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Pending:  "bg-amber-50 text-amber-700 border-amber-200",
      Hidden:   "bg-gray-100 text-gray-600 border-gray-200",
    };
    return `inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${map[s] || map.Hidden}`;
  };

  return (
    <AdminPageLayout
      title="Product Q&A"
      subtitle="Moderate, reply to, and publish customer questions"
      breadcrumbs={[{ label: "Products", href: "/admin/products" }, { label: "Questions & Answers" }]}
    >
      <div className="space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pending Review", value: stats.pendingCount, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", icon: AlertCircle },
            { label: "Approved & Public", value: stats.approvedCount, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", icon: Check },
            { label: "Hidden", value: stats.hiddenCount, color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200", icon: EyeOff },
          ].map(({ label, value, color, bg, border, icon: Icon }) => (
            <div key={label} className={`${bg} border ${border} rounded-[3px] p-4 flex items-center justify-between`}>
              <div>
                <p className="text-[11px] font-bold text-[#646970] uppercase tracking-wider">{label}</p>
                <p className={`text-2xl font-bold ${color} mt-0.5`}>{value}</p>
              </div>
              <Icon className={`w-7 h-7 ${color} opacity-25`} />
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bg-white border border-[#ccd0d4] rounded-[3px] shadow-sm p-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-1.5">
            {["All", "Pending", "Approved", "Hidden"].map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`px-3 py-1.5 text-[12px] font-bold rounded-[3px] transition-all cursor-pointer ${
                  status === s ? "bg-[#2271b1] text-white" : "bg-[#f6f7f7] border border-[#dcdcde] text-[#2c3338] hover:bg-[#f0f0f1]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:max-w-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#8c8f94] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#f6f7f7] border border-[#dcdcde] pl-8 pr-3 py-1.5 text-[13px] focus:outline-none focus:border-[#2271b1] focus:bg-white transition-all rounded-[3px]"
              />
            </div>
            <button type="submit" className="bg-[#f6f7f7] border border-[#dcdcde] hover:bg-[#f0f0f1] text-[#2c3338] px-3 py-1.5 text-[12px] font-bold rounded-[3px] cursor-pointer">Go</button>
          </form>
        </div>

        {/* Questions List */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white border border-[#ccd0d4] rounded-[3px] p-12 text-center">
              <div className="w-6 h-6 border-2 border-[#2271b1] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[13px] text-[#646970]">Loading questions...</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="bg-white border border-[#ccd0d4] rounded-[3px] p-12 text-center">
              <MessageSquare className="w-10 h-10 text-[#dcdcde] mx-auto mb-3" />
              <p className="text-[13px] text-[#646970]">No questions found.</p>
            </div>
          ) : (
            questions.map((q) => {
              const isExpanded = expandedIds[q._id];
              const hasReply = q.replies && q.replies.length > 0;
              return (
                <div key={q._id} className="bg-white border border-[#ccd0d4] rounded-[3px] shadow-sm overflow-hidden">
                  {/* Card Header */}
                  <div className="flex items-start gap-3 p-4">
                    {/* Status dot */}
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      q.status === "Approved" ? "bg-emerald-500" : q.status === "Pending" ? "bg-amber-500" : "bg-gray-400"
                    }`} />

                    <div className="flex-1 min-w-0">
                      {/* Product */}
                      {q.productId ? (
                        <div className="flex items-center gap-2 mb-1.5">
                          {q.productId.images?.[0] && (
                            <img src={q.productId.images[0]} alt="" className="w-6 h-6 rounded object-cover border border-black/10 shrink-0" />
                          )}
                          <a
                            href={`/product/${q.productId.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-[#2271b1] hover:underline flex items-center gap-1"
                          >
                            {q.productId.name}
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        </div>
                      ) : (
                        <p className="text-[11px] font-bold text-red-500 mb-1">Deleted Product</p>
                      )}

                      {/* Question */}
                      <p className="text-[14px] font-semibold text-[#1d2327] leading-snug">
                        &ldquo;{q.question}&rdquo;
                      </p>

                      {/* Meta */}
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
                        <span className={statusBadge(q.status)}>{q.status}</span>
                        <span className="text-[11px] text-[#646970]">{new Date(q.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        {hasReply && (
                          <span className="text-[11px] text-[#2271b1] font-semibold flex items-center gap-1">
                            <Reply className="w-3 h-3" /> Replied
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => toggleExpand(q._id)}
                        className="p-2 hover:bg-[#f0f0f1] rounded text-[#646970] transition-colors"
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => { setReplyingQuestion(q); setReplyText(q.replies?.[0]?.answer || ""); }}
                        className="p-2 hover:bg-[#f0f6fb] rounded text-[#2271b1] transition-colors"
                        title="Reply"
                      >
                        <Reply className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(q._id, q.status)}
                        className={`p-2 rounded transition-colors ${q.status === "Approved" ? "hover:bg-amber-50 text-amber-600" : "hover:bg-emerald-50 text-emerald-600"}`}
                        title={q.status === "Approved" ? "Hide" : "Approve & Publish"}
                      >
                        {q.status === "Approved" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q._id)}
                        className="p-2 hover:bg-red-50 rounded text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-[#f0f0f1] bg-[#f9f9fa] p-4 space-y-3">
                      {hasReply && (
                        <div className="bg-[#f0f7ff] border border-[#b3d4ff] rounded p-3 text-[13px]">
                          <p className="text-[10px] font-bold text-[#2271b1] uppercase tracking-wider mb-1">Store Answer</p>
                          <p className="text-[#1d2327] font-medium">&ldquo;{q.replies[0].answer}&rdquo;</p>
                        </div>
                      )}
                      {!hasReply && (
                        <div className="bg-[#fff9db] border border-[#ffe066] rounded p-3 text-[12px] font-semibold text-amber-800">
                          No reply yet — click the reply button to answer this question.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-white border border-[#ccd0d4] rounded-[3px] text-[12px] font-semibold text-[#2c3338] disabled:opacity-50 hover:bg-[#f6f7f7] cursor-pointer"
            >
              ← Previous
            </button>
            <span className="text-[12px] text-[#646970] px-2">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 bg-white border border-[#ccd0d4] rounded-[3px] text-[12px] font-semibold text-[#2c3338] disabled:opacity-50 hover:bg-[#f6f7f7] cursor-pointer"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Reply Modal */}
      {replyingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#ccd0d4] rounded-[3px] shadow-xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#f6f7f7] border-b border-[#ccd0d4]">
              <h3 className="text-[14px] font-bold text-[#1d2327] flex items-center gap-2">
                <Reply className="w-4 h-4 text-[#2271b1]" />
                Reply to Question
              </h3>
              <button onClick={() => setReplyingQuestion(null)} className="text-[#646970] hover:text-[#1d2327] p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-[#f9f9fa] border border-[#e2e4e7] rounded p-3.5">
                <p className="text-[10px] font-bold text-[#646970] uppercase tracking-wider mb-1.5">Customer Question</p>
                <p className="text-[13px] text-[#1d2327] font-medium italic">&ldquo;{replyingQuestion.question}&rdquo;</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-[#1d2327]">Your Answer</label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={5}
                  placeholder="Type your official store response here..."
                  className="w-full bg-[#f6f7f7] border border-[#dcdcde] px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#2271b1] focus:bg-white transition-all rounded-[3px] resize-none"
                />
                <p className="text-[11px] text-[#646970]">Replying will auto-approve the question and email your response to the customer.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-[#f6f7f7] border-t border-[#ccd0d4]">
              <button
                onClick={() => setReplyingQuestion(null)}
                className="bg-white border border-[#dcdcde] text-[#3c434a] hover:bg-[#f6f7f7] px-4 py-2 rounded-[3px] text-[12px] font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReply}
                disabled={replying}
                className="bg-[#2271b1] text-white hover:bg-[#135e96] px-5 py-2 rounded-[3px] text-[12px] font-bold disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                <Check className="w-3.5 h-3.5" />
                {replying ? "Submitting..." : "Submit Answer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}
