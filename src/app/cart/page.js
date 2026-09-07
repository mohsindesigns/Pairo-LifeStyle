"use client";

import { useCart } from "@/context/CartContext";
import Image from "next/image";
import Link from "next/link";
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag, ShieldCheck, Truck, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { getProductUrl } from "@/lib/routes";

export default function CartPage() {
  const { 
    cartItems, 
    updateQuantity, 
    removeFromCart, 
    cartSubtotal, 
    appliedPromo, 
    discountTotal, 
    applyPromoCode, 
    removePromoCode,
    isCartLoaded
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

  if (!isCartLoaded) {
    return (
      <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
        <div className="container mx-auto px-2 sm:px-4 md:px-8 py-8 md:py-16">
          {/* Header Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-neutral-200 pb-6 mb-8 md:mb-12">
            <div className="space-y-2">
              <div className="w-48 h-8 bg-neutral-100 animate-pulse rounded-[4px]" />
              <div className="w-32 h-4 bg-neutral-100 animate-pulse rounded-[4px]" />
            </div>
            <div className="w-28 h-4 bg-neutral-100 animate-pulse rounded-[4px] mt-4 sm:mt-0" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column Skeleton */}
            <div className="lg:col-span-8 space-y-6">
              <div className="hidden md:grid grid-cols-12 border-b border-black/5 pb-3">
                <div className="col-span-7"><div className="w-16 h-3 bg-neutral-100 animate-pulse rounded-[2px]" /></div>
                <div className="col-span-3"><div className="w-16 h-3 bg-neutral-100 animate-pulse rounded-[2px] mx-auto" /></div>
                <div className="col-span-2"><div className="w-16 h-3 bg-neutral-100 animate-pulse rounded-[2px] ml-auto" /></div>
              </div>

              <div className="divide-y divide-black/5">
                {[1, 2].map((i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 items-center first:pt-0">
                    <div className="col-span-1 md:col-span-7 flex gap-4 sm:gap-6 min-w-0">
                      <div className="w-16 sm:w-20 aspect-[3/4] rounded-lg bg-neutral-100 animate-pulse shrink-0 border border-black/5" />
                      <div className="flex-1 flex flex-col justify-center min-w-0 space-y-2">
                        <div className="w-3/4 h-4 bg-neutral-100 animate-pulse rounded-[4px]" />
                        <div className="w-1/2 h-3 bg-neutral-100 animate-pulse rounded-[4px]" />
                        <div className="w-1/4 h-3 bg-neutral-100 animate-pulse rounded-[4px]" />
                      </div>
                    </div>
                    <div className="col-span-1 md:col-span-3 flex justify-start md:justify-center">
                      <div className="w-24 h-9 bg-neutral-100 animate-pulse rounded-[4px]" />
                    </div>
                    <div className="col-span-1 md:col-span-2 text-left md:text-right">
                      <div className="w-16 h-4 bg-neutral-100 animate-pulse rounded-[4px] md:ml-auto" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column Skeleton */}
            <div className="lg:col-span-4 bg-[#FAF9F6] border border-black/[0.04] rounded-[4px] p-6 md:p-8 space-y-6">
              <div className="w-24 h-4 bg-neutral-200/60 animate-pulse rounded-[4px]" />
              <div className="space-y-4 pt-2">
                <div className="flex justify-between"><div className="w-16 h-3 bg-neutral-200/60 animate-pulse rounded-[2px]" /><div className="w-12 h-3 bg-neutral-200/60 animate-pulse rounded-[2px]" /></div>
                <div className="flex justify-between"><div className="w-16 h-3 bg-neutral-200/60 animate-pulse rounded-[2px]" /><div className="w-20 h-3 bg-neutral-200/60 animate-pulse rounded-[2px]" /></div>
                <div className="flex justify-between"><div className="w-16 h-3 bg-neutral-200/60 animate-pulse rounded-[2px]" /><div className="w-20 h-3 bg-neutral-200/60 animate-pulse rounded-[2px]" /></div>
                <div className="pt-4 border-t border-neutral-200 flex justify-between"><div className="w-24 h-4 bg-neutral-200/60 animate-pulse rounded-[4px]" /><div className="w-16 h-6 bg-neutral-200/60 animate-pulse rounded-[4px]" /></div>
              </div>
              <div className="w-full h-10 bg-neutral-200/60 animate-pulse rounded-[4px]" />
              <div className="w-full h-12 bg-neutral-200/60 animate-pulse rounded-[4px] pt-2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-8 px-4 relative overflow-hidden bg-white">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-black/[0.02] rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative w-20 h-20 bg-black/5 rounded-full flex items-center justify-center shadow-sm">
          <ShoppingBag className="w-8 h-8 text-black/60" />
        </div>

        <div className="text-center space-y-3 max-w-sm relative z-10">
          <p className="text-lg md:text-xl font-bold uppercase tracking-wider text-black">Your cart is empty</p>
          <p className="text-black/60 text-xs md:text-sm leading-relaxed max-w-xs mx-auto">
            Fill it with handcrafted masterworks and premium shearlings.
          </p>
        </div>

        <Link 
          href="/" 
          className="group relative overflow-hidden bg-black text-white px-8 py-3.5 rounded-full font-bold text-[10px] md:text-xs uppercase tracking-[0.2em] transition-all duration-300 shadow-md hover:opacity-90 flex items-center gap-2 z-10 cursor-pointer"
        >
          <span className="relative z-10">Continue Shopping</span>
          <ArrowRight className="w-3.5 h-3.5 relative z-10 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      {/* Matches site header/footer margins exactly */}
      <div className="container mx-auto px-2 sm:px-4 md:px-8 py-8 md:py-16">
        
        {/* Shopify-style Cart Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-neutral-200 pb-6 mb-8 md:mb-12">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-extrabold uppercase tracking-wider text-black">Your Cart</h1>
            <p className="text-xs text-black/60 font-semibold">
              {cartItems.reduce((acc, item) => acc + item.quantity, 0)} {cartItems.reduce((acc, item) => acc + item.quantity, 0) === 1 ? "item" : "items"} inside your cart
            </p>
          </div>
          <Link 
            href="/shop" 
            className="text-[11px] font-bold uppercase tracking-widest text-black hover:opacity-75 border-b border-black/20 hover:border-black transition-all pb-1 mt-4 sm:mt-0 w-fit"
          >
            Continue Shopping
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Left Column: Cart Items Table List (65% / 8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Header row labels */}
            <div className="hidden md:grid grid-cols-12 border-b border-black/5 pb-3 text-[10px] font-bold uppercase tracking-wider text-black/60">
              <div className="col-span-7">Product</div>
              <div className="col-span-3 text-center">Quantity</div>
              <div className="col-span-2 text-right">Total</div>
            </div>

            <div className="divide-y divide-black/5">
              {cartItems.map((item, idx) => {
                const uniqueKey = `${item.id}-${item.selectedSize}-${item.selectedColor}`;
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={uniqueKey + idx}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 items-center first:pt-0"
                  >
                    {/* Product Info Block (Col span 7) */}
                    <div className="col-span-1 md:col-span-7 flex gap-4 sm:gap-6 min-w-0">
                      
                      {/* Image */}
                      <Link 
                        href={getProductUrl(item)} 
                        className="relative w-16 sm:w-20 aspect-[3/4] rounded-lg overflow-hidden bg-neutral-50 border border-black/5 shrink-0 shadow-sm block hover:opacity-85 transition-opacity"
                        title={item.name}
                      >
                        <img 
                          src={item.image || "/placeholder.jpg"} 
                          alt={item.name} 
                          className="w-full h-full object-cover" 
                        />
                      </Link>

                      {/* Details */}
                      <div className="flex-1 flex flex-col justify-center min-w-0 space-y-1.5">
                        <Link 
                          href={getProductUrl(item)} 
                          className="text-[13px] sm:text-[14px] font-bold text-black uppercase tracking-wide truncate hover:underline hover:text-black/80 transition-all block"
                          title={item.name}
                        >
                          {item.name}
                        </Link>
                        
                        {/* Selected Options (Size & Color) */}
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-black font-bold uppercase tracking-wider">
                          {item.selectedSize && item.selectedSize !== "Standard" && item.selectedSize !== "" && (
                            <span>Size: {item.selectedSize}</span>
                          )}
                          
                          {item.selectedSize && item.selectedSize !== "Standard" && item.selectedSize !== "" && item.selectedColor && item.selectedColor !== "Standard" && item.selectedColor !== "" && (
                            <span className="text-black/10">•</span>
                          )}

                          {item.selectedColor && item.selectedColor !== "Standard" && item.selectedColor !== "" && (
                            <div className="flex items-center gap-1.5">
                              <span>Color:</span>
                              <div className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: item.selectedColor }} />
                            </div>
                          )}
                        </div>

                        {/* Made to Measure Label */}
                        {item.madeToMeasure?.enabled && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-[9px] font-bold uppercase tracking-wide w-fit">
                            ✦ Made to Measure
                          </div>
                        )}

                        <button 
                          onClick={() => removeFromCart(uniqueKey)}
                          className="text-[10px] font-bold text-black/60 hover:text-red-500 transition-colors uppercase tracking-wider w-fit text-left pt-1 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Quantity Controls (Col span 3) */}
                    <div className="col-span-1 md:col-span-3 flex justify-start md:justify-center">
                      <div className="flex items-center gap-4 bg-white border border-neutral-300 rounded-[4px] px-3 py-1.5 w-fit">
                        <button 
                          onClick={() => updateQuantity(uniqueKey, -1)}
                          className="text-black/60 hover:text-black transition-colors p-0.5 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-bold text-[13px] w-6 text-center text-black font-mono">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(uniqueKey, 1)}
                          className="text-black/60 hover:text-black transition-colors p-0.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Total (Col span 2) */}
                    <div className="col-span-1 md:col-span-2 text-left md:text-right">
                      <p className="text-[14px] sm:text-[15px] font-bold text-black font-mono">
                        ${(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>

                  </motion.div>
                );
              })}
            </div>

            {/* Shopify-style Trust Badges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8 border-t border-black/5">
              {[
                { icon: ShieldCheck, title: "Secure Checkout", desc: "100% Encrypted Transactions" },
                { icon: Truck, title: "Reliable Shipping", desc: "Tracked Worldwide Delivery" },
                { icon: Sparkles, title: "Artisanal Care", desc: "Handcrafted to Order" }
              ].map((prop, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-[4px] bg-[#FAF9F6]/40 border border-black/[0.03]">
                  <prop.icon className="w-5 h-5 text-black/70 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-black">{prop.title}</p>
                    <p className="text-[9px] text-black/80 font-bold uppercase tracking-wider">{prop.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Order Summary Sidebar (35% / 4 Cols) - STICKY */}
          <div className="lg:col-span-4 bg-[#FAF9F6] border border-black/[0.04] rounded-[4px] p-6 md:p-8 space-y-6 lg:sticky lg:top-28 self-start">
            <h2 className="text-xs font-bold uppercase tracking-wider text-black">Order Summary</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center text-[12px] font-bold uppercase tracking-wider">
                <span className="text-black/80">Subtotal</span>
                <span className="text-black font-mono">${(cartSubtotal || 0).toLocaleString()}</span>
              </div>
              
              {discountTotal > 0 && (
                <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-black">
                  <span>Discount ({appliedPromo?.code})</span>
                  <span className="font-mono">-${discountTotal.toLocaleString()}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center text-[11px] font-bold text-black/60 uppercase tracking-wider">
                <span>Shipping</span>
                <span>Calculated next</span>
              </div>
              <div className="flex justify-between items-center text-[11px] font-bold text-black/60 uppercase tracking-wider">
                <span>Estimated Tax</span>
                <span>Calculated next</span>
              </div>
              
              <div className="pt-4 border-t border-neutral-200 flex justify-between items-end">
                <span className="text-xs font-bold uppercase tracking-wider text-black">Estimated Total</span>
                <span className="text-2xl font-black text-black font-mono">
                  ${Math.max(0, cartSubtotal - discountTotal).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Coupon Code Input */}
            <div className="pt-5 border-t border-neutral-200 space-y-2">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Discount code" 
                  className="flex-1 bg-white border border-neutral-300 rounded-[4px] px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider outline-none focus:border-black placeholder:text-neutral-400 text-black transition-all"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                />
                <button 
                  onClick={handleApplyPromo}
                  disabled={!promoCodeInput || applying}
                  className="px-5 py-2.5 bg-neutral-800 text-white hover:bg-black rounded-[4px] text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                >
                   {applying ? "..." : "Apply"}
                </button>
              </div>
              {promoError && <p className="text-[10px] text-red-600 font-bold ml-1 uppercase tracking-wider">{promoError}</p>}
              {appliedPromo && (
                <div className="flex items-center justify-between px-3 py-2 bg-[#FAF9F6] rounded border border-neutral-200">
                   <span className="text-[9px] font-bold text-black uppercase tracking-wider">Discount {appliedPromo.code} Applied</span>
                   <button onClick={removePromoCode} className="text-[9px] font-bold text-black hover:underline uppercase tracking-wider">Remove</button>
                </div>
              )}
            </div>

            {/* Checkout Action */}
            <div className="pt-2">
              <Link 
                href="/checkout"
                className="w-full bg-black text-white h-12 rounded-[4px] text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-900 transition-all shadow-sm cursor-pointer"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-center text-[10px] text-black/60 mt-3.5 leading-relaxed font-medium">
                Taxes and shipping calculated at checkout.
              </p>
            </div>

          </div>
          
        </div>
      </div>
    </div>
  );
}
