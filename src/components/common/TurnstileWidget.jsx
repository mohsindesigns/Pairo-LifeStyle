"use client";

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { ShieldCheck, RotateCw } from "lucide-react";

// Official Cloudflare Dummy Test Sitekey (Always passes for testing / local dev)
const TEST_SITE_KEY = "1x00000000000000000000AA";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_SELECTOR = 'script[src*="challenges.cloudflare.com/turnstile"]';
// If window.turnstile has not appeared this long after the script was requested, treat the load as failed
// (typically an ad blocker / privacy extension / network filter blocking challenges.cloudflare.com).
const LOAD_TIMEOUT_MS = 10000;
const LOAD_FAILED_MESSAGE = "Security check could not load. Disable your ad blocker or try another browser.";

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
  const [loadFailed, setLoadFailed] = useState(false);
  const [widgetError, setWidgetError] = useState(false);
  const [attempt, setAttempt] = useState(0);
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

  // Step 1: Ensure Cloudflare Turnstile script is loaded (and notice when it cannot be, e.g. blocked by an ad blocker)
  useEffect(() => {
    if (typeof window === "undefined") return;

    let script = document.querySelector(SCRIPT_SELECTOR);
    if (!window.turnstile && !script) {
      script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const startedAt = Date.now();
    let checkInterval = null;
    const stop = () => {
      if (checkInterval) clearInterval(checkInterval);
      checkInterval = null;
    };
    const onScriptError = () => {
      stop();
      setLoadFailed(true);
    };
    if (script) script.addEventListener("error", onScriptError);

    checkInterval = setInterval(() => {
      if (window.turnstile) {
        stop();
        setLoadFailed(false);
        setScriptLoaded(true);
      } else if (Date.now() - startedAt > LOAD_TIMEOUT_MS) {
        stop();
        setLoadFailed(true);
      }
    }, 100);

    return () => {
      stop();
      if (script) script.removeEventListener("error", onScriptError);
    };
  }, [attempt]);

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
          setWidgetError(false);
          onVerifyRef.current?.(token);
        },
        "expired-callback": () => {
          if (onExpireRef.current) onExpireRef.current();
          else onVerifyRef.current?.("");
        },
        "error-callback": (err) => {
          console.error("[Turnstile] Widget error:", err);
          setWidgetError(true);
          onErrorRef.current?.(err);
        },
        "timeout-callback": () => {
          // The challenge timed out before it was solved; the token (if any) is no longer usable.
          if (onExpireRef.current) onExpireRef.current();
          else onVerifyRef.current?.("");
        },
        "unsupported-callback": () => {
          setWidgetError(true);
          onErrorRef.current?.("unsupported");
        }
      });
      widgetIdRef.current = widgetId;
    } catch (err) {
      console.error("[Turnstile] Render error:", err);
      Promise.resolve().then(() => {
        setWidgetError(true);
        onErrorRef.current?.(err);
      });
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

  const handleRetry = () => {
    if (typeof window === "undefined") return;
    setWidgetError(false);
    onExpireRef.current?.();
    if (window.turnstile && widgetIdRef.current !== null && !loadFailed) {
      try {
        window.turnstile.reset(widgetIdRef.current);
        return;
      } catch (e) {
        console.warn("[Turnstile] Failed to reset widget:", e);
      }
    }
    // The script itself never arrived: drop the dead tag(s) so a fresh request is made, then wait again.
    document.querySelectorAll(SCRIPT_SELECTOR).forEach((el) => {
      if (!window.turnstile) el.remove();
    });
    setLoadFailed(false);
    setAttempt((n) => n + 1);
  };

  const showFailure = loadFailed || widgetError;

  return (
    <div className={`my-3 flex flex-col items-center justify-center ${className}`}>
      <div ref={containerRef} className={showFailure ? "flex items-center justify-center" : "min-h-[65px] flex items-center justify-center"} />
      {showFailure && (
        <div role="alert" className="w-full flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 border border-red-200 bg-red-50 rounded-[4px] px-3 py-2.5">
          <p className="flex-1 text-xs text-red-700 font-semibold leading-snug">{LOAD_FAILED_MESSAGE}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="shrink-0 inline-flex items-center gap-1.5 min-h-[32px] px-3 rounded-[4px] border border-red-300 bg-white text-xs font-bold uppercase tracking-wider text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}
      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-neutral-400 font-medium tracking-wide select-none">
        <ShieldCheck className="w-3 h-3 text-neutral-400" />
        <span>Protected by Cloudflare Turnstile</span>
      </div>
    </div>
  );
});

export default TurnstileWidget;
