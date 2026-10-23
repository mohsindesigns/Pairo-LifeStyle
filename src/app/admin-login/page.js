"use client";

import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lock, User, Eye, EyeOff, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import logo from "@/assets/png-file.png";
import TurnstileWidget from "@/components/common/TurnstileWidget";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!turnstileToken) {
      setError("Please complete the security check.");
      return;
    }

    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        loginType: "staff",
        turnstileToken,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid credentials or security check failed. Please check your admin access.");
        turnstileRef.current?.reset();
        setTurnstileToken("");
      } else {
        // Wait for the session cookie to be fully established before navigating.
        const { getSession } = await import("next-auth/react");
        let attempts = 0;
        let session = null;
        while (attempts < 10) {
          session = await getSession();
          if (session?.user?.isStaff) break;
          await new Promise((r) => setTimeout(r, 300));
          attempts++;
        }
        if (session?.user?.isStaff) {
          window.location.replace("/admin");
        } else {
          setError("Session could not be established. Please try again.");
          turnstileRef.current?.reset();
          setTurnstileToken("");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred.");
      turnstileRef.current?.reset();
      setTurnstileToken("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f0f1] flex flex-col items-center justify-start sm:justify-center px-4 pt-[8vh] pb-10 sm:py-10 font-sans text-[#3c434a] text-[13px]">
      <div className="w-full max-w-[320px]">
        {/* Brand */}
        <h1 className="m-0 mb-6 text-center">
          <Link
            href="/"
            className="inline-flex flex-col items-center gap-2 text-[#1d2327] no-underline focus:outline-none focus-visible:shadow-[0_0_0_2px_#2271b1] rounded-[2px]"
          >
            <span className="flex items-center justify-center w-[84px] h-[84px] rounded-full bg-white border border-[#dcdcde] p-3">
              <Image src={logo} alt="Pairo Logo" width={110} height={40} className="object-contain w-full h-full" priority />
            </span>
            <span className="text-[20px] font-normal leading-tight">Pairo Lifestyle</span>
          </Link>
        </h1>

        {error && (
          <div
            role="alert"
            className="mb-5 bg-white border-l-4 border-[#d63638] px-3 py-3 shadow-[0_1px_1px_rgba(0,0,0,0.04)]"
          >
            <p className="m-0 text-[13px] leading-[1.5] text-[#1d2327]">
              <strong className="font-semibold">Error:</strong> {error}
            </p>
          </div>
        )}

        {/* Login form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-[#c3c4c7] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6"
        >
          <div className="mb-4">
            <label htmlFor="admin-login-email" className="block mb-[3px] text-[14px] leading-[1.5] text-[#1d2327]">
              Username or Email Address
            </label>
            <input
              id="admin-login-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-2 text-[16px] sm:text-[18px] text-[#2c3338] bg-white border border-[#8c8f94] rounded-[4px] outline-none focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1]"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="admin-login-password" className="block mb-[3px] text-[14px] leading-[1.5] text-[#1d2327]">
              Password
            </label>
            <div className="relative">
              <input
                id="admin-login-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 pl-2 pr-11 text-[16px] sm:text-[18px] text-[#2c3338] bg-white border border-[#8c8f94] rounded-[4px] outline-none focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-0 top-0 h-10 w-10 inline-flex items-center justify-center text-[#2271b1] hover:text-[#135e96] bg-transparent border-0 cursor-pointer rounded-[4px] focus:outline-none focus-visible:shadow-[0_0_0_2px_#2271b1]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="mb-4">
            <TurnstileWidget
              ref={turnstileRef}
              theme="light"
              onVerify={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken("")}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <label htmlFor="remember" className="inline-flex items-center gap-2 min-h-10 cursor-pointer select-none text-[13px] text-[#3c434a]">
              <input
                type="checkbox"
                id="remember"
                className="w-4 h-4 m-0 accent-[#2271b1] border-[#8c8f94] rounded-[4px] focus:outline-none focus-visible:shadow-[0_0_0_2px_#2271b1]"
              />
              Remember Me
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center min-h-10 sm:min-h-8 px-3 text-[13px] leading-none text-white bg-[#2271b1] hover:bg-[#135e96] border border-[#2271b1] hover:border-[#135e96] rounded-[3px] cursor-pointer disabled:opacity-60 disabled:cursor-default focus:outline-none focus-visible:shadow-[0_0_0_1px_#fff,0_0_0_3px_#2271b1]"
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
          </div>
        </form>

        {/* Footer links */}
        <p className="mt-6 mb-0 px-6 text-[13px]">
          <Link href="/forgot-password" title="Lost your password?" className="text-[#50575e] hover:text-[#135e96] no-underline hover:underline">
            Lost your password?
          </Link>
        </p>
        <p className="mt-4 mb-0 px-6 text-[13px]">
          <Link href="/" className="inline-flex items-center gap-1 text-[#50575e] hover:text-[#135e96] no-underline hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to store
          </Link>
        </p>
      </div>
    </div>
  );
}
