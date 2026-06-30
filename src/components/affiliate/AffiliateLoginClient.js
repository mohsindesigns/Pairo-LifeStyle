"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function AffiliateLoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        loginType: "affiliate",
        redirect: false,
      });

      if (res?.error) {
        setError(res.error || "Invalid credentials. Please try again.");
      } else {
        toast.success("Welcome back!");
        window.location.replace("/affiliate/dashboard");
      }
    } catch {
      setError("Login failed. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-10">

        {/* Header */}
        <div className="text-center">
          <p className="text-[10px] font-bold text-black/30 uppercase tracking-[0.3em] mb-3">
            Pairo Partners Program
          </p>
          <h1 className="text-3xl font-bold heading-font uppercase tracking-tight text-black">
            Partner Login
          </h1>
          <p className="mt-3 text-black/40 text-sm">
            Access your affiliate dashboard to track earnings and referrals.
          </p>
        </div>

        {/* Form */}
        <form className="space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-[12px] text-red-600 font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-black/40 uppercase tracking-widest px-1">
              Email Address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partner@example.com"
              className="block w-full px-4 py-4 bg-gray-50 border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-black outline-none transition-all"
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <div className="flex justify-between px-1">
              <label className="text-[10px] font-bold text-black/40 uppercase tracking-widest">
                Password
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full px-4 py-4 pr-12 bg-gray-50 border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-black outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-black/30 hover:text-black transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-[0.2em] hover:bg-black/90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Footer links */}
          <div className="text-center pt-2 space-y-3">
            <p className="text-xs text-black/40">
              Not a partner yet?{" "}
              <Link
                href="/become-affiliate"
                className="text-black font-bold hover:underline underline-offset-4"
              >
                Apply to join
              </Link>
            </p>
            <p className="text-xs text-black/30">
              <Link href="/" className="hover:text-black transition-colors">
                ← Back to store
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
