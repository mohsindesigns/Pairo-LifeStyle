"use client";

import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Mail, Lock } from "lucide-react";
import TurnstileWidget from "@/components/common/TurnstileWidget";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hpField, setHpField] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (hpField) {
      // Honeypot caught bot
      setError("Invalid credentials");
      return;
    }

    if (!turnstileToken) {
      setError("Please complete the security check.");
      return;
    }

    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        loginType: "customer",
        turnstileToken,
        redirect: false,
      });

      if (result.error) {
        setError(result.error);
        turnstileRef.current?.reset();
        setTurnstileToken("");
      } else {
        const { getSession } = await import("next-auth/react");
        const session = await getSession();
        if (session?.user?.isStaff) {
          router.push("/admin");
        } else {
          router.push("/profile");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      turnstileRef.current?.reset();
      setTurnstileToken("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center pt-8 pb-20 px-6 sm:px-8 font-sans">
      <div className="max-w-md w-full mx-auto bg-[#FAF9F6] border border-black/[0.04] p-8 sm:p-10 rounded-[4px] shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-black tracking-wider text-black">Sign In</h1>
          <p className="mt-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Access your Pairo Account</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className={`text-[10px] font-bold p-4 rounded-[4px] text-center border space-y-2 ${
              error === "EMAIL_NOT_VERIFIED"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-red-50 text-red-600 border-red-100"
            }`}>
              {error === "EMAIL_NOT_VERIFIED" ? (
                <div className="space-y-2">
                  <p className="uppercase tracking-widest">Email Not Verified</p>
                  <p className="normal-case tracking-normal font-semibold text-amber-600">
                    Please check your inbox and click the verification link before signing in.
                  </p>
                  <Link href="/signup" className="inline-block underline underline-offset-2 text-amber-700 font-black uppercase tracking-widest text-[9px]">
                    Resend Verification Email
                  </Link>
                </div>
              ) : (
                <p className="uppercase tracking-widest">{error}</p>
              )}
            </div>
          )}
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-black/60 px-0.5">Email Address</label>
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
              <div className="flex justify-between px-0.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-black/60">Password</label>
                <Link href="/forgot-password" className="text-[9px] font-bold text-neutral-400 hover:text-black uppercase tracking-widest transition-colors">Forgot?</Link>
              </div>
              <input
                type="password"
                required
                className="block w-full px-4 py-3 bg-white border border-black/10 rounded-[4px] text-xs font-semibold text-black placeholder-neutral-300 focus:border-black outline-none transition-all"
                placeholder="••••••••"
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
            className="w-full py-4 bg-black text-white rounded-[4px] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-neutral-900 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>

          <div className="text-center pt-2">
            <p className="text-[11px] text-neutral-500 font-medium tracking-wide">
              New to Pairo?{" "}
              <Link href="/signup" className="text-black font-black uppercase tracking-wider hover:underline underline-offset-2 ml-1">Create account</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
