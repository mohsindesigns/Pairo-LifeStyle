"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, Printer, PhoneCall, HelpCircle, Loader2, Calendar, MapPin, CreditCard, ShoppingBag, Truck, Mail } from "lucide-react";

export default function SuccessPage() {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderNumber, setOrderNumber] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.resolve().then(async () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      const orderNum = params.get("orderNumber");

      if (orderNum) {
        setOrderNumber(orderNum);
      }

      if (id) {
        try {
          const res = await fetch(`/api/order-tracking/${id}`);
          const data = await res.json();
          if (data.success && data.order) {
            setOrder(data.order);
          } else {
            setError("Could not retrieve order details.");
          }
        } catch (err) {
          console.error("Error fetching order:", err);
          setError("Failed to fetch order details.");
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const getEstimatedDelivery = () => {
    if (!order) return "5-7 business days";
    const snapshot = order.shippingSnapshot || {};
    const method = (snapshot.methodName || "").toLowerCase();
    if (method.includes("express") || method.includes("fast")) {
      return "2-3 business days";
    }
    return "5-7 business days";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
        <p className="text-xs uppercase tracking-widest font-bold text-neutral-500">Loading Order Details...</p>
      </div>
    );
  }

  const customerName = order?.shippingAddress?.fullName || "Valued Customer";

  return (
    <div className="bg-[#FAF9F6] min-h-screen text-black font-sans selection:bg-black selection:text-white pb-16">
      
      {/* Printable Area Styling */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
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
          }
        }
      `}</style>

      {/* Main Grid Wrapper */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        
        {/* Left Column: Confirmation Message & Info */}
        <div className="lg:col-span-7 bg-white p-6 md:p-12 lg:pr-16 space-y-10 border-r border-neutral-200 print-full-width">
          {/* Header */}
          <div className="flex flex-col gap-2 pb-6 border-b border-neutral-100 no-print">
            <Link href="/" className="text-xl font-black uppercase tracking-[0.25em] text-black">
              PAIRO LIFESTYLE
            </Link>
          </div>

          {/* Success Status Card */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center shrink-0">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Order #{orderNumber || order?.orderNumber}</p>
                <h1 className="text-xl font-black uppercase tracking-tight text-black">Thank you, {customerName}!</h1>
              </div>
            </div>

            <div className="border border-neutral-200 rounded-[4px] p-5 space-y-4">
              <p className="text-[13px] font-bold uppercase tracking-wider text-black">Your Order is Confirmed</p>
              <p className="text-[13px] text-neutral-600 leading-relaxed">
                We've accepted your order and are preparing it. A confirmation email has been sent.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-2 text-xs border-t border-neutral-100 mt-2">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Calendar className="w-4 h-4 text-black" />
                  <span>Order Date: <span className="font-semibold text-black">{order ? new Date(order.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</span></span>
                </div>
                <div className="flex items-center gap-2 text-neutral-500">
                  <Truck className="w-4 h-4 text-black" />
                  <span>Estimated Delivery: <span className="font-semibold text-black">{getEstimatedDelivery()}</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* Shipping & Payment Details */}
          {order && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-neutral-100">
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-black" /> Shipping Address
                </h4>
                <div className="text-[13px] text-neutral-700 space-y-0.5">
                  <p className="font-bold text-black">{order.shippingAddress.fullName}</p>
                  <p>{order.shippingAddress.street}</p>
                  <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
                  <p>{order.shippingAddress.country}</p>
                  <p className="text-neutral-500 mt-1">{order.shippingAddress.phone}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-black" /> Billing Address
                </h4>
                <div className="text-[13px] text-neutral-700 space-y-0.5">
                  <p className="font-bold text-black">{order.shippingAddress.fullName}</p>
                  <p>{order.shippingAddress.street}</p>
                  <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
                  <p>{order.shippingAddress.country}</p>
                  <p className="text-neutral-500 mt-1">{order.shippingAddress.phone}</p>
                </div>
              </div>

              <div className="space-y-3 md:col-span-2 pt-2">
                <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-black" /> Payment Information
                </h4>
                <div className="text-[13px] text-neutral-700">
                  <p className="font-bold text-black">{order.payment?.method || "Cash on Delivery"}</p>
                  <p className="text-xs text-neutral-500">Status: <span className="font-bold uppercase tracking-wider text-black">{order.payment?.status || "Pending"}</span></p>
                </div>
              </div>
            </div>
          )}

          {/* Customer Support & Contact Section */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-[4px] p-5 space-y-3 no-print">
            <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-black" /> Need Assistance?
            </h4>
            <p className="text-xs text-neutral-600 leading-relaxed">
              If you have any questions about your order, shipping, or returns, feel free to reach out to our team.
            </p>
            <div className="flex flex-wrap gap-4 pt-2 text-xs">
              <a href="mailto:support@pairolifestyle.com" className="text-black font-bold hover:underline flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> support@pairolifestyle.com
              </a>
              <a href="tel:+923001234567" className="text-black font-bold hover:underline flex items-center gap-1">
                <PhoneCall className="w-3.5 h-3.5" /> +92 300 1234567
              </a>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 pt-6 border-t border-neutral-100 no-print">
            <Link
              href="/shop"
              className="bg-black text-white hover:bg-neutral-900 px-6 py-3.5 rounded-[4px] text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-sm transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Continue Shopping</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            
            <button
              onClick={handlePrint}
              className="border border-neutral-300 hover:border-black text-black px-6 py-3.5 rounded-[4px] text-xs font-bold uppercase tracking-widest flex items-center gap-2 bg-white transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice</span>
            </button>

            <Link
              href="/order-tracking"
              className="border border-neutral-300 hover:border-black text-black px-6 py-3.5 rounded-[4px] text-xs font-bold uppercase tracking-widest flex items-center justify-center bg-white transition-all shrink-0"
            >
              <span>Track Order</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Order Summary Side Box */}
        <div className="lg:col-span-5 bg-[#FAF9F6] p-6 md:p-12 lg:pl-16 space-y-8 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          <h3 className="text-sm font-bold uppercase tracking-wider text-black">Order Summary</h3>

          {/* Products List */}
          {order?.items && (
            <div className="divide-y divide-neutral-200/80 max-h-[360px] overflow-y-auto pr-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex gap-4 items-center py-4 first:pt-0 last:pb-0">
                  <div className="relative w-14 h-16 bg-white rounded-[3px] border border-neutral-200 overflow-hidden shrink-0">
                    <img src={item.image || "/placeholder.jpg"} alt={item.name} className="w-full h-full object-cover" />
                    <span className="absolute -top-1.5 -right-1.5 bg-neutral-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <p className="text-[13px] font-bold text-black uppercase tracking-wide truncate">{item.name}</p>
                    {item.selectedVariant?.title && (
                      <p className="text-[11px] text-neutral-500 font-medium uppercase">
                        {item.selectedVariant.title}
                      </p>
                    )}
                    <p className="text-[12px] font-bold text-black font-mono mt-1">
                      ${item.priceAtPurchase.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Financial Breakdown */}
          {order && (
            <div className="space-y-3 pt-6 border-t border-neutral-200/85 text-[13px] text-neutral-600">
              <div className="flex justify-between items-center">
                <span>Subtotal</span>
                <span className="text-black font-semibold font-mono">${order.financials.subtotal.toLocaleString()}</span>
              </div>
              
              {order.financials.discountTotal > 0 && (
                <div className="flex justify-between items-center text-emerald-700 font-semibold">
                  <span>Discount</span>
                  <span className="font-mono">-${order.financials.discountTotal.toLocaleString()}</span>
                </div>
              )}

              {order.financials.affiliateDiscountAmount > 0 && (
                <div className="flex justify-between items-center text-emerald-700 font-semibold">
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

              <div className="pt-6 flex justify-between items-end border-t border-neutral-200/85">
                <span className="text-sm font-bold uppercase tracking-wider text-black">Total Paid</span>
                <span className="text-2xl font-black text-black font-mono">${order.financials.total.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
