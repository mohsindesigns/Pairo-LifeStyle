"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { Loader2, ArrowRight } from "lucide-react";
import { IDEMPOTENCY_STORAGE_KEY } from "@/lib/checkoutStorage";

// refreshKey: bump it after the server changed the PaymentIntent's amount, so the mounted PaymentElement re-reads it
// (elements.fetchUpdates) instead of being torn down - which would wipe the card number the shopper already typed.
// securitySlot: rendered directly above the pay button (the CAPTCHA, so the shopper sees it before paying).
export default function StripePaymentForm({ returnUrl, idempotencyKey, onValidate, onBeforeSubmit, onPaymentAttempt, onPaymentSuccess, securitySlot = null, refreshKey = 0, disabled = false }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isReady = !!stripe && !!elements;

  useEffect(() => {
    if (!elements || !refreshKey) return;
    let cancelled = false;
    (async () => {
      try {
        await elements.fetchUpdates();
      } catch (err) {
        if (!cancelled) console.warn("[Stripe] fetchUpdates failed:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey, elements]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (typeof onValidate === "function") {
      setIsSubmitting(true);
      const isValid = await onValidate();
      if (!isValid) {
        setIsSubmitting(false);
        return;
      }
    }

    if (!isReady) { setIsSubmitting(false); return; }

    // The amount may have just been updated server-side (finalize step re-sends the payload) - make sure the
    // element reflects it before confirming.
    try {
      await elements.fetchUpdates();
    } catch (err) { }

    // GA4 add_payment_info (card path) — after validation, before confirming payment.
    if (typeof onBeforeSubmit === "function") onBeforeSubmit();

    setIsSubmitting(true);

    try {
      sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, idempotencyKey);
    } catch (err) { }
    if (typeof onPaymentAttempt === "function") onPaymentAttempt();

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required"
    });

    if (result.error) {
      setErrorMessage(result.error.message || "Payment failed. Please try again.");
      setIsSubmitting(false);
      return;
    }

    if (result.paymentIntent?.status === "succeeded") {
      if (typeof onPaymentSuccess === "function") onPaymentSuccess();
      router.push(`/checkout/success?idempotencyKey=${idempotencyKey}`);
      return;
    }

    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isReady && (
        <div className="space-y-3">
          <div className="w-full h-10 bg-neutral-100 animate-pulse rounded-[4px]" />
          <div className="w-full h-10 bg-neutral-100 animate-pulse rounded-[4px]" />
        </div>
      )}
      <div className={isReady ? "" : "hidden"}>
        <PaymentElement />
      </div>
      {errorMessage && (
        <p role="alert" className="text-xs text-red-500 font-semibold">{errorMessage}</p>
      )}
      {securitySlot}
      <button
        type="submit"
        disabled={disabled || !isReady || isSubmitting}
        className="w-full bg-black text-white hover:bg-neutral-900 py-4 rounded-[4px] text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <span>Complete Order</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}
