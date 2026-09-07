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

  // Callers pass onVerify/onExpire/onError as inline functions, which get a new
  // identity on every parent re-render (e.g. typing into any other field in the
  // same form). Stashing the latest versions in refs — read from inside the
  // widget-render effect below — keeps that effect from re-running on every
  // keystroke and tearing down/rebuilding the Cloudflare challenge mid-verification.
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;
  onErrorRef.current = onError;

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
          onVerifyRef.current?.(token);
        },
        "expired-callback": () => {
          if (onExpireRef.current) onExpireRef.current();
          else onVerifyRef.current?.("");
        },
        "error-callback": (err) => {
          console.error("[Turnstile] Widget error:", err);
          onErrorRef.current?.(err);
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
  }, [scriptLoaded, siteKey, theme, size]);

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
