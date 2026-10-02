"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Pairo Security Shield (Production Anti-Tamper & Content Protection)
 * 
 * ENVIRONMENT RULES:
 * - In Development (process.env.NODE_ENV === "development"):
 *   Completely disabled. DevTools, right-click, copying, screenshots, and inspection work normally.
 * 
 * - In Production (process.env.NODE_ENV === "production" or NEXT_PUBLIC_FORCE_SECURITY_SHIELD === "true"):
 *   Full lockdown:
 *   - Completely disables right-click context menu
 *   - Completely disables text copying, cutting, and selection across the storefront
 *   - Blocks screenshot keys (PrintScreen, Win+Shift+S, Cmd+Shift+3/4/5) & wipes clipboard
 *   - Blocks all DevTools shortcuts (F12, Ctrl+Shift+I/J/C/K/E, Ctrl+U, Ctrl+S, Ctrl+P)
 *   - Actively detects open DevTools (docked or undocked) and redirects URL to /access-denied
 *   - Runs anti-debugger loops and silences console logs
 *   - Storefront forms (inputs & textareas) remain fully functional for customer checkout
 */
export default function SecurityShield() {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_FORCE_SECURITY_SHIELD === "true";

  if (!isProduction) {
    return null;
  }

  return <SecurityShieldActive />;
}

