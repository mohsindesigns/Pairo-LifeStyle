"use client";

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { ShieldCheck, Lock } from "lucide-react";

// Official Cloudflare Dummy Test Sitekey (Always passes for testing / local dev)
const TEST_SITE_KEY = "1x00000000000000000000AA";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Cloudflare Turnstile CAPTCHA Widget
 * 
 * Props:
 * - onVerify: (token: string) => void [Required]
 * - onExpire: () => void [Optional]
 * - onError: (error?: any) => void [Optional]
 * - theme: "auto" | "light" | "dark" [Optional, default: "auto"]
 * - size: "normal" | "compact" | "flexible" [Optional, default: "normal"]
 * - className: string [Optional]
 */
const TurnstileWidget = forwardRef(function TurnstileWidget(
  {
    onVerify,
    onExpire,
    onError,
    theme = "auto",
    size = "normal",
    className = ""
  },
  ref
) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY || TEST_SITE_KEY;

  // Expose imperative methods to parent form (e.g. reset())
  useImperativeHandle(ref, () => ({
    reset: () => {
      if (typeof window !== "undefined" && window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch (e) {
          console.warn("[Turnstile] Failed to reset widget:", e);
        }
      }
    }
  }));

  // Step 1: Ensure Cloudflare Turnstile script is loaded
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.turnstile) {
      setScriptLoaded(true);
      return;
    }

    // Check if script element is already added to document
    let script = document.querySelector(`script[src*="challenges.cloudflare.com/turnstile"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const checkInterval = setInterval(() => {
      if (window.turnstile) {
        clearInterval(checkInterval);
        setScriptLoaded(true);
      }
    }, 100);

    return () => clearInterval(checkInterval);
  }, []);

  // Step 2: Render the Turnstile widget inside container
  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || typeof window === "undefined" || !window.turnstile) {
      return;
    }

    // Clear previous widget if any
    if (widgetIdRef.current !== null) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch (e) {
        // ignore
      }
      widgetIdRef.current = null;
    }

    try {
      const widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        size,
        callback: (token) => {
          if (onVerify) onVerify(token);
        },
        "expired-callback": () => {
          if (onExpire) onExpire();
          else if (onVerify) onVerify("");
        },
        "error-callback": (err) => {
          console.error("[Turnstile] Widget error:", err);
          if (onError) onError(err);
        }
      });
      widgetIdRef.current = widgetId;
    } catch (err) {
      console.error("[Turnstile] Render error:", err);
    }

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [scriptLoaded, siteKey, theme, size, onVerify, onExpire, onError]);

  return (
    <div className={`my-3 flex flex-col items-center justify-center ${className}`}>
      <div ref={containerRef} className="min-h-[65px] flex items-center justify-center" />
      <div className="flex items-center gap-1.5 mt-1 text-[9px] text-neutral-400 font-medium tracking-wide select-none">
        <ShieldCheck className="w-3 h-3 text-neutral-400" />
        <span>Protected by Cloudflare Turnstile</span>
      </div>
    </div>
  );
});

export default TurnstileWidget;
