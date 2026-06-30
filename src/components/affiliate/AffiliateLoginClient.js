"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import Link from "next/link";

const GOLD = "#d4af37";
const GOLD_LIGHT = "#f5d97e";

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
        redirect: false
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

  const inputBase = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px", color: "#fff",
    fontSize: "14px", outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: "inherit",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {error && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: "10px",
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: "8px", padding: "12px 14px"
        }}>
          <AlertCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: "1px" }} />
          <p style={{ margin: 0, fontSize: "13px", color: "#f87171", lineHeight: 1.5 }}>{error}</p>
        </div>
      )}

      {/* Email */}
      <div>
        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>
          Email Address
        </label>
        <div style={{ position: "relative" }}>
          <Mail size={15} color="rgba(255,255,255,0.25)" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={{ ...inputBase, padding: "12px 14px 12px 42px" }}
            onFocus={e => { e.target.style.borderColor = "rgba(212,175,55,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(212,175,55,0.08)"; }}
            onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: "1px", textTransform: "uppercase" }}>
            Password
          </label>
          <Link href="/affiliate/forgot-password" style={{ fontSize: "11px", color: "rgba(212,175,55,0.7)", textDecoration: "none", letterSpacing: "0.5px", transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = GOLD}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(212,175,55,0.7)"}
          >
            Forgot password?
          </Link>
        </div>
        <div style={{ position: "relative" }}>
          <Lock size={15} color="rgba(255,255,255,0.25)" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{ ...inputBase, padding: "12px 44px 12px 42px" }}
            onFocus={e => { e.target.style.borderColor = "rgba(212,175,55,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(212,175,55,0.08)"; }}
            onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword
              ? <EyeOff size={15} color="rgba(255,255,255,0.35)" />
              : <Eye size={15} color="rgba(255,255,255,0.35)" />
            }
          </button>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%", marginTop: "4px",
          background: loading ? "rgba(212,175,55,0.35)" : `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
          border: "none", borderRadius: "8px",
          color: "#0a0a0a", fontWeight: 800,
          fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase",
          padding: "14px 20px",
          cursor: loading ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          transition: "opacity 0.2s, transform 0.15s",
          boxShadow: loading ? "none" : "0 4px 16px rgba(212,175,55,0.25)"
        }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
      >
        {loading
          ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Authenticating...</>
          : <>Access Dashboard <ArrowRight size={14} /></>
        }
      </button>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </form>
  );
}
