"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, Printer, PhoneCall, HelpCircle, Loader2, Calendar, MapPin, CreditCard, ShoppingBag, Truck, Mail, ChevronDown, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { IDEMPOTENCY_STORAGE_KEY } from "@/lib/checkoutStorage";

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 20;

export default function SuccessPage() {
  const { clearCart } = useCart();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderNumber, setOrderNumber] = useState("");
  const [error, setError] = useState(null);
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  const [pollStatus, setPollStatus] = useState(null); // null | "polling" | "failed" | "timeout"
  const [pollError, setPollError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const pollOrderStatus = async (idemKey) => {
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/checkout/status?idempotencyKey=${encodeURIComponent(idemKey)}`);
          const data = await res.json();
          if (cancelled) return;

          if (data.success && data.status === "succeeded") {
            try { sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY); } catch (e) { }
            clearCart();
            if (data.orderNumber) setOrderNumber(data.orderNumber);

            try {
              const orderRes = await fetch(`/api/order-tracking/${data.orderId}`);
              const orderData = await orderRes.json();
              if (cancelled) return;
              if (orderData.success && orderData.order) {
                setOrder(orderData.order);
              } else {
                setError("Could not retrieve order details.");
              }
            } catch (err) {
              console.error("Error fetching order:", err);
              if (!cancelled) setError("Failed to fetch order details.");
            }

            if (!cancelled) {
              setPollStatus(null);
              setLoading(false);
            }
            return;
          }

          if (data.success && data.status === "failed") {
            try { sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY); } catch (e) { }
            setPollStatus("failed");
            setPollError(data.error || "Your payment could not be completed.");
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error("Error polling checkout status:", err);
        }

        if (cancelled) return;
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      if (!cancelled) {
        setPollStatus("timeout");
        setLoading(false);
      }
    };

    Promise.resolve().then(async () => {
      if (cancelled) return;
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      const orderNum = params.get("orderNumber");

      if (orderNum) {
        setOrderNumber(orderNum);
      }

      const lookupKey = id || orderNum;

      if (lookupKey) {
        try {
          const res = await fetch(`/api/order-tracking/${lookupKey}`);
          const data = await res.json();
          if (cancelled) return;
          if (data.success && data.order) {
            setOrder(data.order);
          } else {
            setError("Could not retrieve order details.");
          }
        } catch (err) {
          console.error("Error fetching order:", err);
          if (!cancelled) setError("Failed to fetch order details.");
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      let idemKey = params.get("idempotencyKey");
      if (!idemKey) {
        try {
          idemKey = sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
        } catch (e) { }
      }

      if (idemKey) {
        setPollStatus("polling");
        pollOrderStatus(idemKey);
        return;
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [clearCart]);

  const handlePrint = () => {
    window.print();
  };

  const getEstimatedDelivery = () => {
    return "15–20 Working Days";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center space-y-4 px-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
        <p className="text-[11px] uppercase tracking-widest font-bold text-black">
          {pollStatus === "polling" ? "Finalizing Your Order…" : "Loading Order Details..."}
        </p>
        {pollStatus === "polling" && (
          <p className="text-[12px] text-neutral-500 max-w-xs">
            We&apos;re confirming your payment and creating your order. This should only take a few seconds.
          </p>
        )}
      </div>
    );
  }

  if (pollStatus === "failed") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center space-y-5 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h1 className="text-base font-bold uppercase tracking-wider text-black">We Couldn&apos;t Complete Your Order</h1>
          <p className="text-[13px] text-neutral-600">{pollError}</p>
          <p className="text-[11px] text-neutral-500">Any payment taken has been automatically refunded. Your cart has not been cleared.</p>
        </div>
        <Link
          href="/checkout"
          className="bg-black text-white hover:bg-neutral-900 px-6 py-3.5 rounded-[4px] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          <span>Return to Checkout</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  if (pollStatus === "timeout") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center space-y-5 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-[#FAF9F6] border border-neutral-200 flex items-center justify-center">
          <Clock className="w-6 h-6 text-black" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h1 className="text-base font-bold uppercase tracking-wider text-black">This Is Taking Longer Than Expected</h1>
          <p className="text-[13px] text-neutral-600">
            Your payment may still be processing. Please check your email for a confirmation, or contact support if you don&apos;t hear back shortly.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/shop" className="border border-neutral-300 hover:border-black text-black px-6 py-3.5 rounded-[4px] text-xs font-bold uppercase tracking-wider bg-white transition-all">
            Continue Shopping
          </Link>
          <Link href="/profile" className="bg-black text-white hover:bg-neutral-900 px-6 py-3.5 rounded-[4px] text-xs font-bold uppercase tracking-wider transition-all shadow-sm">
            Check My Orders
          </Link>
        </div>
      </div>
    );
  }

  const customerName = order?.shippingAddress?.fullName || "Valued Customer";

  return (
    <div className="bg-white min-h-screen print:min-h-0 text-black font-sans selection:bg-black selection:text-white print:pb-0">

      {/* Printable Area Styling */}
      <style jsx global>{`
        @media print {
          html, body {
            background-color: white !important;
            color: black !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
          .print-full-width {
            width: 100% !important;
            max-width: 100% !important;
            grid-column: span 12 / span 12 !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>



      {/* Mobile Top Collapsible Summary Bar */}
      {order && (
        <div className="lg:hidden bg-[#FAF9F6] border-b border-neutral-200 no-print">
          <div className="container mx-auto px-2 sm:px-4">
            <button
              onClick={() => setShowMobileSummary(!showMobileSummary)}
              className="w-full py-4 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-black"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-black" />
                <span>{showMobileSummary ? "Hide Order Summary" : "Show Order Summary"}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-black transition-transform ${showMobileSummary ? "rotate-180" : ""}`} />
              </div>
              <span className="font-mono text-sm">${order.financials.total.toLocaleString()}</span>
            </button>

            {showMobileSummary && (
              <div className="pb-6 border-t border-neutral-200 bg-[#FAF9F6]/40 space-y-4 animate-fade-in">
                <div className="divide-y divide-neutral-200 pr-2 max-h-[280px] overflow-y-auto custom-scrollbar">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex gap-4 items-center py-3.5">
                      <div className="relative shrink-0 w-14 h-18">
                        <div className="w-full h-full bg-[#FAF9F6] rounded-lg border border-black/[0.05] overflow-hidden">
                          <img src={item.image || "/placeholder.jpg"} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <span className="absolute -top-1.5 -right-1.5 bg-black text-white rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold shadow-md z-10 border border-white">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-black uppercase tracking-wide truncate">{item.name}</p>
                        {item.selectedVariant?.title && (
                          <p className="text-[10px] text-black font-semibold uppercase">{item.selectedVariant.title}</p>
                        )}
                        <p className="text-[11px] font-bold text-black font-mono mt-0.5">${item.priceAtPurchase.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-neutral-200 space-y-2.5 text-[12px] text-black">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="text-black font-semibold font-mono">${order.financials.subtotal.toLocaleString()}</span>
                  </div>
                  {order.financials.discountTotal > 0 && (
                    <div className="flex justify-between text-black font-bold">
                      <span>Discount</span>
                      <span className="font-mono">-${order.financials.discountTotal.toLocaleString()}</span>
                    </div>
                  )}
                  {order.financials.affiliateDiscountAmount > 0 && (
                    <div className="flex justify-between text-black font-bold">
                      <span>Referral Discount</span>
                      <span className="font-mono">-${order.financials.affiliateDiscountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span className="text-black font-semibold font-mono">
                      {order.financials.shippingCost === 0 ? "Free" : `$${order.financials.shippingCost.toLocaleString()}`}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Grid Wrapper - Matches site margins/padding */}
      <div className="container mx-auto px-2 sm:px-4 md:px-8 py-8 md:py-12 print:py-0 print:my-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start print:block">

          {/* Left Column: Confirmation Message & Info (7 cols / full-width on print) */}
          <div className="lg:col-span-7 bg-white space-y-8 print-full-width">

            {/* Success Status Card */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-black uppercase tracking-widest">Order #{orderNumber || order?.orderNumber}</p>
                  <h1 className="text-base md:text-lg font-bold tracking-wider text-black">Thank you, {customerName}!</h1>
                </div>
              </div>

              <div className="border border-neutral-200 rounded-[4px] p-5 space-y-4">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-black">Your Order is Confirmed</h2>
                <p className="text-[13px] text-black leading-relaxed">
                  We have accepted your order and are preparing it. A confirmation email has been sent.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-neutral-100 text-xs text-black">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-black shrink-0" />
                    <span>Order Date: <span className="font-semibold text-black">{order ? new Date(order.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-black shrink-0" />
                    <span>Delivery Estimate: <span className="font-semibold text-black">{getEstimatedDelivery()}</span></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Shipping & Payment Details */}
            {order && (
              <div className="border border-neutral-200 rounded-[4px] p-5 space-y-6 print-avoid-break">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-black pb-3 border-b border-neutral-100">Order Details</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                  {/* Shipping Address */}
                  <div className="space-y-2">
                    <h2 className="text-[9px] font-bold text-black uppercase tracking-widest flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-black shrink-0" /> Shipping Address
                    </h2>
                    <div className="text-[13px] text-black space-y-0.5 font-semibold">
                      <p className="font-bold text-black">{order.shippingAddress.fullName}</p>
                      <p>{order.shippingAddress.street}</p>
                      <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
                      <p>{order.shippingAddress.country}</p>
                      <p className="text-black mt-1 font-bold">{order.shippingAddress.phone}</p>
                    </div>
                  </div>

                  {/* Billing Address */}
                  <div className="space-y-2">
                    <h2 className="text-[9px] font-bold text-black uppercase tracking-widest flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-black shrink-0" /> Billing Address
                    </h2>
                    <div className="text-[13px] text-black space-y-0.5 font-semibold">
                      <p className="font-bold text-black">{order.shippingAddress.fullName}</p>
                      <p>{order.shippingAddress.street}</p>
                      <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
                      <p>{order.shippingAddress.country}</p>
                      <p className="text-black mt-1 font-bold">{order.shippingAddress.phone}</p>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-2 md:col-span-2 pt-2 border-t border-neutral-100 print:col-span-2">
                    <h2 className="text-[9px] font-bold text-black uppercase tracking-widest flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-black shrink-0" /> Payment Information
                    </h2>
                    <div className="text-[13px] text-black">
                      <p className="font-bold text-black">{order.payment?.method || "Cash on Delivery"}</p>
                      <p className="text-[11px] text-black mt-0.5 font-medium">Payment Status: <span className="font-bold uppercase tracking-wider text-black">{order.payment?.status || "Pending"}</span></p>
                      {order.payment?.receiptUrl && (
                        <a
                          href={order.payment.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="no-print inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold uppercase tracking-wider text-black underline hover:text-neutral-600 transition-colors"
                        >
                          View Stripe Receipt <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-neutral-100 no-print">
              <Link
                href="/shop"
                className="bg-black text-white hover:bg-neutral-900 px-6 py-3.5 rounded-[4px] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm shrink-0"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Continue Shopping</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <button
                onClick={handlePrint}
                className="border border-neutral-300 hover:border-black text-black px-6 py-3.5 rounded-[4px] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-white transition-all shrink-0"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
              </button>

              <Link
                href="/profile"
                className="border border-neutral-300 hover:border-black text-black px-6 py-3.5 rounded-[4px] text-xs font-bold uppercase tracking-wider flex items-center justify-center bg-white transition-all shrink-0"
              >
                <span>Track Order</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Order Summary Side Box (5 cols / Stacks underneath left column on print) */}
          <div className="hidden lg:block print:block lg:col-span-5 bg-[#FAF9F6] print:bg-white border border-black/[0.04] print:border-t print:border-neutral-200 print:border-b-0 print:border-l-0 print:border-r-0 print:rounded-none rounded-[4px] p-6 md:p-8 print:p-0 print:pt-6 space-y-6 lg:sticky lg:top-28 print:static print:col-span-12 print:w-full print:mt-8 self-start print-avoid-break">
            <p className="text-xs font-bold uppercase tracking-wider text-black">Order Summary</p>

            {/* Products List */}
            {order?.items && (
              <div className="divide-y divide-neutral-200 max-h-[360px] print:max-h-none overflow-y-auto print:overflow-visible pr-2 custom-scrollbar">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-center py-3.5 first:pt-0 last:pb-0">
                    <div className="relative shrink-0 w-14 h-18">
                      <div className="w-full h-full bg-[#FAF9F6] rounded-lg border border-black/[0.05] overflow-hidden">
                        <img src={item.image || "/placeholder.jpg"} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="absolute -top-1.5 -right-1.5 bg-black text-white rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold shadow-md z-10 border border-white">
                        {item.quantity}
                      </span>
                    </div>

                    <div className="flex-1 space-y-0.5 min-w-0">
                      <p className="text-[13px] font-bold text-black uppercase tracking-wide truncate">{item.name}</p>
                      {item.selectedVariant?.title && (
                        <p className="text-[10px] text-black font-semibold uppercase">
                          {item.selectedVariant.title}
                        </p>
                      )}
                      <p className="text-[11px] font-bold text-black font-mono mt-1">
                        ${item.priceAtPurchase.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Financial Breakdown */}
            {order && (
              <div className="space-y-3 pt-6 border-t border-neutral-200 text-[12px] text-black">
                <div className="flex justify-between items-center">
                  <span>Subtotal</span>
                  <span className="text-black font-semibold font-mono">${order.financials.subtotal.toLocaleString()}</span>
                </div>

                {order.financials.discountTotal > 0 && (
                  <div className="flex justify-between items-center text-black font-bold">
                    <span>Discount</span>
                    <span className="font-mono">-${order.financials.discountTotal.toLocaleString()}</span>
                  </div>
                )}

                {order.financials.affiliateDiscountAmount > 0 && (
                  <div className="flex justify-between items-center text-black font-bold">
                    <span>Referral Discount</span>
                    <span className="font-mono">-${order.financials.affiliateDiscountAmount.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span>Shipping</span>
                  <span className="text-black font-semibold font-mono">
                    {order.financials.shippingCost === 0 ? "Free" : `$${order.financials.shippingCost.toLocaleString()}`}
                  </span>
                </div>

                <div className="pt-5 flex justify-between items-end border-t border-neutral-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-black">Total Paid</span>
                  <span className="text-2xl font-black text-black font-mono">${order.financials.total.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
