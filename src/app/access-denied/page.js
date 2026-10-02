import Link from "next/link";
import { ShieldAlert, ArrowLeft, Lock } from "lucide-react";
import SecurityShield from "@/components/common/SecurityShield";

export const metadata = {
  title: "Access Restricted | Pairo Lifestyle",
  description: "Developer tools and page inspection are disabled for security reasons.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-center items-center px-4 py-16 selection:bg-none">
      <SecurityShield />

      <div className="max-w-md w-full bg-neutral-900/90 border border-neutral-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md text-center relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Shield Icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 mb-4">
          <Lock className="w-3.5 h-3.5" />
          <span>Security Protocol Active</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-3">
          Inspection & Developer Tools Disabled
        </h1>

        <p className="text-sm text-neutral-400 leading-relaxed mb-6">
          To protect proprietary designs, handcrafted jacket specifications, and site security,
          browser developer tools, element inspection, and right-click actions are strictly prohibited on this website.
        </p>

        <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-xl p-4 text-xs text-neutral-400 mb-8 text-left space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Security Rule:</span>
            <span className="font-mono text-neutral-300">SEC-ANTI-INSPECT-01</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Detected Trigger:</span>
            <span className="font-mono text-red-400">DevTools / Keyboard Shortcut</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Action:</span>
            <span className="font-mono text-neutral-300">URL Redirect & Session Lock</span>
          </div>
        </div>

        <div className="space-y-3">
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-black font-medium text-sm hover:bg-neutral-200 transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Close Developer Tools & Return Home</span>
          </Link>
          <p className="text-[11px] text-neutral-500">
            Please close your developer tools or inspection window before returning.
          </p>
        </div>
      </div>
    </div>
  );
}
