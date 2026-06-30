"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, ShieldCheck } from "lucide-react";

export default function AffiliateResetPasswordClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  useEffect(() => {
    if (!token || !email) {
      setError("Invalid reset link. Please request a new password reset.");
    }
  }, [token, email]);

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColors = ["transparent", "#ef4444", "#f59e0b", "#22c55e"];
  const strengthLabels = ["", "Weak", "Moderate", "Strong"];

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/affiliate/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => router.push("/affiliate/login"), 3000);
      } else {
        setError(data.error || "Failed to reset password. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px", color: "#fff",
    padding: "12px 42px 12px 42px",
    fontSize: "14px", outline: "none",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }}>
      <div style={{
        position: "fixed", inset: 0,
        backgroundImage: `radial-gradient(ellipse at 20% 50%, rgba(212,175,55,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(212,175,55,0.03) 0%, transparent 50%)`,
        pointerEvents: "none"
      }} />

      <div style={{
        position: "relative", width: "100%", maxWidth: "440px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "16px", padding: "48px 40px",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5)"
      }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "48px", height: "48px",
            background: "linear-gradient(135deg, #d4af37, #f5d97e)",
            borderRadius: "12px", marginBottom: "16px",
            boxShadow: "0 0 24px rgba(212,175,55,0.3)"
          }}>
            <ShieldCheck size={22} color="#0a0a0a" />
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
              background: "rgba(34,197,94,0.1)", borderRadius: "50%", marginBottom: "20px"
            }}>
              <CheckCircle size={32} color="#22c55e" />
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "0 0 10px" }}>Password Updated!</h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: "0 0 6px" }}>
              Your password has been changed successfully.
            </p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>Redirecting to login in 3 seconds…</p>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 8px", textAlign: "center" }}>
              Create New Password
            </h1>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", textAlign: "center", margin: "0 0 28px", lineHeight: 1.6 }}>
              {email ? `Resetting password for ${email}` : "Set a secure new password."}
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

            {(!token || !email) && !error ? null : (
              <form onSubmit={handleSubmit}>
                {/* New Password */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>
                    New Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <Lock size={16} color="rgba(255,255,255,0.25)" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = "rgba(212,175,55,0.5)"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                      position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex"
                    }}>
                      {showPassword ? <EyeOff size={16} color="rgba(255,255,255,0.35)" /> : <Eye size={16} color="rgba(255,255,255,0.35)" />}
                    </button>
                  </div>

                  {/* Strength indicator */}
                  {password && (
                    <div style={{ marginTop: "8px" }}>
                      <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                        {[1, 2, 3].map(i => (
                          <div key={i} style={{
                            flex: 1, height: "3px", borderRadius: "2px",
                            background: strength >= i ? strengthColors[strength] : "rgba(255,255,255,0.08)",
                            transition: "background 0.3s"
                          }} />
                        ))}
                      </div>
                      <span style={{ fontSize: "11px", color: strengthColors[strength] }}>{strengthLabels[strength]}</span>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>
                    Confirm Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <Lock size={16} color="rgba(255,255,255,0.25)" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Repeat your password"
                      required
                      style={{
                        ...inputStyle,
                        borderColor: confirm && password !== confirm ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"
                      }}
                      onFocus={e => e.target.style.borderColor = "rgba(212,175,55,0.5)"}
                      onBlur={e => e.target.style.borderColor = confirm && password !== confirm ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"}
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{
                      position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex"
                    }}>
                      {showConfirm ? <EyeOff size={16} color="rgba(255,255,255,0.35)" /> : <Eye size={16} color="rgba(255,255,255,0.35)" />}
                    </button>
                  </div>
                  {confirm && password !== confirm && (
                    <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#ef4444" }}>Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !token || !email}
                  style={{
                    width: "100%",
                    background: loading ? "rgba(212,175,55,0.4)" : "linear-gradient(135deg, #d4af37, #f5d97e)",
                    border: "none", borderRadius: "8px",
                    color: "#0a0a0a", fontWeight: 700, fontSize: "13px",
                    letterSpacing: "1.5px", textTransform: "uppercase",
                    padding: "14px", cursor: loading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                  }}
                >
                  {loading ? <><Loader2 size={16} /> Updating...</> : "Update Password"}
                </button>
              </form>
            )}

            <div style={{ textAlign: "center", marginTop: "24px" }}>
              <Link href="/affiliate/login" style={{
                fontSize: "13px", color: "rgba(255,255,255,0.35)", textDecoration: "none"
              }}>Back to Login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
