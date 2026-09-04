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
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      case "warning":
        return <AlertTriangle className="w-6 h-6 text-amber-600" />;
      case "success":
        return <CheckCircle2 className="w-6 h-6 text-emerald-600" />;
      case "confirm":
        return <HelpCircle className="w-6 h-6 text-black" />;
      case "info":
      default:
        return <Info className="w-6 h-6 text-neutral-800" />;
    }
  };

  const getBadgeStyle = () => {
    switch (popupState.type) {
      case "error":
        return "bg-red-50 border-red-200 text-red-700";
      case "warning":
        return "bg-amber-50 border-amber-200 text-amber-800";
      case "success":
        return "bg-emerald-50 border-emerald-200 text-emerald-800";
      case "confirm":
        return "bg-neutral-100 border-neutral-200 text-neutral-800";
      case "info":
      default:
        return "bg-neutral-100 border-neutral-200 text-neutral-800";
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
            className="fixed inset-0 bg-black/60 backdrop-blur-[4px] transition-opacity duration-300 animate-in fade-in"
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-100 overflow-hidden transform transition-all duration-300 z-10 scale-100 animate-in zoom-in-95">
            {/* Top decorative accent bar */}
            <div
              className={`h-1.5 w-full ${
                popupState.type === "error"
                  ? "bg-red-500"
                  : popupState.type === "warning"
                  ? "bg-amber-500"
                  : popupState.type === "success"
                  ? "bg-emerald-500"
                  : "bg-black"
              }`}
            />

            {/* Close X Button */}
            <button
              onClick={() => closePopup(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 sm:p-7">
              {/* Icon & Badge */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center border ${getBadgeStyle()}`}
                >
                  {getIcon()}
                </div>
                <div>
                  <h3
                    id="global-popup-title"
                    className="text-lg font-bold text-neutral-900 tracking-tight leading-snug"
                  >
                    {popupState.title}
                  </h3>
                </div>
              </div>

              {/* Message */}
              <div className="mt-2 mb-6">
                <p className="text-[14px] leading-relaxed text-neutral-600 whitespace-pre-line font-normal">
                  {popupState.message}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                {popupState.type === "confirm" && (
                  <button
                    type="button"
                    onClick={() => closePopup(false)}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-50 active:scale-[0.98] transition-all"
                  >
                    {popupState.cancelText}
                  </button>
                )}
                <button
                  type="button"
                  autoFocus
                  onClick={() => closePopup(true)}
                  className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 active:scale-[0.98] transition-all shadow-sm"
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
