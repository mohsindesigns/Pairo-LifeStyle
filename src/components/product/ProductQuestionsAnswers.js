"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, HelpCircle, Plus, X, ArrowUpRight, Loader, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import TurnstileWidget from "@/components/common/TurnstileWidget";

export default function ProductQuestionsAnswers({ productId, productName }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openIndex, setOpenIndex] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, limit: 5, total: 0, totalPages: 1 });
  
  // Submit Question Drawer State
  const [modalOpen, setModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQuestions(1);
  }, [productId]);

  const fetchQuestions = async (pageNumber = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/questions?page=${pageNumber}&limit=5`);
      if (!res.ok) throw new Error("Failed to fetch questions");
      const data = await res.json();
      setQuestions(data.questions || []);
      setPagination(data.pagination || { page: 1, limit: 5, total: 0, totalPages: 1 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || !customerEmail.trim() || !questionText.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (!turnstileToken) {
      toast.error("Please complete the security check.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          question: questionText.trim(),
          turnstileToken
        })
      });
      const data = await res.json();
      if (!res.ok) {
        turnstileRef.current?.reset();
        setTurnstileToken("");
        throw new Error(data.error || "Failed to submit question");
      }

      toast.success("Thank you! Your question has been submitted for review.");
      setModalOpen(false);
      setCustomerName("");
      setCustomerEmail("");
      setQuestionText("");
      setTurnstileToken("");
      fetchQuestions(1);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-white border border-[#E3DACB] rounded-[var(--radius,0px)] p-6 md:p-10 font-sans">
      
      {/* Header section matching Reviews tab */}
      <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between border-b border-black/5 pb-8 mb-8">
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-medium tracking-tight uppercase heading-font text-[#1E1B19] mb-1">
            Questions & Answers
          </h2>
          <p className="text-xs text-[#6F655B]/60 uppercase tracking-widest font-medium">
            Ask our team about materials, sizing, and styling details.
          </p>
        </div>
        
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-accent text-white hover:opacity-90 transition-colors px-6 py-3.5 rounded-[var(--radius,0px)] text-xs font-medium uppercase tracking-[0.2em] cursor-pointer active:scale-95 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Ask a Question
        </button>
      </div>

      {loading ? (
        /* Loading Skeletons matching Reviews */
        <div className="space-y-4">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="border border-neutral-100 rounded-lg p-5 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-200" />
                <div className="h-4 bg-neutral-200 rounded w-1/3" />
              </div>
              <div className="h-3.5 bg-neutral-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : questions.length === 0 ? (
        /* Empty state matching Reviews styling */
        <div className="py-16 text-center border border-dashed border-[#E3DACB] rounded-[var(--radius,0px)] bg-[#FAF7F0]/30">
          <MessageSquare className="w-10 h-10 text-[#6F655B]/40 mx-auto mb-4" />
          <p className="text-xs sm:text-sm font-medium uppercase tracking-wider text-[#1E1B19] mb-1">No questions yet</p>
          <p className="text-xs text-[#6F655B]/60 max-w-sm mx-auto leading-relaxed mb-6">
            Be the first to ask a question about this product! Share your queries with our team.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-accent text-white hover:opacity-90 transition-colors px-6 py-3 rounded-[var(--radius,0px)] text-xs font-medium uppercase tracking-[0.2em]"
          >
            Ask a question
          </button>
        </div>
      ) : (
        /* Questions List matching exact FAQ Accordion style (no author, no admin label, no dates) */
        <div className="space-y-3">
          {questions.map((q, idx) => {
            const isOpen = openIndex === idx;
            const reply = q.replies?.[0];

            return (
              <div
                key={q._id}
                className={`rounded-[var(--radius,0px)] border transition-all duration-300 overflow-hidden ${
                  isOpen ? "bg-[var(--accent)]/[0.04] border-accent/40" : "bg-transparent border-border hover:border-accent/30"
                }`}
              >
                {/* Accordion Trigger */}
                <button
                  onClick={() => setOpenIndex(isOpen ? -1 : idx)}
                  className="w-full px-5 py-5 md:px-6 md:py-6 flex items-center justify-between text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 shrink-0 rounded-[var(--radius,0px)] flex items-center justify-center transition-colors ${isOpen ? 'bg-accent' : 'bg-white border border-border'}`}>
                      <HelpCircle className={`w-3.5 h-3.5 ${isOpen ? 'text-white' : 'text-primary/50'}`} />
                    </div>
                    <h3 className="text-xs md:text-sm font-semibold uppercase tracking-wider text-primary leading-snug">
                      {q.question}
                    </h3>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 shrink-0 ml-4 transition-transform duration-300 ${isOpen ? 'text-accent rotate-180' : 'text-primary/40'}`} />
                </button>

                {/* Collapsible Answer */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="px-5 pb-6 md:px-6 md:pb-8 border-t border-accent/20 pt-4 pl-[52px] md:pl-[56px]">
                        <p className="text-primary/90 font-normal text-sm md:text-base leading-loose tracking-normal max-w-2xl">
                          {reply ? reply.answer : "Question is being reviewed by our team."}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Pagination matching Reviews */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 pt-6 border-t border-black/5">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchQuestions(pagination.page - 1)}
                className="px-5 py-2.5 border border-neutral-200 hover:border-black disabled:border-neutral-100 disabled:text-neutral-300 rounded-full text-xs font-bold uppercase tracking-widest transition-all"
              >
                Prev
              </button>
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchQuestions(pagination.page + 1)}
                className="px-5 py-2.5 border border-neutral-200 hover:border-black disabled:border-neutral-100 disabled:text-neutral-300 rounded-full text-xs font-bold uppercase tracking-widest transition-all"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ask Question Drawer */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-end transition-opacity duration-300">
            <motion.div
              initial={{ x: "100%", opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.8 }}
              transition={{ type: "tween", duration: 0.35, ease: "easeInOut" }}
              className="w-full max-w-xl bg-white h-full shadow-2xl p-6 md:p-8 flex flex-col justify-between overflow-y-auto"
            >
              <div>
                <div className="flex justify-between items-center border-b border-neutral-100 pb-4 mb-6">
                  <div>
                    <h3 className="text-lg font-black heading-font uppercase text-black">
                      Ask a Question
                    </h3>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
                      For {productName}
                    </p>
                  </div>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-neutral-500" />
                  </button>
                </div>

                <form onSubmit={handleAskQuestion} className="space-y-6">
                  {/* Name field */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Mansoor Ahmed"
                      className="w-full border border-neutral-200 rounded-lg p-3 text-xs outline-none focus:border-black transition-colors"
                    />
                  </div>

                  {/* Email field */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="e.g. mansoor@example.com"
                      className="w-full border border-neutral-200 rounded-lg p-3 text-xs outline-none focus:border-black transition-colors"
                    />
                  </div>

                  {/* Question textarea */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">
                      Your Question
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      placeholder="Ask about materials, sizing fit, or custom design request options..."
                      className="w-full border border-neutral-200 rounded-lg p-3 text-xs outline-none focus:border-black transition-colors resize-none"
                    />
                  </div>

                  <TurnstileWidget
                    ref={turnstileRef}
                    onVerify={(token) => setTurnstileToken(token)}
                    onExpire={() => setTurnstileToken("")}
                  />
                </form>
              </div>

              {/* Drawer footer actions */}
              <div className="border-t border-neutral-100 pt-4 mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-1/3 border border-neutral-200 hover:bg-neutral-50 px-4 py-3 rounded-full text-xs font-bold uppercase tracking-[0.1em] text-neutral-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAskQuestion}
                  disabled={submitting}
                  className="w-2/3 bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-300 transition-colors px-4 py-3 rounded-full text-xs font-bold uppercase tracking-[0.2em] cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Submit Question
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
