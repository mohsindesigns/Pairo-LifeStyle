"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Lock, CreditCard, Truck, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";

export default function CheckoutPage() {
  const { 
    cartItems, 
    cartSubtotal, 
    clearCart,
    appliedPromo,
    discountTotal,
    applyPromoCode,
    removePromoCode
  } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const router = useRouter();

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
  
  // Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    zip: "",
    customerNote: ""
  });

  const FREE_SHIPPING_THRESHOLD = 500;
  const shipping = cartSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 45; 
  const total = cartSubtotal + shipping;

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
            zip: formData.zip,
            phone: formData.phone,
            country: "USA" // Default for now
          },
          financials: {
            subtotal: cartSubtotal,
            shippingCost: shipping,
            discountTotal: discountTotal || 0,
            total: total - (discountTotal || 0),
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

  const inputClass = "w-full bg-white border border-[#d9d9d9] rounded-xl px-5 py-3.5 text-[13px] font-medium placeholder:text-neutral-400 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all";

  return (
    <div className="bg-[#fcfcfc] min-h-screen text-black font-sans selection:bg-black selection:text-white pb-32">
      <div className="container mx-auto px-4 sm:px-6 md:px-12 py-8 md:py-16 max-w-7xl">
        
        {/* Top Header */}
        <div className="flex flex-col gap-4 mb-12">
          <Link href="/cart" className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-450 hover:text-black transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Bag
          </Link>
          <div className="flex items-center justify-between border-b border-black/5 pb-6">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight uppercase heading-font">Secure Checkout</h1>
            <div className="flex items-center gap-1.5 text-[9px] font-black text-neutral-400 uppercase tracking-widest">
              <Lock className="w-3.5 h-3.5" /> SSL encrypted
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
            className="lg:col-span-7 bg-white rounded-[24px] border border-black/5 p-6 md:p-10 space-y-12"
          >
            {/* Contact */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                 <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-black">01. Contact Details</h2>
                 <div className="h-px bg-black/5 flex-1" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 ml-1">First Name</label>
                  <input name="firstName" onChange={handleInputChange} value={formData.firstName} type="text" placeholder="e.g. John" className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 ml-1">Last Name</label>
                  <input name="lastName" onChange={handleInputChange} value={formData.lastName} type="text" placeholder="e.g. Doe" className={inputClass} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 ml-1">Email Address <span className="text-red-500">*</span></label>
                  <input name="email" onChange={handleInputChange} value={formData.email} type="email" placeholder="john@example.com" className={inputClass} required />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 ml-1">Phone Number</label>
                  <input name="phone" onChange={handleInputChange} value={formData.phone} type="tel" placeholder="+1 (555) 000-0000" className={inputClass} />
                </div>
              </div>
            </section>

            {/* Shipping */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                 <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-black">02. Shipping Address</h2>
                 <div className="h-px bg-black/5 flex-1" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 ml-1">Street Address <span className="text-red-500">*</span></label>
                  <input name="street" onChange={handleInputChange} value={formData.street} type="text" placeholder="123 Luxury Avenue, Apt 4" className={inputClass} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 ml-1">City</label>
                  <input name="city" onChange={handleInputChange} value={formData.city} type="text" placeholder="New York" className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 ml-1">ZIP Code</label>
                  <input name="zip" onChange={handleInputChange} value={formData.zip} type="text" placeholder="10001" className={inputClass} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 ml-1">Order Note (Optional)</label>
                  <textarea name="customerNote" onChange={handleInputChange} value={formData.customerNote} placeholder="Specific instructions for delivery..." className={`${inputClass} min-h-[90px] resize-y`} />
                </div>
              </div>
            </section>

            {/* Payment */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                 <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-black">03. Payment Method</h2>
                 <div className="h-px bg-black/5 flex-1" />
              </div>
              
              <div className="p-5 border border-black/10 rounded-xl bg-neutral-50 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <CreditCard className="w-4.5 h-4.5 text-neutral-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">Manual Payment / Cash on Delivery</span>
                 </div>
                 <div className="w-4 h-4 rounded-full border-[3px] border-black bg-white" />
              </div>
            </section>

            {/* Action */}
            <div className="pt-4">
               <button 
                onClick={handlePayment}
                disabled={isProcessing || !cartItems || cartItems.length === 0}
                className="w-full bg-black text-white hover:bg-neutral-900 py-5 rounded-xl font-bold text-[11px] uppercase tracking-[0.25em] transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
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
            <div className="bg-white rounded-[24px] border border-black/5 p-6 md:p-8 space-y-8 sticky top-10">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-black">Your Selections</h2>
              
              {/* Selections List */}
              <div className="divide-y divide-black/5 overflow-y-auto max-h-[360px] pr-1">
                {(cartItems || []).map((item, index) => {
                  const itemImage = item.image || (Array.isArray(item.images) && item.images[0]) || "/placeholder.jpg";
                  const itemKey = `${item.id || item._id}-${item.selectedSize || "Standard"}-${item.selectedColor || "Standard"}-${index}`;
                  return (
                    <div key={itemKey} className="flex gap-4 items-center py-4 first:pt-0 last:pb-0">
                      <div className="w-14 h-18 bg-[#f9f9f9] rounded-lg overflow-hidden border border-black/5 shrink-0">
                        <img src={itemImage} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 space-y-1 min-w-0">
                         {/* Reduced Product Title Size - Premium Shopify Plus style */}
                         <h3 className="text-[11px] font-bold text-neutral-800 uppercase tracking-wider truncate">{item.name}</h3>
                         <p className="text-[9px] text-neutral-400 font-bold uppercase">
                           Qty {item.quantity} / {item.selectedOptions ? Object.values(item.selectedOptions).join(" / ") : "Standard"}
                         </p>
                         <p className="text-[11px] font-bold tracking-tight text-neutral-900 mt-1">
                           ${(item.price * item.quantity).toLocaleString()}
                         </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Promo Form */}
              <div className="pt-6 border-t border-black/5 space-y-3">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="PROMO CODE" 
                      className="flex-1 bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-black transition-all"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    />
                    <button 
                      onClick={handleApplyPromo}
                      disabled={!promoCode || applyingPromo}
                      className="px-5 py-2.5 bg-black hover:bg-neutral-850 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 shrink-0"
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
              <div className="space-y-3 pt-6 border-t border-black/5">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-neutral-450">
                  <span>Subtotal</span>
                  <span className="text-black font-semibold">${(cartSubtotal || 0).toLocaleString()}</span>
                </div>
                {discountTotal > 0 && (
                   <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                    <span>Discount ({(appliedPromo?.type === 'percentage' || appliedPromo?.type === 'percentage_discount') ? `${appliedPromo?.value}%` : 'Fixed'})</span>
                    <span>-${discountTotal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-neutral-450">
                  <span>Shipping</span>
                  <span className={shipping === 0 ? "text-emerald-600" : "text-black font-semibold"}>
                    {shipping === 0 ? "Complimentary" : `$${shipping.toFixed(2)}`}
                  </span>
                </div>
                
                {/* Total */}
                <div className="pt-6 flex justify-between items-end border-t border-black/5">
                   <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Total Amount</span>
                   <span className="text-3xl font-bold tracking-tight">${Math.max(0, total - discountTotal).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </motion.aside>

        </div>
      </div>
    </div>
  );
}