function SecurityShieldActive() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    // Allow staff/admin routes to function normally without locking the admin panel
    const isAdminRoute = pathname?.startsWith("/admin") || pathname?.startsWith("/admin-login");
    if (isAdminRoute) {
      return;
    }

    const isAccessDeniedPage = pathname === "/access-denied";

    // Add production protection CSS class to body (disables text selection outside inputs)
    if (document.body) {
      document.body.classList.add("pairo-prod-shield");
    }

    // 1. Lockdown execution: Immediately cancel all network requests and redirect to /access-denied
    const triggerLockdown = () => {
      try {
        if (typeof window.stop === "function") {
          window.stop();
        }
      } catch (e) {}

      if (!isAccessDeniedPage) {
        try {
          if (document.documentElement) {
            document.documentElement.innerHTML = "";
          }
          window.location.replace("/access-denied");
        } catch (e) {
          window.location.href = "/access-denied";
        }
      }

      // Freeze execution if devtools is open
      try {
        (function freeze() {
          Function("debugger")();
        })();
      } catch (err) {}
    };

    // 2. Screenshot Protection Defense (Flashes obscure blur & wipes clipboard)
    const triggerScreenshotDefense = () => {
      try {
        if (navigator?.clipboard?.writeText) {
          navigator.clipboard.writeText("Content protected by Pairo Lifestyle.");
        }
      } catch (e) {}

      if (document.body) {
        document.body.classList.add("pairo-security-blur");
        setTimeout(() => {
          document.body?.classList.remove("pairo-security-blur");
        }, 1200);
      }
    };

    // 3. Disable Right-Click Context Menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    };

    // 4. Disable Content Dragging (Images, Media, Links)
    const handleDragStart = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // 5. Disable Copy & Cut
    const handleCopyCut = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      // Allow customers to copy/cut text inside form inputs & textareas
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) {
        return true;
      }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.clipboardData) {
        e.clipboardData.setData("text/plain", "Protected Content — Pairo Lifestyle");
      }
      return false;
    };

    // 6. Disable Text Selection outside form inputs
    const handleSelectStart = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) {
        return true;
      }
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // 7. Keyboard Interceptor (Shortcuts, DevTools, Screenshots, View Source)
    const handleKeyDown = (e) => {
      const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key ? e.key.toLowerCase() : "";
      const keyCode = e.keyCode || e.which;

      // Screenshot Keys: PrintScreen (Win/Linux)
      if (keyCode === 44 || key === "printscreen") {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotDefense();
        return false;
      }

      // Screenshot Keys: Win/Ctrl + Shift + S (Snipping Tool)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (key === "s" || keyCode === 83)) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotDefense();
        return false;
      }

      // Screenshot Keys: Mac Cmd + Shift + 3 / 4 / 5
      if (isMac && e.metaKey && e.shiftKey && ["3", "4", "5"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotDefense();
        return false;
      }

      // DevTools: F12 key
      if (keyCode === 123 || key === "f12") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        triggerLockdown();
        return false;
      }

      // DevTools: Ctrl/Cmd + Shift + (I, J, C, K, E, P)
      if (
        (isCtrlOrCmd && e.shiftKey && ["i", "j", "c", "k", "e", "p"].includes(key)) ||
        (isMac && e.metaKey && e.altKey && ["i", "j", "c"].includes(key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        triggerLockdown();
        return false;
      }

      // View Source: Ctrl/Cmd + U
      if ((isCtrlOrCmd && (key === "u" || keyCode === 85)) || (isMac && e.metaKey && e.altKey && key === "u")) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        triggerLockdown();
        return false;
      }

      // Save Page: Ctrl/Cmd + S
      if (isCtrlOrCmd && (key === "s" || keyCode === 83)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }

      // Print: Ctrl/Cmd + P
      if (isCtrlOrCmd && (key === "p" || keyCode === 80)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    };

    // PrintScreen KeyUp (Some browsers trigger PrintScreen on release)
    const handleKeyUp = (e) => {
      const key = e.key ? e.key.toLowerCase() : "";
      const keyCode = e.keyCode || e.which;
      if (keyCode === 44 || key === "printscreen") {
        triggerScreenshotDefense();
      }
    };

    // 8. Active DevTools Detection Heuristics
    // Heuristic A: Window Dimension Delta (Docked DevTools on bottom, right, or left)
    const checkDimensions = () => {
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;

      if (widthDiff > threshold || heightDiff > threshold) {
        triggerLockdown();
      }
    };

    // Heuristic B: Debugger timing threshold (Undocked or Docked DevTools)
    const checkDebuggerTiming = () => {
      try {
        const start = performance.now();
        Function("debugger")();
        const duration = performance.now() - start;
        if (duration > 100) {
          triggerLockdown();
        }
      } catch (e) {}
    };

    // Heuristic C: Console element getter evaluation (Triggers when Console tab is open)
    const checkConsoleGetter = () => {
      try {
        const detector = /./;
        detector.toString = function () {
          triggerLockdown();
          return "";
        };

        const img = new Image();
        Object.defineProperty(img, "id", {
          get: function () {
            triggerLockdown();
            return "";
          },
        });

        console.log("%c", detector);
        console.dir(img);
      } catch (e) {}
    };

    // 9. Silence console output in production storefront
    const silenceConsole = () => {
      try {
        const noop = () => {};
        ["log", "debug", "info", "warn", "error", "table", "dir", "trace"].forEach((method) => {
          if (window.console && typeof window.console[method] === "function") {
            window.console[method] = noop;
          }
        });
      } catch (e) {}
    };

    silenceConsole();

    // Attach listeners with capture: true to intercept before any other handlers
    window.addEventListener("contextmenu", handleContextMenu, { capture: true, passive: false });
    document.addEventListener("contextmenu", handleContextMenu, { capture: true, passive: false });

    window.addEventListener("dragstart", handleDragStart, { capture: true, passive: false });
    document.addEventListener("dragstart", handleDragStart, { capture: true, passive: false });

    document.addEventListener("copy", handleCopyCut, { capture: true, passive: false });
    document.addEventListener("cut", handleCopyCut, { capture: true, passive: false });
    document.addEventListener("selectstart", handleSelectStart, { capture: true, passive: false });

    window.addEventListener("keydown", handleKeyDown, { capture: true, passive: false });
    window.addEventListener("keyup", handleKeyUp, { capture: true, passive: false });
    window.addEventListener("resize", checkDimensions);

    // Initial check on mount
    checkDimensions();
    checkConsoleGetter();
    checkDebuggerTiming();

    // Polling interval for continuous background checks
    const monitorInterval = setInterval(() => {
      checkDimensions();
      checkDebuggerTiming();
      checkConsoleGetter();
    }, 400);

    return () => {
      if (document.body) {
        document.body.classList.remove("pairo-prod-shield");
        document.body.classList.remove("pairo-security-blur");
      }
      window.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      document.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      window.removeEventListener("dragstart", handleDragStart, { capture: true });
      document.removeEventListener("dragstart", handleDragStart, { capture: true });
      document.removeEventListener("copy", handleCopyCut, { capture: true });
      document.removeEventListener("cut", handleCopyCut, { capture: true });
      document.removeEventListener("selectstart", handleSelectStart, { capture: true });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
      window.removeEventListener("resize", checkDimensions);
      clearInterval(monitorInterval);
    };
  }, [pathname]);

  return null;
}
