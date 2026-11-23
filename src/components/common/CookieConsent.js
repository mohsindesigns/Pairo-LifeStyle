"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Cookie, X, Shield } from "lucide-react";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  // Shopper-facing only: never cover the admin or the admin login.
  const pathname = usePathname() || "";
  const isAdminArea = pathname.startsWith("/admin");

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem("pairo_cookie_consent");
    if (!consent) {
      // Small delay for natural slide-in feeling
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("pairo_cookie_consent", "accepted");
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("pairo_cookie_consent", "declined");
    setIsVisible(false);
  };

  if (!isVisible || isAdminArea) return null;

  return (
    <div className="fixed bottom-6 right-6 left-6 md:left-auto md:max-w-md z-[9999] animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="bg-white border border-black/10 rounded-[4px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.15)] text-black font-sans flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[4px] bg-neutral-100 flex items-center justify-center text-black border border-neutral-200 shadow-inner">
              <Cookie className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-[13px] font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
                Cookie Settings <Shield className="w-4 h-4 text-black" />
              </h4>
              <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Privacy Consent</p>
            </div>
          </div>
          <button 
            onClick={handleDecline}
            className="text-neutral-400 hover:text-black transition-colors p-1 hover:bg-neutral-100 rounded-[4px]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <p className="text-[12px] text-neutral-600 leading-relaxed font-medium">
          We use cookies to improve your browsing experience, serve personalized ads or content, and analyze our traffic. By clicking <span className="font-bold text-black">"Accept All"</span>, you consent to our use of cookies.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handleDecline}
            className="px-4 py-2.5 rounded-[4px] text-[11px] font-bold uppercase tracking-wider text-neutral-500 hover:text-black border border-neutral-300 hover:bg-neutral-50 transition-all duration-200"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-5 py-2.5 rounded-[4px] text-[11px] font-bold uppercase tracking-wider bg-black text-white hover:bg-neutral-900 active:scale-[0.98] transition-all duration-200 shadow-sm"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
