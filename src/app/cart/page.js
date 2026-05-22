"use client";

import { useCart } from "@/context/CartContext";
import Image from "next/image";
import Link from "next/link";
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag, ShieldCheck, Truck, RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";

export default function CartPage() {
  const { cartItems, updateQuantity, removeFromCart, cartSubtotal } = useCart();
  const FREE_SHIPPING_THRESHOLD = 500;

  if (cartItems.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-8 px-6">
        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center">
          <ShoppingBag className="w-10 h-10 text-black/10" />
        </div>
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold heading-font uppercase tracking-tight">Your Bag is Empty</h1>
          <p className="text-black/40 text-sm max-w-xs mx-auto">Looks like you haven&apos;t added anything to your collection yet.</p>
        </div>
        <Link 
          href="/" 
          className="bg-black text-white px-12 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-black/90 transition-all active:scale-95"
        >
          Explore Collection
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
                <h1 className="text-4xl font-bold heading-font uppercase tracking-tight">Shopping Bag</h1>
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
                    className="flex flex-col sm:flex-row gap-8 py-6 border-b border-black/5 group"
                  >
                    {/* Image */}
                    <div className="relative w-full sm:w-40 aspect-[3/4] rounded-2xl overflow-hidden bg-gray-50 border border-black/5 shrink-0">
                      <Image 
                        src={item.image} 
                        alt={item.name} 
                        fill 
                        className="object-cover transition-transform duration-1000 group-hover:scale-105" 
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col justify-between py-2">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h3 className="text-xl font-bold heading-font uppercase tracking-tight">{item.name}</h3>
                            <div className="flex items-center gap-4">
                              <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest">Size: {item.selectedSize}</span>
                              <div className="w-[1px] h-3 bg-black/10" />
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-black/40 uppercase tracking-widest">Color:</span>
                                <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: item.selectedColor }} />
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => removeFromCart(uniqueKey)}
                            className="p-2 text-black/20 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-8 sm:mt-0">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-6 bg-gray-50 border border-black/5 rounded-xl px-4 py-2">
                          <button 
                            onClick={() => updateQuantity(uniqueKey, -1)}
                            className="text-black/30 hover:text-black transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(uniqueKey, 1)}
                            className="text-black/30 hover:text-black transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-2xl font-bold heading-font tracking-tight">${(item.price * item.quantity).toFixed(0)}</p>
                          <p className="text-[9px] font-bold text-black/20 uppercase tracking-widest mt-1">Free Shipping Eligible</p>
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
              <h2 className="text-xl font-bold heading-font uppercase tracking-tight">Order Summary</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-black/40">Subtotal</span>
                  <span className="text-black">${cartSubtotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-black/40">Estimated Shipping</span>
                  <span className="text-green-600">
                    {cartSubtotal >= FREE_SHIPPING_THRESHOLD ? "Complimentary" : "$45.00"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-black/40">Tax</span>
                  <span className="text-black">Calculated at checkout</span>
                </div>
                
                <div className="pt-4 border-t border-black/5 flex justify-between items-end">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Total</span>
                  <span className="text-3xl font-bold heading-font tracking-tight">
                    ${(cartSubtotal + (cartSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 45)).toFixed(0)}
                  </span>
                </div>
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

              {/* Shipping Progress inside Summary */}
              <div className="pt-6 border-t border-black/5 space-y-3">
                 <div className="flex justify-between items-center text-[8px] font-bold uppercase tracking-widest">
                    <span className="text-black/40">
                      {cartSubtotal >= FREE_SHIPPING_THRESHOLD 
                        ? "Free shipping unlocked" 
                        : `$${(FREE_SHIPPING_THRESHOLD - cartSubtotal).toFixed(0)} more for free shipping`}
                    </span>
                    <span className="text-black">{Math.min((cartSubtotal / FREE_SHIPPING_THRESHOLD) * 100, 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((cartSubtotal / FREE_SHIPPING_THRESHOLD) * 100, 100)}%` }}
                      className="h-full bg-black transition-all duration-1000"
                    />
                  </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
