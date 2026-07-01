"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Lock, CreditCard, Truck, ShieldCheck, ArrowRight, Loader2, User, Mail, Phone, MapPin, Tag, MessageSquare, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";

export default function CheckoutPage() {
  const {
    cartItems,
    cartSubtotal,
    shippingCost,
    cartTotal,
    clearCart,
    appliedPromo,
    discountTotal,
    applyPromoCode,
    removePromoCode,
    selectedShipping,
    setSelectedShipping,
    affiliateDiscount,
    affiliateDiscountAmount
  } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const router = useRouter();

  // Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "Pakistan",
    state: "",
    street: "",
    city: "",
    zip: "",
    customerNote: ""
  });

  // Shipping rates state
  const [shippingRates, setShippingRates] = useState([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [shippingRatesFetched, setShippingRatesFetched] = useState(false);

  useEffect(() => {
    // Generate unique key for this session to prevent double-orders
    Promise.resolve().then(() => {
      setIdempotencyKey(`pai_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`);
    });
  }, []);

  const handleApplyPromo = async () => {
    if (!promoCode) return;
    setApplyingPromo(true);
    setPromoError("");
    const res = await applyPromoCode(promoCode, formData.email);
    setApplyingPromo(false);
    if (res.success) {
      setPromoCode("");
    } else {
      setPromoError(res.error);
    }
  };

  // Fetch shipping rates when address fields are filled
  const fetchRates = useCallback(async () => {
    if (!formData.country) return;
    setLoadingRates(true);
    try {
      const res = await fetch('/api/shipping/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: { country: formData.country, state: formData.state, city: formData.city, zip: formData.zip },
          subtotal: cartSubtotal,
          items: cartItems
        })
      });
      const data = await res.json();
      if (data.success) {
        setShippingRates(data.rates || []);
        setShippingRatesFetched(true);
        // Auto-select first rate if none selected
        if (!selectedShipping && data.rates?.length > 0) {
          setSelectedShipping(data.rates[0]);
        }
      }
    } catch (e) { console.error('Failed to fetch shipping rates', e); }
    finally { setLoadingRates(false); }
  }, [formData.country, formData.state, formData.city, formData.zip, cartSubtotal]);

  // Debounce: fetch rates when address changes
  useEffect(() => {
    const t = setTimeout(fetchRates, 600);
    return () => clearTimeout(t);
  }, [fetchRates]);

  // Debounced email-change promo code validation
  useEffect(() => {
    if (appliedPromo && formData.email) {
      const delayDebounceFn = setTimeout(() => {
        const revalidate = async () => {
          setPromoError("");
          const res = await applyPromoCode(appliedPromo.code, formData.email);
          if (!res.success) {
            setPromoError(`Coupon removed: ${res.error}`);
          }
        };
        revalidate();
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [formData.email, appliedPromo?.code]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePayment = async () => {
    if (!formData.email || !formData.street) {
      alert("Please fill in the required fields (Email and Street Address)");
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems,
          idempotencyKey,
          customerEmail: formData.email,
          customerNote: formData.customerNote,
          shippingAddress: {
            fullName: `${formData.firstName} ${formData.lastName}`,
            street: formData.street,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
            phone: formData.phone,
            country: formData.country
          },
          // Build the immutable shippingSnapshot
          shippingSnapshot: selectedShipping ? {
            version: 1,
            zoneId: selectedShipping.zoneId,
            zoneName: selectedShipping.zoneName,
            methodId: selectedShipping.methodId,
            methodName: selectedShipping.methodName,
            provider: selectedShipping.provider,
            cost: selectedShipping.cost,
            currency: selectedShipping.currency,
            settings: selectedShipping.settings,
            conditions: selectedShipping.conditions,
            capturedAt: new Date().toISOString()
          } : null,
          referralCode: (() => {
            try {
              const cookieMatch = document.cookie.match(/(^|;)\s*pairo_ref\s*=\s*([^;]+)/);
              if (cookieMatch) {
                const parsed = JSON.parse(decodeURIComponent(cookieMatch[2]));
                if (parsed && parsed.expiresAt > Date.now()) return parsed.code;
              }
              const stored = localStorage.getItem("pairo_ref");
              if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.expiresAt > Date.now()) return parsed.code;
              }
            } catch (e) { }
            return null;
          })(),
          financials: {
            subtotal: cartSubtotal,
            shippingCost: shippingCost,
            discountTotal: discountTotal || 0,
            total: cartTotal,
            promoCode: appliedPromo?.code || null
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        clearCart();
        router.push(`/checkout/success?orderNumber=${data.orderNumber}`);
      } else {
        alert(data.error || "Order failed");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred during checkout.");
    } finally {
      setIsProcessing(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const inputClass = "w-full bg-white border border-neutral-300 rounded-[4px] px-4 py-2.5 text-[13px] placeholder:text-neutral-400 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all duration-200 text-black";

  return (
    <div className="bg-[#FAF9F6] min-h-screen text-black font-sans selection:bg-black selection:text-white">
      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-black" />
          <p className="text-xs uppercase tracking-widest font-bold text-neutral-600">Processing Your Order...</p>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-screen">

        {/* Left Column: Checkout Forms */}
        <div className="lg:col-span-7 bg-white p-6 md:p-12 lg:pr-16 space-y-10 border-r border-neutral-200">
          {/* Logo / Header */}
          <div className="flex flex-col gap-2 pb-6 border-b border-neutral-100">
            <Link href="/" className="text-xl font-black uppercase tracking-[0.25em] text-black">
              PAIRO LIFESTYLE
            </Link>
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 uppercase tracking-widest">
              <Link href="/cart" className="hover:underline text-neutral-600">Cart</Link>
              <span>/</span>
              <span className="text-black font-semibold">Information</span>
              <span>/</span>
              <span className="text-neutral-400">Payment</span>
            </div>
          </div>

          <div className="space-y-8">
            {/* 1. Contact Information */}
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-black">Contact Information</h3>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="email@example.com"
                    className={inputClass}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Phone Number (for shipping updates) *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="e.g. +92 300 1234567"
                    className={inputClass}
                    required
                  />
                </div>
              </div>
            </section>

            {/* 2. Shipping Address */}
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-black">Shipping Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="First Name"
                    className={inputClass}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Last Name"
                    className={inputClass}
                    required
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Street Address *</label>
                  <input
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleInputChange}
                    placeholder="Apartment, suite, unit, street address"
                    className={inputClass}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">City *</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="City"
                    className={inputClass}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">State / Province</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="State / Province"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Postal / ZIP Code</label>
                  <input
                    type="text"
                    name="zip"
                    value={formData.zip}
                    onChange={handleInputChange}
                    placeholder="ZIP / Postal Code"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Country</label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    placeholder="Country"
                    className={inputClass}
                    readOnly
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Order Notes (Optional)</label>
                  <textarea
                    name="customerNote"
                    value={formData.customerNote}
                    onChange={handleInputChange}
                    placeholder="Notes about your order (e.g. delivery instructions)"
                    rows={2}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>
            </section>

            {/* 3. Shipping Method */}
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-black">Shipping Method</h3>
              {loadingRates && (
                <div className="flex items-center gap-2 py-4 text-xs text-neutral-500">
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Calculating shipping rates...</span>
                </div>
              )}
              {!loadingRates && shippingRates.length === 0 && (
                <p className="text-xs text-neutral-400 italic">Please fill out your street address and city to calculate shipping options.</p>
              )}
              {shippingRates.length > 0 && (
                <div className="border border-neutral-200 rounded-[4px] divide-y divide-neutral-200 overflow-hidden">
                  {shippingRates.map((rate) => (
                    <label
                      key={rate.methodId}
                      className={`flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-50 transition-colors ${selectedShipping?.methodId === rate.methodId ? "bg-neutral-50/50" : ""
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shippingMethod"
                          checked={selectedShipping?.methodId === rate.methodId}
                          onChange={() => setSelectedShipping(rate)}
                          className="accent-black w-4 h-4"
                        />
                        <div>
                          <p className="text-[13px] font-semibold text-black">{rate.methodName}</p>
                          {rate.description && <p className="text-[11px] text-neutral-500">{rate.description}</p>}
                        </div>
                      </div>
                      <span className="text-[13px] font-bold text-black font-mono">
                        {rate.cost === 0 ? "Free" : `$${rate.cost.toLocaleString()}`}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </section>

            {/* 4. Payment Method */}
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-black">Payment Method</h3>
              <div className="border border-neutral-200 rounded-[4px] p-4 bg-neutral-50/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-neutral-600" />
                  <span className="text-[13px] font-semibold text-black">Cash on Delivery (COD)</span>
                </div>
                <div className="w-4 h-4 rounded-full border-4 border-black bg-white" />
              </div>
            </section>

            {/* Submit Action */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handlePayment}
                disabled={isProcessing || !cartItems || cartItems.length === 0}
                className="w-full bg-black text-white hover:bg-neutral-900 py-4 rounded-[4px] text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Complete Order</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary (Sticky) */}
        <div className="lg:col-span-5 bg-[#FAF9F6] p-6 md:p-12 lg:pl-16 space-y-8 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          <h3 className="text-sm font-bold uppercase tracking-wider text-black lg:hidden">Order Summary</h3>

          {/* Cart Products List */}
          <div className="divide-y divide-neutral-200/80 max-h-[320px] lg:max-h-[420px] overflow-y-auto pr-2">
            {(cartItems || []).map((item, index) => {
              const itemImage = item.image || (Array.isArray(item.images) && item.images[0]) || "/placeholder.jpg";
              const itemKey = `${item.id || item._id}-${item.selectedSize || "Standard"}-${item.selectedColor || "Standard"}-${index}`;
              return (
                <div key={itemKey} className="flex gap-4 items-center py-4 first:pt-0 last:pb-0">
                  <div className="relative w-14 h-16 bg-neutral-100 rounded-[3px] border border-neutral-200 overflow-hidden shrink-0">
                    <img src={itemImage} alt={item.name} className="w-full h-full object-cover" />
                    <span className="absolute -top-1.5 -right-1.5 bg-neutral-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1 space-y-0.5 min-w-0">
                     <p className="text-[13px] font-bold text-black uppercase tracking-wide truncate">{item.name}</p>
                    {item.selectedOptions && (
                      <p className="text-[11px] text-neutral-500 font-medium uppercase">
                        {Object.entries(item.selectedOptions).map(([k, v]) => `${k}: ${v}`).join(" / ")}
                      </p>
                    )}
                    {/* Made to Measure Badge */}
                    {item.madeToMeasure?.enabled && (
                      <div className="mt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-[9px] font-bold uppercase tracking-wide">
                          âœ¦ Made to Measure
                        </span>
                        <details className="mt-1">
                          <summary className="text-[10px] text-neutral-400 cursor-pointer hover:text-neutral-600 transition-colors select-none">View measurements</summary>
                          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-neutral-500">
                            {Object.entries(item.madeToMeasure.measurements || {}).map(([k, v]) => v ? (
                              <span key={k}><span className="font-semibold capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>: {v} {item.madeToMeasure.unit}</span>
                            ) : null)}
                            {item.madeToMeasure.notes && <span className="col-span-2 italic">Note: {item.madeToMeasure.notes}</span>}
                          </div>
                        </details>
                      </div>
                    )}
                    <p className="text-[12px] font-bold text-black font-mono mt-1">
                      ${(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>


          {/* Coupon Code Input */}
          <div className="pt-6 border-t border-neutral-200/85 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Discount Code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                className="flex-1 bg-white border border-neutral-300 rounded-[4px] px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider outline-none focus:border-black placeholder:text-neutral-400 text-black transition-all"
              />
              <button
                type="button"
                onClick={handleApplyPromo}
                disabled={!promoCode || applyingPromo}
                className="px-5 py-2.5 bg-neutral-800 text-white hover:bg-black rounded-[4px] text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 shrink-0"
              >
                {applyingPromo ? "..." : "Apply"}
              </button>
            </div>
            {promoError && <p className="text-[10px] text-red-600 font-bold ml-1 uppercase tracking-wider">{promoError}</p>}
            {appliedPromo && (
              <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-[3px]">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                  Discount Code ({appliedPromo.code}) Applied
                </span>
                <button
                  type="button"
                  onClick={removePromoCode}
                  className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 uppercase tracking-wider"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Pricing Summary */}
          <div className="space-y-3 pt-6 border-t border-neutral-200/85 text-[13px] text-neutral-600">
            <div className="flex justify-between items-center">
              <span>Subtotal</span>
              <span className="text-black font-semibold font-mono">${(cartSubtotal || 0).toLocaleString()}</span>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between items-center text-emerald-700 font-semibold">
                <span>Discount</span>
                <span className="font-mono">-${discountTotal.toLocaleString()}</span>
              </div>
            )}

            {affiliateDiscount?.type !== "None" && affiliateDiscountAmount > 0 && (
              <div className="flex justify-between items-center text-emerald-700 font-semibold">
                <span>Referral Discount</span>
                <span className="font-mono">-${affiliateDiscountAmount.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span>Shipping</span>
              <span className="text-black font-semibold font-mono">
                {selectedShipping
                  ? (shippingCost === 0 ? "Free" : `$${shippingCost.toLocaleString()}`)
                  : "Calculated at next step"}
              </span>
            </div>

            <div className="pt-6 flex justify-between items-end border-t border-neutral-200/85">
              <span className="text-sm font-bold uppercase tracking-wider text-black">Total</span>
              <span className="text-2xl font-black text-black font-mono">${cartTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Security & Trust Badges */}
          <div className="pt-6 border-t border-neutral-200/85 space-y-4">
            <div className="flex items-center gap-3 text-neutral-500">
              <ShieldCheck className="w-5 h-5 shrink-0 text-black" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-black">Secure Checkout Guarantee</p>
                <p className="text-[10px] text-neutral-400">Your details are fully protected and processed securely.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-neutral-500">
              <Truck className="w-5 h-5 shrink-0 text-black" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-black">Reliable Home Delivery</p>
                <p className="text-[10px] text-neutral-400">Orders are packed with care and shipped via trusted courie$</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

