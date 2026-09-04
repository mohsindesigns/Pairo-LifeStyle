"use client";
import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import TurnstileWidget from "@/components/common/TurnstileWidget";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !email) {
      setError("This reset link is invalid or missing. Please request a new one.");
    }
  }, [token, email]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!turnstileToken) {
      setError("Please complete the security check.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/user/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          token, 
          email, 
          password,
          turnstileToken
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 3000);
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
            <Lock className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-wider text-black">
            {success ? "Password Updated" : "Set New Password"}
          </h1>
          <p className="mt-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
            {success ? "You can now sign in" : "Create a strong new password"}
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="w-14 h-14 text-green-500" />
            </div>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Your password has been reset successfully. Redirecting you to Sign In…
            </p>
            <Link
              href="/login"
              className="inline-block text-[10px] font-black uppercase tracking-widest text-black hover:underline underline-offset-2 transition-colors"
            >
              Sign In Now
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

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-black/60 px-0.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="block w-full px-4 py-3 pr-12 bg-white border border-black/10 rounded-[4px] text-xs font-semibold text-black placeholder-neutral-300 focus:border-black outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-black/60 px-0.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter new password"
                  className="block w-full px-4 py-3 pr-12 bg-white border border-black/10 rounded-[4px] text-xs font-semibold text-black placeholder-neutral-300 focus:border-black outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <TurnstileWidget
              ref={turnstileRef}
              onVerify={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken("")}
            />

            <button
              type="submit"
              disabled={loading || !token || !email}
              className="w-full py-4 bg-black text-white rounded-[4px] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-neutral-900 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Reset Password"
              )}
            </button>

            <div className="text-center pt-1">
              <Link
                href="/forgot-password"
                className="text-[10px] font-bold text-neutral-400 hover:text-black uppercase tracking-widest transition-colors"
              >
                Request a new link
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
