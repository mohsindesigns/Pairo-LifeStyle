"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lock, User, Eye, EyeOff, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import logo from "@/assets/png-file.png";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid credentials. Please check your admin access.");
      } else {
        // Wait for the session cookie to be fully established before navigating.
        // router.push("/admin") without waiting causes the middleware to see no token
        // and bounce back to /admin-login (race condition).
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
        }
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f0f1] flex flex-col items-center justify-center p-4 font-sans select-none">
      <div className="w-full max-w-[320px] space-y-4">
        {/* WP-style Logo Header */}
        <div className="text-center mb-4">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <div className="w-28 h-16 bg-white rounded-xl flex items-center justify-center mx-auto shadow-md border border-[#c3c4c7] px-3 py-2">
              <Image src={logo} alt="Pairo Logo" width={110} height={40} className="object-contain w-full h-full" priority />
            </div>
          </Link>
        </div>

        {/* Login Box */}
        <div className="bg-white border border-[#c3c4c7] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 rounded-[3px]">
          {error && (
            <div className="mb-4 p-3 bg-white border-l-4 border-[#d63638] shadow-[0_1px_1px_0_rgba(0,0,0,0.1)] animate-in fade-in slide-in-from-left-2">
              <p className="text-[12px] text-[#1d2327] leading-relaxed">
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[14px] text-[#3c434a] font-normal block">Username or Email Address</label>
              <input 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-[#8c8f94] focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] outline-none px-3 py-2 text-[18px] bg-white transition-all rounded-[4px] shadow-sm font-light text-[#2c3338]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[14px] text-[#3c434a] font-normal block">Password</label>
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-[#2271b1] hover:text-[#135e96] font-medium"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input 
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[#8c8f94] focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] outline-none px-3 py-2 text-[18px] bg-white transition-all rounded-[4px] shadow-sm font-light text-[#2c3338]"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[13px] text-[#3c434a] font-normal">
                <input 
                  type="checkbox" 
                  id="remember" 
                  className="w-4 h-4 border-[#8c8f94] rounded-[4px] text-[#2271b1] focus:ring-[#2271b1] focus:ring-offset-0 focus:ring-1 focus:outline-none transition-all" 
                />
                Remember Me
              </label>

              <button 
                type="submit" 
                disabled={loading}
                className="bg-[#2271b1] hover:bg-[#135e96] border border-[#135e96] text-white px-3 py-1.5 rounded-[3px] text-[13px] font-bold shadow-[0_1px_0_#135e96] hover:shadow-[0_1px_0_#135e96] active:translate-y-[1px] active:shadow-none transition-all disabled:opacity-50 inline-flex items-center justify-center min-h-[30px]"
              >
                {loading ? "Logging in..." : "Log In"}
              </button>
            </div>
          </form>
        </div>

        {/* Footer Links */}
        <div className="flex flex-col items-start gap-2 px-1 py-1">
          <Link href="/forgot-password" title="Lost your password?" className="text-[12px] text-[#2271b1] hover:text-[#135e96]">Lost your password?</Link>
          <Link href="/" className="text-[12px] text-[#2271b1] hover:text-[#135e96] flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Go to Pairo Store
          </Link>
        </div>
      </div>
    </div>
  );
}
