"use client";

import { useCart } from "@/context/CartContext";
import Image from "next/image";
import Link from "next/link";
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag, ShieldCheck, Truck, RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";

import { useState } from "react";

export default function CartPage() {
  const { 
    cartItems, 
    updateQuantity, 
    removeFromCart, 
    cartSubtotal, 
    appliedPromo, 
    discountTotal, 
    applyPromoCode, 
    removePromoCode 
  } = useCart();
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [applying, setApplying] = useState(false);
  const [promoError, setPromoError] = useState("");

  const handleApplyPromo = async () => {
    if (!promoCodeInput) return;
    setApplying(true);
    setPromoError("");
    const res = await applyPromoCode(promoCodeInput);
    setApplying(false);
    if (res.success) {
      setPromoCodeInput("");
    } else {
      setPromoError(res.error);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center space-y-10 px-6 relative overflow-hidden bg-white">
        {/* Soft background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/[0.04] rounded-full blur-3xl pointer-events-none" />

        <div className="relative group">
          {/* Decorative blur glow */}
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl scale-110 group-hover:scale-125 transition-transform duration-500 ease-out" />
          <div className="relative w-24 h-24 bg-white border border-border rounded-full flex items-center justify-center shadow-lg transition-transform duration-500 hover:rotate-6">
            <ShoppingBag className="w-9 h-9 text-primary/60 group-hover:text-primary transition-colors duration-500" />
          </div>
        </div>

        <div className="text-center space-y-4 max-w-sm relative z-10">
          <p className="text-xl md:text-2xl font-bold heading-font uppercase tracking-tight text-foreground">Your Bag is Empty</p>
          <p className="text-foreground/60 text-xs md:text-sm leading-relaxed max-w-xs mx-auto">
            Looks like you haven&apos;t added any handcrafted shearling jacket to your collection yet.
          </p>
        </div>

        <Link 
          href="/" 
          className="group relative overflow-hidden bg-primary text-background px-10 py-4 rounded-full font-bold text-[10px] md:text-xs uppercase tracking-[0.2em] transition-all duration-300 shadow-xl hover:scale-[1.03] active:scale-95 flex items-center gap-2.5 z-10"
        >
          <span className="relative z-10">Explore Collection</span>
          <ArrowRight className="w-3.5 h-3.5 relative z-10 transition-transform duration-300 group-hover:translate-x-1" />
          <div className="absolute inset-0 bg-primary/95 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-6 md:px-16 py-12 md:py-20">
        <div className="flex flex-col lg:flex-row gap-16">
          
          {/* Main Cart Items Area */}
          <div className="flex-1 space-y-10">
            <div className="flex items-end justify-between border-b border-black/5 pb-8">
              <div className="space-y-1">
                <p className="text-2xl font-bold heading-font uppercase tracking-tight">Shopping Bag</p>
                <p className="text-[10px] font-bold text-black/30 uppercase tracking-[0.2em]">
                  {cartItems.reduce((acc, item) => acc + item.quantity, 0)} Items Selected
                </p>
              </div>
              <Link href="/" className="text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-black border-b border-black/10 hover:border-black transition-all pb-1">
                Continue Shopping
              </Link>
            </div>

            <div className="space-y-8">
              {cartItems.map((item, idx) => {
                const uniqueKey = `${item.id}-${item.selectedSize}-${item.selectedColor}`;
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={uniqueKey + idx}
                    className="flex gap-4 sm:gap-6 py-4 border-b border-black/5 group"
                  >
                    {/* Image */}
                    <div className="relative w-16 sm:w-24 aspect-[3/4] rounded-xl overflow-hidden bg-gray-50 border border-black/5 shrink-0">
                      <Image 
                        src={item.image} 
                        alt={item.name} 
                        fill 
                        className="object-cover transition-transform duration-1000 group-hover:scale-105" 
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col justify-start gap-3.5 py-1 min-w-0">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-0.5">
                            <p className="text-[13px] md:text-sm font-bold heading-font uppercase tracking-tight">{item.name}</p>
                            <div className="flex items-center gap-3">
                              <span className="text-[9px] font-bold text-black/40 uppercase tracking-widest font-sans">Size: {item.selectedSize}</span>
                              <div className="w-[1px] h-2 bg-black/10" />
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-black/40 uppercase tracking-widest font-sans">Color:</span>
                                <div className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: item.selectedColor }} />
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => removeFromCart(uniqueKey)}
                            className="p-1 text-black/20 hover:text-red-500 transition-colors shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-4 bg-gray-50 border border-black/5 rounded-lg px-3 py-1.5">
                          <button 
                            onClick={() => updateQuantity(uniqueKey, -1)}
                            className="text-black/30 hover:text-black transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-bold text-xs w-4 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(uniqueKey, 1)}
                            className="text-black/30 hover:text-black transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-lg md:text-xl font-bold heading-font tracking-tight">${(item.price * item.quantity).toFixed(0)}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Value Props */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10">
              {[
                { icon: ShieldCheck, title: "Secure Checkout", desc: "Encrypted Transactions" },
                { icon: Truck, title: "Express Delivery", desc: "Worldwide Shipping" },
                { icon: RefreshCcw, title: "Easy Returns", desc: "30-Day Policy" }
              ].map((prop, i) => (
                <div key={i} className="flex items-center gap-4 p-6 rounded-2xl bg-gray-50 border border-black/5">
                  <prop.icon className="w-6 h-6 text-black/20" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest">{prop.title}</p>
                    <p className="text-[9px] text-black/30 font-bold uppercase tracking-widest">{prop.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="w-full lg:w-[400px] shrink-0">
            <div className="bg-white border border-black/5 rounded-3xl p-8 sticky top-32 space-y-8 shadow-sm">
              <p className="text-sm font-bold heading-font uppercase tracking-tight">Order Summary</p>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-black/40">Subtotal</span>
                  <span className="text-black">${cartSubtotal.toFixed(0)}</span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                    <span>Discount ({appliedPromo?.code})</span>
                    <span>-${discountTotal.toFixed(0)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-black/40">Estimated Shipping</span>
                  <span className="text-black">
                    Calculated next
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-black/40">Tax</span>
                  <span className="text-black">Calculated next</span>
                </div>
                
                <div className="pt-4 border-t border-black/5 flex justify-between items-end">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Total</span>
                  <span className="text-3xl font-bold heading-font tracking-tight">
                    ${Math.max(0, cartSubtotal - discountTotal).toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Coupon input */}
              <div className="pt-6 border-t border-black/5 space-y-3">
                 <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="COUPON CODE" 
                      className="flex-1 bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-black transition-all"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                    />
                    <button 
                      onClick={handleApplyPromo}
                      disabled={!promoCodeInput || applying}
                      className="px-5 py-2.5 bg-black hover:bg-neutral-850 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 shrink-0"
                    >
                       {applying ? "..." : "Apply"}
                    </button>
                 </div>
                 {promoError && <p className="text-[9px] text-red-500 font-bold ml-1 uppercase tracking-widest">{promoError}</p>}
                 {appliedPromo && (
                   <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-100">
                      <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">Coupon {appliedPromo.code} Applied</span>
                      <button onClick={removePromoCode} className="text-[9px] font-bold text-emerald-600 hover:text-emerald-800 uppercase tracking-widest">Remove</button>
                   </div>
                 )}
              </div>

              <div className="space-y-4">
                <Link 
                  href="/checkout"
                  className="w-full bg-black text-white h-16 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 hover:bg-black/90 active:scale-[0.98] transition-all shadow-xl shadow-black/10"
                >
                  Proceed to Checkout
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <div className="flex items-center justify-center gap-4">
                  <Image src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" width={30} height={20} className="opacity-20 grayscale" />
                  <Image src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" width={30} height={20} className="opacity-20 grayscale" />
                  <Image src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="Paypal" width={40} height={20} className="opacity-20 grayscale" />
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
