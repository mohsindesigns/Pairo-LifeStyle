"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import { useSiteData } from "@/context/SiteContext";

const SESSION_DISMISSED_KEY = "pairo_site_popup_dismissed";
const DAILY_DISMISSED_KEY = "pairo_site_popup_daily_ts";

export default function SitePopup() {
  const pathname = usePathname();
  const siteData = useSiteData();
  const popup = siteData?.popup;

  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  const dismissTimerRef = useRef(null);
  const showTimerRef = useRef(null);
  const rafRef1 = useRef(null);
  const rafRef2 = useRef(null);
  const isDismissingRef = useRef(false);

  const isEnabled = Boolean(popup?.enabled);

  // Safe string coercion to prevent fatal TypeError (.trim is not a function)
  const bannerUrl = String(popup?.bannerUrl || "").trim();
  const badgeText = String(popup?.badgeText || "").trim();
  const title = String(popup?.title || "").trim();
  const description = String(popup?.description || "").trim();
  const buttonLabel = String(popup?.buttonLabel || "").trim();
  const rawButtonLink = String(popup?.buttonLink || "").trim();
  const openInNewTab = Boolean(popup?.openInNewTab);
  const frequency = popup?.frequency || "session";

  const rawDelay = Number(popup?.delaySeconds);
  const delaySeconds = Number.isFinite(rawDelay) ? Math.max(0, rawDelay) : 1;

  // Resolve link safely: auto-prefix relative paths missing leading slash, prepend https to www.
  let resolvedLink = rawButtonLink;
  if (
    resolvedLink &&
    !resolvedLink.startsWith("http://") &&
    !resolvedLink.startsWith("https://") &&
    !resolvedLink.startsWith("//") &&
    !resolvedLink.startsWith("mailto:") &&
    !resolvedLink.startsWith("tel:") &&
    !resolvedLink.startsWith("#") &&
    !resolvedLink.startsWith("/")
  ) {
    if (resolvedLink.startsWith("www.")) {
      resolvedLink = `https://${resolvedLink}`;
    } else {
      resolvedLink = `/${resolvedLink}`;
    }
  }

  const isExternal =
    resolvedLink.startsWith("http://") ||
    resolvedLink.startsWith("https://") ||
    resolvedLink.startsWith("//") ||
    resolvedLink.startsWith("mailto:") ||
    resolvedLink.startsWith("tel:");

  const hasButton = Boolean(buttonLabel && resolvedLink);

  // Check if at least one content item is provided
  const hasContent = Boolean(
    bannerUrl || badgeText || title || description || hasButton
  );

  // Exclude transactional, checkout, and admin pages
  const isExcludedRoute =
    !pathname ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/admin-login") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/affiliate");

  const dismiss = useCallback(() => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    setAnimating(false);

    try {
      if (frequency === "session") {
        sessionStorage.setItem(SESSION_DISMISSED_KEY, "1");
      } else if (frequency === "daily") {
        localStorage.setItem(DAILY_DISMISSED_KEY, String(Date.now()));
      }
    } catch {
      // Storage unavailable (e.g. private browsing restrictions)
    }

    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setVisible(false);
      isDismissingRef.current = false;
    }, 300);
  }, [frequency]);

  // Main display scheduler effect
  useEffect(() => {
    if (!isEnabled || !hasContent || isExcludedRoute) {
      return;
    }

    // Check frequency dismissal
    try {
      if (frequency === "session") {
        const alreadyDismissed = sessionStorage.getItem(SESSION_DISMISSED_KEY);
        if (alreadyDismissed) return;
      } else if (frequency === "daily") {
        const dismissedAt = localStorage.getItem(DAILY_DISMISSED_KEY);
        if (dismissedAt) {
          const hoursPassed = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60);
          if (hoursPassed < 24) return;
        }
      }
    } catch {
      // Storage unavailable
    }

    // Delay timer before revealing popup
    const delayMs = Math.round(delaySeconds * 1000);
    showTimerRef.current = setTimeout(() => {
      setVisible(true);
      // Double rAF ensures browser commits initial opacity: 0 before triggering CSS transition
      rafRef1.current = requestAnimationFrame(() => {
        rafRef2.current = requestAnimationFrame(() => {
          setAnimating(true);
        });
      });
    }, delayMs);

    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (rafRef1.current) cancelAnimationFrame(rafRef1.current);
      if (rafRef2.current) cancelAnimationFrame(rafRef2.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [isEnabled, hasContent, frequency, delaySeconds, isExcludedRoute, visible]);

  // ESC key listener to dismiss
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        dismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, dismiss]);

  // Body scroll locking while modal is active
  useEffect(() => {
    if (visible && animating) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [visible, animating]);

  if (!visible || !isEnabled || !hasContent || isExcludedRoute) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        aria-hidden="true"
        className="fixed inset-0 z-[99990] bg-black/65 backdrop-blur-sm transition-opacity duration-300 cursor-pointer"
        style={{
          opacity: animating ? 1 : 0,
        }}
      />

      {/* Modal Dialog Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "site-popup-title" : undefined}
        className="fixed inset-0 z-[99991] flex items-center justify-center p-3 sm:p-4 pointer-events-none"
      >
        <div
          className={`pointer-events-auto relative w-full ${bannerUrl ? 'max-w-[720px]' : 'max-w-[440px]'} bg-white rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] border border-black/10 overflow-hidden flex flex-col ${bannerUrl ? 'sm:flex-row' : ''} max-h-[90vh]`}
          style={{
            opacity: animating ? 1 : 0,
            transform: animating ? "scale(1) translateY(0)" : "scale(0.95) translateY(12px)",
            transition: "opacity 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {/* Close button — anchored to the modal so it sits over the image on mobile and over the content column on desktop */}
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-3.5 right-3.5 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white transition-all cursor-pointer shadow-md"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Banner Image — left column on desktop, top on mobile */}
          {bannerUrl && (
            <div className="relative w-full sm:w-[45%] shrink-0 bg-neutral-100 aspect-[16/10] sm:aspect-auto overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bannerUrl}
                alt={title || "Announcement"}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Modal Content Body — right column on desktop, below on mobile */}
          <div className="p-5 sm:p-8 overflow-y-auto overscroll-contain flex-1 min-w-0 flex flex-col justify-center">
            {/* Badge (Conditional) */}
            {badgeText && (
              <div className="mb-3.5">
                <span className="inline-block px-3 py-1 rounded-full bg-black text-white text-[10px] font-bold tracking-[0.2em] uppercase max-w-full truncate">
                  {badgeText}
                </span>
              </div>
            )}

            {/* Title (Conditional) */}
            {title && (
              <h2
                id="site-popup-title"
                className="text-xl sm:text-2xl font-bold uppercase tracking-tight text-neutral-900 mb-2.5 leading-tight break-words"
              >
                {title}
              </h2>
            )}

            {/* Description (Conditional) */}
            {description && (
              <p className="text-sm text-neutral-600 leading-relaxed mb-6 whitespace-pre-line break-words">
                {description}
              </p>
            )}

            {/* Action Button (Conditional) */}
            {hasButton && (
              <div className="space-y-3 pt-1">
                {isExternal ? (
                  <a
                    href={resolvedLink}
                    target={openInNewTab ? "_blank" : "_self"}
                    rel={openInNewTab ? "noopener noreferrer" : undefined}
                    onClick={dismiss}
                    className="w-full h-12 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-[0.2em] hover:bg-neutral-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm px-4"
                  >
                    <span className="truncate">{buttonLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </a>
                ) : (
                  <Link
                    href={resolvedLink}
                    target={openInNewTab ? "_blank" : "_self"}
                    rel={openInNewTab ? "noopener noreferrer" : undefined}
                    onClick={dismiss}
                    className="w-full h-12 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-[0.2em] hover:bg-neutral-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm px-4"
                  >
                    <span className="truncate">{buttonLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </Link>
                )}

                <button
                  type="button"
                  onClick={dismiss}
                  className="w-full text-center text-xs text-neutral-400 hover:text-neutral-700 py-1 transition-colors cursor-pointer"
                >
                  Maybe later
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
