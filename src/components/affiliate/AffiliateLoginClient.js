"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

export default function AffiliateLoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        loginType: "affiliate",
        redirect: false
      });

      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Welcome back!");
        window.location.replace("/affiliate/dashboard");
      }
    } catch (err) {
      toast.error("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Email Address</label>
        <input 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="your@email.com"
          className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
        />
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Password</label>
          <a href="#" className="text-[9px] text-primary/50 uppercase tracking-wider hover:text-black">Forgot?</a>
        </div>
        <input 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
          className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
        />
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="w-full py-3 rounded-lg bg-black text-white text-[11px] uppercase tracking-wider font-bold hover:bg-black/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-white/20 border-t-white rounded-full" />
            Signing in...
          </>
        ) : (
          "Login to Portal"
        )}
      </button>

      <div className="text-center pt-2">
        <p className="text-[10px] text-primary/50 font-light">
          Want to become an affiliate?{" "}
          <a href="/become-an-affiliate" className="font-semibold text-black underline uppercase tracking-wider">
            Apply Now
          </a>
        </p>
      </div>
    </form>
  );
}
