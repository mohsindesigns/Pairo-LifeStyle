"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import TurnstileWidget from "@/components/common/TurnstileWidget";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const emailClean = email.trim();
    if (!emailClean || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(emailClean)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!turnstileToken) {
      setError("Please complete the security check.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/user/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: emailClean,
          turnstileToken
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
        turnstileRef.current?.reset();
        setTurnstileToken("");
      }
    } catch {
      setError("Network error. Please check your connection.");
      turnstileRef.current?.reset();
      setTurnstileToken("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center pt-8 pb-20 px-6 sm:px-8 font-sans">
      <div className="max-w-md w-full mx-auto bg-[#FAF9F6] border border-black/[0.04] p-8 sm:p-10 rounded-[4px] shadow-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-black rounded-full mb-4">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-wider text-black">
            {success ? "Check Your Inbox" : "Forgot Password?"}
          </h1>
          <p className="mt-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
            {success ? "Reset link sent" : "Reset your Pairo account password"}
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="w-14 h-14 text-green-500" />
            </div>
            <p className="text-sm text-neutral-600 leading-relaxed">
              If an account exists for <strong className="text-black">{email}</strong>, you&apos;ll receive a password reset link within a few minutes. Check your spam folder if you don&apos;t see it.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black hover:underline underline-offset-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-100 p-4 rounded-[4px]">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[11px] font-semibold text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-black/60 px-0.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="block w-full px-4 py-3 bg-white border border-black/10 rounded-[4px] text-xs font-semibold text-black placeholder-neutral-300 focus:border-black outline-none transition-all"
              />
            </div>

            <TurnstileWidget
              ref={turnstileRef}
              onVerify={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken("")}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-black text-white rounded-[4px] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-neutral-900 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </button>

            <div className="text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 hover:text-black uppercase tracking-widest transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
