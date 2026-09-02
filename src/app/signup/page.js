"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import TurnstileWidget from "@/components/common/TurnstileWidget";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hpField, setHpField] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError("");

    if (hpField) {
      // Honeypot triggered by bot
      setSubmitted(true);
      return;
    }

    if (!turnstileToken) {
      setError("Please complete the security check.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          email, 
          password, 
          hp_field: hpField,
          turnstileToken 
        }),
      });

      const data = await res.json();

      if (res.ok || data.pendingVerification || data.resent) {
        setSubmitted(true);
      } else {
        setError(data.message || data.error || "Something went wrong");
        turnstileRef.current?.reset();
        setTurnstileToken("");
      }
    } catch (err) {
      setError("Failed to create account. Please try again.");
      turnstileRef.current?.reset();
      setTurnstileToken("");
    } finally {
      setLoading(false);
    }
  };

  // ── Check-your-email state ──────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex flex-col justify-center pt-8 pb-20 px-6 sm:px-8 font-sans">
        <div className="max-w-md w-full mx-auto bg-[#FAF9F6] border border-black/[0.04] p-8 sm:p-10 rounded-[4px] shadow-sm text-center space-y-6">
          <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center mx-auto">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-[20px] font-black tracking-wider text-black">Check Your Email</h1>
            <p className="text-[11px] text-black font-semibold leading-relaxed">
              We&apos;ve sent a verification link to
            </p>
            <p className="text-[13px] font-black text-black">{email}</p>
          </div>
          <p className="text-[10px] text-black/70 uppercase tracking-widest leading-relaxed">
            Click the link in the email to verify your account.<br/>
            The link expires in 24 hours.
          </p>
          <div className="border-t border-black/10 pt-5 space-y-3">
            <p className="text-[10px] text-black/50 uppercase tracking-widest">Didn&apos;t receive it?</p>
            <button
              onClick={() => handleSubmit({ preventDefault: () => {} })}
              className="text-[10px] font-black uppercase tracking-widest text-black underline underline-offset-4 hover:opacity-70 transition cursor-pointer"
            >
              Resend Verification Email
            </button>
          </div>
          <Link
            href="/login"
            className="block text-[9px] text-black/40 uppercase tracking-[0.3em] hover:text-black transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // ── Signup form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col justify-center pt-8 pb-20 px-6 sm:px-8 font-sans">
      <div className="max-w-md w-full mx-auto bg-[#FAF9F6] border border-black/[0.04] p-8 sm:p-10 rounded-[4px] shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-black tracking-wider text-black">Create Account</h1>
          <p className="mt-2 text-[10px] font-bold text-black/50 uppercase tracking-widest">Join Pairo Lifestyle</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-600 text-[10px] font-bold p-4 rounded-[4px] text-center uppercase tracking-widest border border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-black px-0.5">Full Name</label>
              <input
                type="text"
                required
                className="block w-full px-4 py-3 bg-white border border-black/10 rounded-[4px] text-xs font-semibold text-black placeholder-neutral-300 focus:border-black outline-none transition-all"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-black px-0.5">Email Address</label>
              <input
                type="email"
                required
                className="block w-full px-4 py-3 bg-white border border-black/10 rounded-[4px] text-xs font-semibold text-black placeholder-neutral-300 focus:border-black outline-none transition-all"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-black px-0.5">Password</label>
              <input
                type="password"
                required
                minLength={8}
                className="block w-full px-4 py-3 bg-white border border-black/10 rounded-[4px] text-xs font-semibold text-black placeholder-neutral-300 focus:border-black outline-none transition-all"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <input
            type="text"
            className="hidden"
            value={hpField}
            onChange={(e) => setHpField(e.target.value)}
            tabIndex="-1"
            autoComplete="off"
          />

          <TurnstileWidget
            ref={turnstileRef}
            onVerify={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken("")}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-black text-white rounded-[4px] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-neutral-900 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>

          <div className="text-center pt-2">
            <p className="text-[11px] text-black/60 font-medium tracking-wide">
              Already have an account?{" "}
              <Link href="/login" className="text-black font-black uppercase tracking-wider hover:underline underline-offset-2 ml-1">Sign in</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
