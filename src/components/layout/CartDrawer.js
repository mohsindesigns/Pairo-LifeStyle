"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, ShoppingBag, ArrowRight, Trash2 } from "lucide-react";
import Image from "next/image";
import { useCart } from "@/context/CartContext";
import Link from "next/link";

export default function CartDrawer() {
  const { isCartOpen, setIsCartOpen, cartItems, updateQuantity, removeFromCart, cartSubtotal } = useCart();

  const FREE_SHIPPING_THRESHOLD = 500;
  const shippingProgress = Math.min((cartSubtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);

  const drawerVariants = {
    hidden: { x: "100%" },
    visible: { 
      x: 0, 
      transition: { 
        type: "spring", 
        damping: 30, 
        stiffness: 300,
        staggerChildren: 0.05,
        delayChildren: 0.1
      } 
    },
    exit: { x: "100%", transition: { type: "spring", damping: 30, stiffness: 300 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 }
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCartOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[100]"
          />

          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={drawerVariants}
            className="fixed right-0 top-0 h-full w-full max-w-[380px] bg-white z-[101] shadow-2xl flex flex-col"
          >
            {/* Header - Compact */}
            <div className="px-6 py-6 flex items-center justify-between border-b border-black/[0.03]">
              <div className="space-y-0.5">
                <h2 className="text-lg font-bold heading-font uppercase tracking-tight">Your Bag</h2>
                <p className="text-[8px] text-black/30 font-bold uppercase tracking-widest">
                  {cartItems.reduce((acc, item) => acc + item.quantity, 0)} Items
                </p>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-all active:scale-90"
              >
                <X className="w-4 h-4 text-black/40" />
              </button>
            </div>

            {/* Shipping Progress - Minimal */}
            {cartItems.length > 0 && (
              <div className="px-6 py-3 bg-black/[0.01] border-b border-black/[0.03]">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[7px] font-bold uppercase tracking-widest">
                    <span className="text-black/40">
                      {cartSubtotal >= FREE_SHIPPING_THRESHOLD 
                        ? "Free shipping unlocked" 
                        : `$${(FREE_SHIPPING_THRESHOLD - cartSubtotal).toFixed(0)} more for free shipping`}
                    </span>
                    <span className="text-black">{shippingProgress.toFixed(0)}%</span>
                  </div>
                  <div className="h-0.5 bg-black/[0.05] rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${shippingProgress}%` }}
                      className="h-full bg-black"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Cart Items - Tight Spacing */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-hide">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <ShoppingBag className="w-8 h-8 text-black/5" />
                  <p className="text-[9px] font-bold uppercase tracking-widest text-black/30">Your bag is empty</p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="text-[8px] font-bold uppercase tracking-[0.2em] underline underline-offset-4 hover:text-black/60"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                cartItems.map((item, idx) => {
                  const uniqueKey = `${item.id}-${item.selectedSize}-${item.selectedColor}`;
                  const itemImage = item.image || (Array.isArray(item.images) && item.images[0]) || "/placeholder.jpg";
                  return (
                    <motion.div
                      layout
                      variants={itemVariants}
                      key={uniqueKey + idx}
                      className="flex gap-4 relative group py-2"
                    >
                      <div className="relative w-16 h-22 rounded-lg overflow-hidden bg-black/[0.02] shrink-0 border border-black/5">
                        <Image
                          src={itemImage}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                      </div>

                      <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                        <div className="space-y-1">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="text-[11px] font-bold heading-font uppercase tracking-tight truncate">
                              {item.name}
                            </h3>
                            <button 
                               onClick={() => removeFromCart(uniqueKey)}
                               className="text-black/20 hover:text-red-500 transition-colors p-1"
                            >
                               <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] text-black/40 uppercase tracking-widest font-bold">
                              Size: {item.selectedSize}
                            </span>
                            <div className="w-[1px] h-2 bg-black/10" />
                            <div className="flex items-center gap-1.5">
                               <span className="text-[8px] text-black/40 uppercase tracking-widest font-bold">Color:</span>
                               <div 
                                 className="w-2.5 h-2.5 rounded-full border border-black/10" 
                                 style={{ backgroundColor: item.selectedColor }} 
                               />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-3 bg-[#F9F9F9] border border-black/[0.05] rounded-md px-2 py-1">
                            <button
                              onClick={() => updateQuantity(uniqueKey, -1)}
                              className="text-black/30 hover:text-black transition-colors"
                            >
                              <Minus className="w-2 h-2" />
                            </button>
                            <span className="text-[9px] font-bold w-3 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(uniqueKey, 1)}
                              className="text-black/30 hover:text-black transition-colors"
                            >
                              <Plus className="w-2 h-2" />
                            </button>
                          </div>
                          <p className="font-bold text-[11px] heading-font tracking-tight">${(item.price * item.quantity).toFixed(0)}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer - Professional & Compact */}
            {cartItems.length > 0 && (
              <div className="p-6 space-y-4 bg-white border-t border-black/[0.03]">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-black/30 uppercase tracking-widest font-bold text-[8px]">Subtotal</span>
                    <span className="text-base font-bold heading-font tracking-tight">${cartSubtotal.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-black/30 uppercase tracking-widest font-bold text-[8px]">Shipping</span>
                    <span className="text-[8px] font-bold text-black/60 uppercase tracking-widest">
                       {cartSubtotal >= FREE_SHIPPING_THRESHOLD ? "Complimentary" : "Calculated next"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Link 
                    href="/checkout"
                    onClick={() => setIsCartOpen(false)}
                    className="w-full bg-black text-white h-12 rounded-lg font-bold uppercase tracking-[0.2em] text-[9px] flex items-center justify-center gap-2 hover:bg-black/90 active:scale-[0.98] transition-all"
                  >
                    Checkout
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
