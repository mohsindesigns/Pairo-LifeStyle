"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, HelpCircle, X } from "lucide-react";

const PopupContext = createContext(null);

export function PopupProvider({ children }) {
  const [popupState, setPopupState] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info", // "info" | "warning" | "error" | "success" | "confirm" | "prompt"
    confirmText: "Got it",
    cancelText: "Cancel",
    inputValue: "",
    inputLabel: "",
    danger: false,
  });
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  const resolverRef = useRef(null);

  const closePopup = useCallback((result = false) => {
    setPopupState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);

  // Prompts resolve with the typed text on OK and null on cancel, like window.prompt.
  const submitPopup = useCallback(() => {
    closePopup(popupState.type === "prompt" ? popupState.inputValue : true);
  }, [closePopup, popupState.type, popupState.inputValue]);
  const cancelPopup = useCallback(() => {
    closePopup(popupState.type === "prompt" ? null : false);
  }, [closePopup, popupState.type]);

  const showPopup = useCallback(({
    title,
    message,
    type = "info",
    confirmText,
    cancelText = "Cancel",
    defaultValue = "",
    inputLabel = "",
    danger = false,
  }) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      
      const defaultTitle = 
        title ||
        (type === "error" ? "Notice" :
         type === "warning" ? "Attention Required" :
         type === "success" ? "Success" :
         type === "confirm" ? "Confirm Action" :
         type === "prompt" ? "Enter a value" : "Notice");

      const defaultConfirmText = confirmText || (type === "confirm" ? "Confirm" : type === "prompt" ? "OK" : "Got it");

      setPopupState({
        isOpen: true,
        title: defaultTitle,
        message: String(message || ""),
        type,
        confirmText: defaultConfirmText,
        cancelText,
        inputValue: defaultValue == null ? "" : String(defaultValue),
        inputLabel,
        danger,
      });
    });
  }, []);

  const showAlert = useCallback((message, title, type = "warning") => {
    return showPopup({
      title: title || (type === "error" ? "Notice" : "Attention Required"),
      message,
      type,
    });
  }, [showPopup]);

  // Third argument is optional: { confirmText, cancelText, danger } for wording/styling only.
  const showConfirm = useCallback((message, title = "Are you sure?", options = {}) => {
    return showPopup({
      title,
      message,
      type: "confirm",
      confirmText: options.confirmText || "Confirm",
      cancelText: options.cancelText || "Cancel",
      danger: !!options.danger,
    });
  }, [showPopup]);

  // In-app replacement for window.prompt: resolves with the entered string, or null if cancelled.
  const showPrompt = useCallback((message, defaultValue = "", title, options = {}) => {
    return showPopup({
      title: title || "Enter a value",
      message,
      type: "prompt",
      defaultValue,
      inputLabel: options.inputLabel || "",
      confirmText: options.confirmText || "OK",
      cancelText: options.cancelText || "Cancel",
    });
  }, [showPopup]);

  // Global override for window.alert, window.confirm, and window.prompt
  // so no generic browser dialog ever appears anywhere in the application
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalAlert = window.alert;
    const originalConfirm = window.confirm;
    const originalPrompt = window.prompt;

    window.alert = (msg) => {
      const text = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg ?? "");
      showPopup({
        title: "Notice",
        message: text,
        type: "warning",
      });
    };

    window.confirm = (msg) => {
      const text = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg ?? "");
      showPopup({
        title: "Confirm Action",
        message: text,
        type: "confirm",
      });
      // Synchronous confirm cannot wait for async user clicks; returning false prevents accidental destructive action
      return false;
    };

    window.prompt = () => {
      return null;
    };

    return () => {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
      window.prompt = originalPrompt;
    };
  }, [showPopup]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!popupState.isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        cancelPopup();
      } else if (e.key === "Enter" && popupState.type !== "confirm") {
        // Prompts submit through their form, so Enter isn't handled twice.
        if (popupState.type !== "prompt") closePopup(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [popupState.isOpen, popupState.type, closePopup, cancelPopup]);

  const getIcon = () => {
    switch (popupState.type) {
      case "error":
        return <AlertCircle className="w-4 h-4 text-white" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-white" />;
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-white" />;
      case "confirm":
      case "prompt":
        return <HelpCircle className="w-4 h-4 text-white" />;
      case "info":
      default:
        return <Info className="w-4 h-4 text-white" />;
    }
  };

  return (
    <PopupContext.Provider value={{ showPopup, showAlert, showConfirm, showPrompt, closePopup }}>
      {children}

      {popupState.isOpen && isAdmin && (
        <AdminDialog state={popupState} onSubmit={submitPopup} onCancel={cancelPopup}
          onInput={(v) => setPopupState((prev) => ({ ...prev, inputValue: v }))} />
      )}

      {popupState.isOpen && !isAdmin && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="global-popup-title"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
        >
          {/* Backdrop with blur */}
          <div
            onClick={cancelPopup}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-md bg-white rounded-[var(--radius,4px)] shadow-2xl border border-black overflow-hidden transform transition-all duration-300 z-10 scale-100 animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/10 bg-[#FAF9F6] select-none">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-[var(--radius,4px)] bg-black text-white flex items-center justify-center shrink-0">
                  {getIcon()}
                </div>
                <h3
                  id="global-popup-title"
                  style={{ fontFamily: "var(--brand-font)" }}
                  className="text-[13px] sm:text-[14px] font-bold uppercase tracking-wider text-black truncate"
                >
                  {popupState.title}
                </h3>
              </div>
              <button
                onClick={cancelPopup}
                className="w-7 h-7 flex items-center justify-center border border-black/20 rounded-[var(--radius,4px)] hover:border-black hover:bg-black hover:text-white transition-all text-black shrink-0 cursor-pointer ml-3"
                aria-label="Close modal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 bg-white space-y-5">
              {/* Message */}
              <div>
                <p className="text-[13px] sm:text-[14px] leading-relaxed text-black/80 font-normal whitespace-pre-line">
                  {popupState.message}
                </p>
                {popupState.type === "prompt" && (
                  <input
                    autoFocus
                    aria-label={popupState.inputLabel || popupState.message || popupState.title}
                    value={popupState.inputValue}
                    onChange={(e) => setPopupState((prev) => ({ ...prev, inputValue: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitPopup(); } }}
                    className="mt-3 w-full border border-black/25 rounded-[var(--radius,4px)] px-3 py-2 text-[14px] text-black focus:outline-none focus:border-black"
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/10">
                {(popupState.type === "confirm" || popupState.type === "prompt") && (
                  <button
                    type="button"
                    onClick={cancelPopup}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-[var(--radius,4px)] border border-black/25 text-black text-[11px] font-bold uppercase tracking-widest hover:border-black hover:bg-black/5 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {popupState.cancelText}
                  </button>
                )}
                <button
                  type="button"
                  autoFocus={popupState.type !== "prompt"}
                  onClick={submitPopup}
                  className="flex-1 sm:flex-initial px-6 py-2.5 rounded-[var(--radius,4px)] bg-black text-white text-[11px] font-bold uppercase tracking-widest hover:bg-black/85 active:scale-[0.98] transition-all shadow-sm cursor-pointer"
                >
                  {popupState.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PopupContext.Provider>
  );
}

// WordPress-admin styled dialog used on /admin pages. Rendered outside .admin-dashboard-container,
// so it carries its own colours instead of the admin-ui.css classes.
function AdminDialog({ state, onSubmit, onCancel, onInput }) {
  const isPrompt = state.type === "prompt";
  const asksChoice = state.type === "confirm" || isPrompt;
  const primary = state.danger
    ? "bg-[#b32d2e] border-[#b32d2e] hover:bg-[#8a2424] hover:border-[#8a2424]"
    : "bg-[#2271b1] border-[#2271b1] hover:bg-[#135e96] hover:border-[#135e96]";
  const iconColour = { error: "#d63638", warning: "#dba617", success: "#00a32a" }[state.type] || "#2271b1";
  const Icon = { error: AlertCircle, warning: AlertTriangle, success: CheckCircle2, confirm: HelpCircle, prompt: HelpCircle }[state.type] || Info;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="global-popup-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div onClick={onCancel} className="fixed inset-0 bg-black/55" />
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        className="relative z-10 w-full max-w-[480px] bg-white shadow-[0_5px_15px_rgba(0,0,0,0.3)] text-[#3c434a]"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#dcdcde]">
          <Icon className="w-5 h-5 shrink-0" style={{ color: iconColour }} aria-hidden="true" />
          <h2 id="global-popup-title" className="flex-1 m-0 text-[18px] font-semibold text-[#1d2327] leading-snug">{state.title}</h2>
          <button type="button" onClick={onCancel} aria-label="Close"
            className="w-9 h-9 -mr-2 flex items-center justify-center text-[#646970] hover:text-[#d63638] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 py-4">
          {state.message && <p className="m-0 text-[14px] leading-relaxed whitespace-pre-line">{state.message}</p>}
          {isPrompt && (
            <input
              autoFocus
              aria-label={state.inputLabel || state.message || state.title}
              value={state.inputValue}
              onChange={(e) => onInput(e.target.value)}
              className="mt-3 w-full min-h-[36px] px-2 text-[14px] text-[#2c3338] bg-white border border-[#8c8f94] rounded-[4px] focus:border-[#2271b1] focus:shadow-[0_0_0_1px_#2271b1] focus:outline-none"
            />
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 px-4 py-3 bg-[#f6f7f7] border-t border-[#dcdcde]">
          {asksChoice && (
            <button type="button" onClick={onCancel}
              className="min-h-[36px] px-3 text-[13px] rounded-[3px] border border-[#2271b1] bg-[#f6f7f7] text-[#2271b1] hover:bg-[#f0f0f1] hover:text-[#135e96] cursor-pointer">
              {state.cancelText}
            </button>
          )}
          <button type="submit" autoFocus={!isPrompt}
            className={`min-h-[36px] px-3 text-[13px] rounded-[3px] border text-white cursor-pointer ${primary}`}>
            {state.confirmText}
          </button>
        </div>
      </form>
    </div>
  );
}

export function usePopup() {
  const context = useContext(PopupContext);
  if (!context) {
    // Fallback safe implementation if used outside provider
    return {
      showPopup: async ({ message }) => {
        if (typeof window !== "undefined") console.warn("Popup:", message);
      },
      showAlert: async (message) => {
        if (typeof window !== "undefined") console.warn("Alert:", message);
      },
      showConfirm: async () => false,
      showPrompt: async () => null,
      closePopup: () => {},
    };
  }
  return context;
}
