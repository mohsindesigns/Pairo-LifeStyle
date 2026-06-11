"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Lock, CreditCard, Truck, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";

export default function CheckoutPage() {
  const { cartItems, cartSubtotal, clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [discountData, setDiscountData] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Generate unique key for this session to prevent double-orders
    Promise.resolve().then(() => {
      setIdempotencyKey(`pai_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`);
    });
  }, []);

  const applyPromoCode = async () => {
    if (!promoCode) return;
    setApplyingPromo(true);
    setPromoError("");
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode, cartSubtotal })
      });
      const data = await res.json();
      if (data.success) {
        setDiscountData(data);
        setPromoCode("");
      } else {
        setPromoError(data.error);
      }
    } catch (err) {
      setPromoError("Connection error");
    } finally {
      setApplyingPromo(false);
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

  const shipping = 0; 
  const total = cartSubtotal + shipping;

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
            discountTotal: discountData?.discountAmount || 0,
            total: total - (discountData?.discountAmount || 0),
            promoCode: discountData?.code || null
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

  return (
    <div className="bg-white min-h-screen text-black font-sans selection:bg-black selection:text-white pb-32">
      <div className="container mx-auto px-6 md:px-12 py-12 md:py-24 max-w-7xl">
        
        <div className="flex flex-col gap-8 mb-16">
          <Link href="/cart" className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-all">
            <ChevronLeft className="w-4 h-4" />
            Back to Bag
          </Link>
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Checkout</h1>
            <p className="text-sm text-black/40">Complete your acquisition.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 xl:gap-24 items-start">
          
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="lg:col-span-7 space-y-16">
            
            {/* Contact */}
            <section className="space-y-8">
              <div className="flex items-center gap-4">
                 <h2 className="text-sm font-bold uppercase tracking-widest">01. Contact</h2>
                 <div className="h-[1px] bg-black/5 flex-1" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 ml-1">First Name</label>
                  <input name="firstName" onChange={handleInputChange} value={formData.firstName} type="text" placeholder="John" className="w-full bg-gray-50 border border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-black/10 transition-all outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 ml-1">Last Name</label>
                  <input name="lastName" onChange={handleInputChange} value={formData.lastName} type="text" placeholder="Doe" className="w-full bg-gray-50 border border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-black/10 transition-all outline-none" />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 ml-1">Email</label>
                  <input name="email" onChange={handleInputChange} value={formData.email} type="email" placeholder="john@example.com" className="w-full bg-gray-50 border border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-black/10 transition-all outline-none" />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 ml-1">Phone Number</label>
                  <input name="phone" onChange={handleInputChange} value={formData.phone} type="tel" placeholder="+1 (555) 000-0000" className="w-full bg-gray-50 border border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-black/10 transition-all outline-none" />
                </div>
              </div>
            </section>

            {/* Shipping */}
            <section className="space-y-8">
              <div className="flex items-center gap-4">
                 <h2 className="text-sm font-bold uppercase tracking-widest">02. Shipping</h2>
                 <div className="h-[1px] bg-black/5 flex-1" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 ml-1">Address</label>
                  <input name="street" onChange={handleInputChange} value={formData.street} type="text" placeholder="123 Luxury Avenue" className="w-full bg-gray-50 border border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-black/10 transition-all outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 ml-1">City</label>
                  <input name="city" onChange={handleInputChange} value={formData.city} type="text" placeholder="New York" className="w-full bg-gray-50 border border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-black/10 transition-all outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 ml-1">ZIP Code</label>
                  <input name="zip" onChange={handleInputChange} value={formData.zip} type="text" placeholder="10001" className="w-full bg-gray-50 border border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-black/10 transition-all outline-none" />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 ml-1">Note (Optional)</label>
                  <textarea name="customerNote" onChange={handleInputChange} value={formData.customerNote} placeholder="Any specific instructions..." className="w-full bg-gray-50 border border-transparent rounded-2xl px-6 py-4 text-sm focus:bg-white focus:border-black/10 transition-all outline-none min-h-[100px]" />
                </div>
              </div>
            </section>

            {/* Payment */}
            <section className="space-y-8">
              <div className="flex items-center gap-4">
                 <h2 className="text-sm font-bold uppercase tracking-widest">03. Payment</h2>
                 <div className="h-[1px] bg-black/5 flex-1" />
              </div>
              <div className="p-8 border border-black/5 rounded-[2rem] bg-gray-50 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <CreditCard className="w-5 h-5 text-black/40" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">Manual Payment / Cash on Delivery</span>
                 </div>
                 <div className="w-5 h-5 rounded-full border-4 border-black" />
              </div>
            </section>

            <div className="pt-8">
               <button 
                onClick={handlePayment}
                disabled={isProcessing || !cartItems || cartItems.length === 0}
                className="w-full bg-black text-white py-7 rounded-[2rem] font-bold text-xs uppercase tracking-[0.3em] shadow-xl hover:shadow-2xl transition-all active:scale-[0.99] disabled:opacity-50"
               >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-3">Processing Order <Loader2 className="w-4 h-4 animate-spin" /></span>
                ) : (
                  <span className="flex items-center justify-center gap-3">Complete Acquisition <ArrowRight className="w-4 h-4" /></span>
                )}
               </button>
            </div>
          </motion.div>

          <motion.aside variants={containerVariants} initial="hidden" animate="visible" transition={{ delay: 0.1 }} className="lg:col-span-5">
            <div className="bg-[#fcfcfc] rounded-[2.5rem] p-8 md:p-12 border border-black/[0.03] sticky top-32">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] mb-10 text-black/40">Selections</h2>
              
              <div className="space-y-8 mb-10 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                {(cartItems || []).map((item, index) => {
                  const itemImage = item.image || (Array.isArray(item.images) && item.images[0]) || "/placeholder.jpg";
                  const itemKey = `${item.id || item._id}-${item.selectedSize || "Standard"}-${item.selectedColor || "Standard"}-${index}`;
                  return (
                  <div key={itemKey} className="flex gap-6 items-center">
                    <div className="w-16 h-20 bg-white rounded-2xl overflow-hidden border border-black/5 shrink-0">
                      <img src={itemImage} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 space-y-1">
                       <h3 className="text-[10px] font-bold uppercase tracking-widest">{item.name}</h3>
                       <p className="text-[9px] text-black/40 uppercase font-bold">Qty {item.quantity} / {item.selectedOptions ? Object.values(item.selectedOptions).join(" / ") : "Standard"}</p>
                       <p className="text-xs font-bold tracking-tight mt-2">${(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                  </div>
                  );
                })}
              </div>

              <div className="space-y-4 pt-10 border-t border-black/5">
                {/* Promo Code Section */}
                <div className="pb-6">
                   <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Promo Code" 
                        className="flex-1 bg-white border border-black/10 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-black transition-all"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      />
                      <button 
                        onClick={applyPromoCode}
                        disabled={!promoCode || applyingPromo}
                        className="px-4 py-2 bg-black text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black/80 disabled:opacity-50 transition-all"
                      >
                         {applyingPromo ? "..." : "Apply"}
                      </button>
                   </div>
                   {promoError && <p className="text-[9px] text-red-500 font-bold mt-2 ml-1 uppercase tracking-widest">{promoError}</p>}
                   {discountData && (
                     <div className="mt-3 flex items-center justify-between p-2 bg-green-50 rounded-lg">
                        <span className="text-[9px] font-bold text-green-700 uppercase tracking-widest">Code Applied: {discountData.code}</span>
                        <button onClick={() => setDiscountData(null)} className="text-[9px] font-bold text-green-700 uppercase">Remove</button>
                     </div>
                   )}
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-black/40">
                  <span>Subtotal</span>
                  <span className="text-black">${(cartSubtotal || 0).toLocaleString()}</span>
                </div>
                {discountData && (
                   <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-green-600">
                    <span>Discount ({discountData.type === 'percentage' ? `${discountData.value}%` : 'Fixed'})</span>
                    <span>-${discountData.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-black/40">
                  <span>Shipping</span>
                  <span className="text-green-600">Complimentary</span>
                </div>
                <div className="pt-6 flex justify-between items-end border-t border-black/[0.03]">
                   <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Total</span>
                   <span className="text-4xl font-bold tracking-tighter">${(total - (discountData?.discountAmount || 0)).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </motion.aside>

        </div>
      </div>
    </div>
  );
}
