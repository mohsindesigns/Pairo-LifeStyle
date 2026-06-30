import AffiliateLoginClient from "@/components/affiliate/AffiliateLoginClient";
import Link from "next/link";
import { ChevronLeft, TrendingUp, Users, DollarSign, BarChart2 } from "lucide-react";

export const metadata = {
  title: "Partner Portal — PAIRO Lifestyle",
  description: "Access your PAIRO affiliate dashboard. View referrals, conversions, commissions, and manage your partner account.",
  robots: { index: false, follow: false }
};

const stats = [
  { icon: Users, label: "Active Partners", value: "200+" },
  { icon: TrendingUp, label: "Avg. Conversion", value: "4.8%" },
  { icon: DollarSign, label: "Commissions Paid", value: "AED 120K+" },
  { icon: BarChart2, label: "Referral Orders", value: "3,000+" },
];

export default function AffiliateLoginPage() {
  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", display: "flex",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }}>
      {/* Left Panel — Brand */}
      <div style={{
        display: "none",
        flex: "0 0 45%",
        background: "linear-gradient(160deg, #111 0%, #0a0a0a 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        padding: "60px 56px",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden"
      }}
        className="left-panel"
      >
        {/* Decorative gradient orb */}
        <div style={{
          position: "absolute", top: "-80px", right: "-80px",
          width: "360px", height: "360px",
          background: "radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)",
          borderRadius: "50%"
        }} />
        <div style={{
          position: "absolute", bottom: "-60px", left: "-60px",
          width: "280px", height: "280px",
          background: "radial-gradient(circle, rgba(212,175,55,0.05) 0%, transparent 70%)",
          borderRadius: "50%"
        }} />

        {/* Logo */}
        <div>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <ChevronLeft size={14} color="rgba(255,255,255,0.35)" />
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "2px", textTransform: "uppercase" }}>Back to Store</span>
          </Link>
          <div style={{ marginTop: "48px" }}>
            <h1 style={{ fontSize: "14px", letterSpacing: "8px", color: "#d4af37", textTransform: "uppercase", fontWeight: 800, margin: "0 0 4px" }}>
              PAIRO
            </h1>
            <p style={{ fontSize: "10px", letterSpacing: "3px", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", margin: 0 }}>
              Partner Programme
            </p>
          </div>
        </div>

        {/* Headline */}
        <div>
          <h2 style={{ fontSize: "38px", fontWeight: 300, color: "#fff", lineHeight: 1.2, margin: "0 0 20px", letterSpacing: "-0.5px" }}>
            Earn while<br />
            <span style={{ fontWeight: 700, color: "#d4af37" }}>curating style</span>
          </h2>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", lineHeight: 1.8, margin: "0 0 40px", maxWidth: "340px" }}>
            Join PAIRO's partner programme and earn commissions on every successful referral. Real-time analytics, instant payouts, and dedicated support.
          </p>

          {/* Stats Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {stats.map(({ icon: Icon, label, value }) => (
              <div key={label} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "10px", padding: "16px"
              }}>
                <Icon size={16} color="#d4af37" style={{ marginBottom: "8px" }} />
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff", lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "4px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", letterSpacing: "1px" }}>
          © {new Date().getFullYear()} PAIRO Excellence — Artisanal Heritage
        </p>
      </div>

      {/* Right Panel — Form */}
      <div style={{
        flex: 1,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 24px",
        position: "relative"
      }}>
        {/* Subtle background texture */}
        <div style={{
          position: "fixed", inset: 0, pointerEvents: "none",
          backgroundImage: `radial-gradient(ellipse at 80% 30%, rgba(212,175,55,0.04) 0%, transparent 60%)`
        }} />

        {/* Mobile back link (hidden on desktop via left-panel) */}
        <div style={{ position: "absolute", top: "24px", left: "24px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "6px", textDecoration: "none", color: "rgba(255,255,255,0.3)", fontSize: "12px", letterSpacing: "1px" }}>
            <ChevronLeft size={14} />
            Store
          </Link>
        </div>

        <div style={{ width: "100%", maxWidth: "420px" }}>
          {/* Brand (right side — shown on mobile) */}
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: "48px", height: "48px",
              background: "linear-gradient(135deg, #d4af37, #f5d97e)",
              borderRadius: "12px", marginBottom: "16px",
              boxShadow: "0 0 32px rgba(212,175,55,0.25)"
            }}>
              <span style={{ fontSize: "18px", fontWeight: 900, color: "#0a0a0a", letterSpacing: "1px" }}>P</span>
            </div>
            <div style={{ fontSize: "12px", letterSpacing: "6px", color: "#d4af37", textTransform: "uppercase", fontWeight: 800, marginBottom: "4px" }}>
              PAIRO
            </div>
            <div style={{ fontSize: "10px", letterSpacing: "3px", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>
              Partner Portal
            </div>
          </div>

          {/* Form Card */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            padding: "40px 36px",
            boxShadow: "0 32px 64px rgba(0,0,0,0.4)"
          }}>
            <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>
              Welcome back
            </h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", margin: "0 0 28px", lineHeight: 1.6 }}>
              Sign in to access your partner dashboard.
            </p>

            <AffiliateLoginClient />
          </div>

          {/* Sign up prompt */}
          <p style={{ textAlign: "center", marginTop: "24px", fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>
            Not a partner yet?{" "}
            <Link href="/become-affiliate" style={{ color: "#d4af37", textDecoration: "none", fontWeight: 600 }}>
              Apply now
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .left-panel { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
