"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Package, Calendar, Mail } from "lucide-react";
import { motion } from "framer-motion";

export default function SuccessPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [orderDate, setOrderDate] = useState("");

  useEffect(() => {
    Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      const orderNum = params.get("orderNumber");
      if (orderNum) {
        setOrderNumber(orderNum);
      } else {
        setOrderNumber("PAI-" + Math.random().toString(36).substring(2, 11).toUpperCase());
      }
      setOrderDate(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
    });
  }, []);

  return (
    <div className="bg-white min-h-[90vh] text-black font-sans selection:bg-black selection:text-white flex items-center justify-center py-12 px-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }} 
        animate={{ opacity: 1, scale: 1 }} 
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-xl w-full text-center space-y-8"
      >
        <div className="flex justify-center">
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            transition={{ delay: 0.2, type: "spring", damping: 15 }}
            className="w-16 h-16 bg-black rounded-full flex items-center justify-center"
          >
            <CheckCircle2 className="w-8 h-8 text-white" />
          </motion.div>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight uppercase">Thank You</h1>
          <p className="text-black/40 text-[10px] font-bold uppercase tracking-[0.2em]">Your order has been confirmed.</p>
        </div>

        <div className="bg-gray-50 rounded-3xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 text-left border border-black/[0.03]">
           <div className="space-y-5">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-black/[0.05]"><Package className="w-4 h-4 text-black/40" /></div>
                 <div>
                    <p className="text-[8px] font-bold text-black/30 uppercase tracking-widest">Order Number</p>
                    <p className="text-xs font-bold tracking-tight">{orderNumber ? `#${orderNumber}` : "..."}</p>
                 </div>
              </div>
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-black/[0.05]"><Calendar className="w-4 h-4 text-black/40" /></div>
                 <div>
                    <p className="text-[8px] font-bold text-black/30 uppercase tracking-widest">Order Date</p>
                    <p className="text-xs font-bold tracking-tight">{orderDate || "..."}</p>
                 </div>
              </div>
           </div>
           <div className="space-y-5">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-black/[0.05]"><Mail className="w-4 h-4 text-black/40" /></div>
                 <div>
                    <p className="text-[8px] font-bold text-black/30 uppercase tracking-widest">Confirmation</p>
                    <p className="text-xs font-bold tracking-tight">Sent to your email</p>
                 </div>
              </div>
              <div className="p-4 bg-black text-white rounded-xl">
                 <p className="text-[7px] font-bold uppercase tracking-widest opacity-40 mb-1">Standard Shipping</p>
                 <p className="text-[9px] font-bold uppercase tracking-widest">Delivery in 5-7 Days</p>
              </div>
           </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-2">
           <Link href="/shop" className="group bg-black text-white px-8 py-4 rounded-full font-bold text-[10px] uppercase tracking-[0.2em] shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center gap-2">
              Continue Shopping <ArrowRight className="w-3.5 h-3.5" />
           </Link>
           <Link href="/" className="text-[9px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors py-2">
              Return Home
           </Link>
        </div>
      </motion.div>
    </div>
  );
}
