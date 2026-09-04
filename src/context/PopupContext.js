"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, HelpCircle, X } from "lucide-react";

const PopupContext = createContext(null);

export function PopupProvider({ children }) {
  const [popupState, setPopupState] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info", // "info" | "warning" | "error" | "success" | "confirm"
    confirmText: "Got it",
    cancelText: "Cancel",
  });

  const resolverRef = useRef(null);

  const closePopup = useCallback((result = false) => {
    setPopupState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);

  const showPopup = useCallback(({
    title,
    message,
    type = "info",
    confirmText,
    cancelText = "Cancel",
  }) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      
      const defaultTitle = 
        title ||
        (type === "error" ? "Notice" :
         type === "warning" ? "Attention Required" :
         type === "success" ? "Success" :
         type === "confirm" ? "Confirm Action" : "Notice");

      const defaultConfirmText = confirmText || (type === "confirm" ? "Confirm" : "Got it");

      setPopupState({
        isOpen: true,
        title: defaultTitle,
        message: String(message || ""),
        type,
        confirmText: defaultConfirmText,
        cancelText,
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

  const showConfirm = useCallback((message, title = "Are you sure?") => {
    return showPopup({
      title,
      message,
      type: "confirm",
      confirmText: "Confirm",
      cancelText: "Cancel",
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
        closePopup(false);
      } else if (e.key === "Enter" && popupState.type !== "confirm") {
        closePopup(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [popupState.isOpen, popupState.type, closePopup]);

  const getIcon = () => {
    switch (popupState.type) {
      case "error":
        return <AlertCircle className="w-4 h-4 text-white" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-white" />;
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-white" />;
      case "confirm":
        return <HelpCircle className="w-4 h-4 text-white" />;
      case "info":
      default:
        return <Info className="w-4 h-4 text-white" />;
    }
  };

  return (
    <PopupContext.Provider value={{ showPopup, showAlert, showConfirm, closePopup }}>
      {children}

      {popupState.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="global-popup-title"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
        >
          {/* Backdrop with blur */}
          <div
            onClick={() => closePopup(false)}
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
                onClick={() => closePopup(false)}
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
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/10">
                {popupState.type === "confirm" && (
                  <button
                    type="button"
                    onClick={() => closePopup(false)}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-[var(--radius,4px)] border border-black/25 text-black text-[11px] font-bold uppercase tracking-widest hover:border-black hover:bg-black/5 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {popupState.cancelText}
                  </button>
                )}
                <button
                  type="button"
                  autoFocus
                  onClick={() => closePopup(true)}
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
      closePopup: () => {},
    };
  }
  return context;
}
