"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { Loader2, ArrowRight } from "lucide-react";
import { IDEMPOTENCY_STORAGE_KEY } from "@/lib/checkoutStorage";

export default function StripePaymentForm({ returnUrl, idempotencyKey, onValidate, disabled = false }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isReady = !!stripe && !!elements;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (typeof onValidate === "function" && !onValidate()) {
      return;
    }

    if (!isReady) return;

    setIsSubmitting(true);

    try {
      sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, idempotencyKey);
    } catch (err) { }

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
        <p className="text-[11px] text-red-500 font-semibold">{errorMessage}</p>
      )}
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
