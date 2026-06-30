"use client";
import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function AffiliateForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/affiliate/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }}>
      {/* Background texture */}
      <div style={{
        position: "fixed", inset: 0,
        backgroundImage: `radial-gradient(ellipse at 20% 50%, rgba(212,175,55,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(212,175,55,0.03) 0%, transparent 50%)`,
        pointerEvents: "none"
      }} />

      <div style={{
        position: "relative", width: "100%", maxWidth: "440px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "16px",
        padding: "48px 40px",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5)"
      }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "48px", height: "48px",
            background: "linear-gradient(135deg, #d4af37, #f5d97e)",
            borderRadius: "12px",
            marginBottom: "16px",
            boxShadow: "0 0 24px rgba(212,175,55,0.3)"
          }}>
            <Mail size={22} color="#0a0a0a" />
          </div>
          <div style={{ letterSpacing: "6px", fontSize: "13px", fontWeight: 800, color: "#d4af37", textTransform: "uppercase", marginBottom: "6px" }}>
            PAIRO
          </div>
          <div style={{ fontSize: "10px", letterSpacing: "3px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
            Partner Portal
          </div>
        </div>

        {success ? (
          <div style={{ textAlign: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: "64px", height: "64px",
              background: "rgba(34,197,94,0.1)",
              borderRadius: "50%", marginBottom: "20px"
            }}>
              <CheckCircle size={32} color="#22c55e" />
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "0 0 10px" }}>
              Check Your Email
            </h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: "0 0 28px" }}>
              If an account exists for <strong style={{ color: "rgba(255,255,255,0.7)" }}>{email}</strong>, you&apos;ll receive a password reset link within a few minutes.
            </p>
            <Link href="/affiliate/login" style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              color: "#d4af37", fontSize: "13px", fontWeight: 600, textDecoration: "none",
              letterSpacing: "0.5px"
            }}>
              <ArrowLeft size={14} />
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 8px", textAlign: "center" }}>
              Forgot Password?
            </h1>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", textAlign: "center", margin: "0 0 32px", lineHeight: 1.6 }}>
              Enter your email and we&apos;ll send you a secure reset link.
            </p>

            {error && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: "10px",
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "8px", padding: "12px 14px", marginBottom: "20px"
              }}>
                <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: "1px" }} />
                <p style={{ margin: 0, fontSize: "13px", color: "#f87171", lineHeight: 1.5 }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>
                  Email Address
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={16} color="rgba(255,255,255,0.25)" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px", color: "#fff",
                      padding: "12px 14px 12px 42px",
                      fontSize: "14px", outline: "none",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={e => e.target.style.borderColor = "rgba(212,175,55,0.5)"}
                    onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  background: loading ? "rgba(212,175,55,0.4)" : "linear-gradient(135deg, #d4af37, #f5d97e)",
                  border: "none", borderRadius: "8px",
                  color: "#0a0a0a", fontWeight: 700,
                  fontSize: "13px", letterSpacing: "1.5px", textTransform: "uppercase",
                  padding: "14px", cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  transition: "opacity 0.2s"
                }}
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : "Send Reset Link"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: "28px" }}>
              <Link href="/affiliate/login" style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                color: "rgba(255,255,255,0.4)", fontSize: "13px", textDecoration: "none",
                transition: "color 0.2s"
              }}
                onMouseEnter={e => e.currentTarget.style.color = "#d4af37"}
                onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
              >
                <ArrowLeft size={13} />
                Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
