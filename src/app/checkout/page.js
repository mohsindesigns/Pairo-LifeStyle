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
  const [shippingRates, setShippingRates]         = useState([]);
  const [loadingRates, setLoadingRates]           = useState(false);
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
            version:    1,
            zoneId:     selectedShipping.zoneId,
            zoneName:   selectedShipping.zoneName,
            methodId:   selectedShipping.methodId,
            methodName: selectedShipping.methodName,
            provider:   selectedShipping.provider,
            cost:       selectedShipping.cost,
            currency:   selectedShipping.currency,
            settings:   selectedShipping.settings,
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
            } catch (e) {}
            return null;
          })(),
          financials: {
            subtotal:      cartSubtotal,
            shippingCost:  shippingCost,
            discountTotal: discountTotal || 0,
            total:         cartTotal,
            promoCode:     appliedPromo?.code || null
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

  const inputClass = "w-full bg-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl px-5 py-3.5 text-[13px] font-medium placeholder:text-foreground/50 focus:bg-background focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-300 shadow-sm text-foreground";

  return (
    <div className="bg-background min-h-screen text-foreground font-sans selection:bg-primary selection:text-background pb-32">
      <div className="container mx-auto px-4 sm:px-6 md:px-12 py-8 md:py-16 max-w-7xl">
        
        {/* Top Header */}
        <div className="flex flex-col gap-4 mb-12">
          <Link href="/cart" className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/60 hover:text-primary transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Bag
          </Link>
          <div className="flex items-center justify-between border-b border-border/80 pb-6">
            <p className="text-2xl font-bold tracking-tight uppercase heading-font text-foreground">Secure Checkout</p>
            <div className="flex items-center gap-1.5 text-[9px] font-black text-foreground/45 uppercase tracking-widest">
              <Lock className="w-3.5 h-3.5 text-primary" /> SSL encrypted
            </div>
          </div>
        </div>

        {/* Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-16 items-start">
          
          {/* Left Side: Contact, Shipping, Payment Forms */}
          <motion.div 
            variants={containerVariants} 
            initial="hidden" 
            animate="visible" 
            className="lg:col-span-7 bg-background rounded-[24px] border border-border p-6 md:p-10 space-y-12 shadow-sm"
          >
            {/* Contact */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                 <p className="text-[13px] font-bold uppercase tracking-[0.25em] text-foreground">01. Contact Details</p>
                 <div className="h-[1px] bg-border/60 flex-1" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-foreground/60 ml-1">First Name</label>
                  <input name="firstName" onChange={handleInputChange} value={formData.firstName} type="text" placeholder="e.g. John" className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-foreground/60 ml-1">Last Name</label>
                  <input name="lastName" onChange={handleInputChange} value={formData.lastName} type="text" placeholder="e.g. Doe" className={inputClass} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-foreground/60 ml-1">Email Address <span className="text-red-500">*</span></label>
                  <input name="email" onChange={handleInputChange} value={formData.email} type="email" placeholder="john@example.com" className={inputClass} required />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-foreground/60 ml-1">Phone Number</label>
                  <input name="phone" onChange={handleInputChange} value={formData.phone} type="tel" placeholder="+1 (555) 000-0000" className={inputClass} />
                </div>
              </div>
            </section>

            {/* Shipping */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                 <p className="text-[13px] font-bold uppercase tracking-[0.25em] text-foreground">02. Shipping Address</p>
                 <div className="h-[1px] bg-border/60 flex-1" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-foreground/60 ml-1">Street Address <span className="text-red-500">*</span></label>
                  <input name="street" onChange={handleInputChange} value={formData.street} type="text" placeholder="123 Luxury Avenue, Apt 4" className={inputClass} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-foreground/60 ml-1">Country</label>
                  <input name="country" onChange={handleInputChange} value={formData.country} type="text" placeholder="Pakistan" className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-foreground/60 ml-1">State / Province</label>
                  <input name="state" onChange={handleInputChange} value={formData.state} type="text" placeholder="Punjab" className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-foreground/60 ml-1">City</label>
                  <input name="city" onChange={handleInputChange} value={formData.city} type="text" placeholder="Lahore" className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-foreground/60 ml-1">ZIP / Postal Code</label>
                  <input name="zip" onChange={handleInputChange} value={formData.zip} type="text" placeholder="54000" className={inputClass} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-foreground/60 ml-1">Order Note (Optional)</label>
                  <textarea name="customerNote" onChange={handleInputChange} value={formData.customerNote} placeholder="Specific instructions for delivery..." className={`${inputClass} min-h-[90px] resize-y`} />
                </div>
              </div>
            </section>

            {/* Shipping Method Selector */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <p className="text-[13px] font-bold uppercase tracking-[0.25em] text-foreground">03. Shipping Method</p>
                <div className="h-[1px] bg-border/60 flex-1" />
              </div>
              {loadingRates && (
                <div className="flex items-center gap-2 text-[11px] text-foreground/60">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculating shipping rates...
                </div>
              )}
              {!loadingRates && shippingRates.length === 0 && shippingRatesFetched && (
                <p className="text-[11px] text-foreground/60 italic">No shipping methods available for your address.</p>
              )}
              {!loadingRates && !shippingRatesFetched && (
                <p className="text-[11px] text-foreground/60 italic">Enter your address to see available shipping options.</p>
              )}
              {shippingRates.length > 0 && (
                <div className="space-y-2">
                  {shippingRates.map(rate => (
                    <label
                      key={rate.methodId}
                      className={`flex items-center justify-between gap-4 p-4 border rounded-xl cursor-pointer transition-all ${
                        selectedShipping?.methodId === rate.methodId
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border/60 hover:border-primary/40 bg-secondary/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shippingMethod"
                          checked={selectedShipping?.methodId === rate.methodId}
                          onChange={() => setSelectedShipping(rate)}
                          className="accent-primary"
                        />
                        <div>
                          <p className="text-[12px] font-bold text-foreground">{rate.methodName}</p>
                          {rate.description && <p className="text-[10px] text-foreground/60">{rate.description}</p>}
                        </div>
                      </div>
                      <span className="text-[13px] font-bold text-foreground shrink-0">
                        {rate.cost === 0 ? 'Free' : `${rate.currency ?? ''} ${rate.cost.toLocaleString()}`}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </section>

            {/* Payment */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                 <p className="text-[13px] font-bold uppercase tracking-[0.25em] text-foreground">04. Payment Method</p>
                 <div className="h-[1px] bg-border/60 flex-1" />
              </div>
              
              <div className="p-5 border border-border/80 rounded-xl bg-secondary/40 flex items-center justify-between shadow-sm">
                 <div className="flex items-center gap-3">
                    <CreditCard className="w-4.5 h-4.5 text-foreground/60" />
                    <span className="text-[12px] font-bold uppercase tracking-widest text-foreground">Manual Payment / Cash on Delivery</span>
                 </div>
                 <div className="w-4 h-4 rounded-full border-[3px] border-primary bg-background" />
              </div>
            </section>

            {/* Action */}
            <div className="pt-4">
               <button 
                onClick={handlePayment}
                disabled={isProcessing || !cartItems || cartItems.length === 0}
                className="w-full bg-primary text-background hover:bg-primary/95 py-5 rounded-xl font-bold text-[13px] uppercase tracking-[0.25em] transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl shadow-primary/5"
               >
                {isProcessing ? (
                  <>Processing <Loader2 className="w-3.5 h-3.5 animate-spin" /></>
                ) : (
                  <>Complete Acquisition <ArrowRight className="w-3.5 h-3.5" /></>
                )}
               </button>
            </div>
          </motion.div>

          {/* Right Side: Order Summary */}
          <motion.aside 
            variants={containerVariants} 
            initial="hidden" 
            animate="visible" 
            transition={{ delay: 0.1 }} 
            className="lg:col-span-5"
          >
            <div className="bg-background rounded-[24px] border border-border p-6 md:p-8 space-y-8 sticky top-10 shadow-sm">
              <p className="text-[13px] font-bold uppercase tracking-[0.25em] text-foreground">Your Selections</p>
              
              {/* Selections List */}
              <div className="divide-y divide-border/60 overflow-y-auto max-h-[360px] pr-1">
                {(cartItems || []).map((item, index) => {
                  const itemImage = item.image || (Array.isArray(item.images) && item.images[0]) || "/placeholder.jpg";
                  const itemKey = `${item.id || item._id}-${item.selectedSize || "Standard"}-${item.selectedColor || "Standard"}-${index}`;
                  return (
                    <div key={itemKey} className="flex gap-4 items-center py-4 first:pt-0 last:pb-0">
                      <div className="w-14 h-18 bg-secondary/40 rounded-lg overflow-hidden border border-border/60 shrink-0">
                        <img src={itemImage} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 space-y-1 min-w-0">
                         {/* Reduced Product Title Size - Premium Shopify Plus style */}
                         <p className="text-sm font-bold text-foreground uppercase tracking-wider truncate">{item.name}</p>
                         <p className="text-[11px] text-foreground/65 font-bold uppercase">
                           Qty {item.quantity} / {item.selectedOptions ? Object.values(item.selectedOptions).join(" / ") : "Standard"}
                         </p>
                         <p className="text-sm font-bold tracking-tight text-foreground mt-1">
                           ${(item.price * item.quantity).toLocaleString()}
                         </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Promo Form */}
              <div className="pt-6 border-t border-border/80 space-y-3">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="PROMO CODE" 
                      className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-primary placeholder:text-foreground/50 text-foreground transition-all"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    />
                    <button 
                      onClick={handleApplyPromo}
                      disabled={!promoCode || applyingPromo}
                      className="px-5 py-2.5 bg-primary text-background hover:bg-primary/95 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 shrink-0"
                    >
                       {applyingPromo ? "..." : "Apply"}
                    </button>
                 </div>
                 {promoError && <p className="text-[9px] text-red-500 font-bold ml-1 uppercase tracking-widest">{promoError}</p>}
                 {appliedPromo && (
                   <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-100">
                      <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">Code {appliedPromo.code} Applied</span>
                      <button onClick={removePromoCode} className="text-[9px] font-bold text-emerald-600 hover:text-emerald-800 uppercase tracking-widest">Remove</button>
                   </div>
                 )}
              </div>

              {/* Totals Breakdown */}
              <div className="space-y-3 pt-6 border-t border-border/80">
                <div className="flex justify-between items-center text-[12px] font-bold uppercase tracking-widest text-foreground/70">
                  <span>Subtotal</span>
                  <span className="text-foreground font-semibold">${(cartSubtotal || 0).toLocaleString()}</span>
                </div>
                {discountTotal > 0 && (
                   <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                    <span>Discount ({(appliedPromo?.type === 'percentage' || appliedPromo?.type === 'percentage_discount') ? `${appliedPromo?.value}%` : 'Fixed'})</span>
                    <span>-${discountTotal.toLocaleString()}</span>
                  </div>
                )}
                {affiliateDiscount?.type !== 'None' && affiliateDiscountAmount > 0 && (
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                    <span>
                      Referral Discount
                      {affiliateDiscount.type === 'Percentage' ? ` (${affiliateDiscount.value}%)` : ''}
                    </span>
                    <span>-${affiliateDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[12px] font-bold uppercase tracking-widest text-foreground/70">
                  <span>Shipping</span>
                  <span className={shippingCost === 0 ? 'text-emerald-600 font-semibold' : 'text-foreground font-semibold'}>
                    {selectedShipping
                      ? (shippingCost === 0 ? 'Free' : `${selectedShipping.currency ?? 'Rs.'} ${shippingCost.toLocaleString()}`)
                      : '— Select method'}
                  </span>
                </div>
                
                {/* Total */}
                <div className="pt-6 flex justify-between items-end border-t border-border/80">
                   <span className="text-[13px] font-bold uppercase tracking-[0.2em]">Total Amount</span>
                   <span className="text-3xl font-bold tracking-tight">Rs. {cartTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </motion.aside>

        </div>
      </div>
    </div>
  );
}
