"use client";

import { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  ChevronRight, 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  ArrowLeft 
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function ProfileOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch("/api/profile/orders");
        const data = await res.json();
        if (data.success) setOrders(data.orders);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Delivered': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'Shipped': return <Truck className="w-4 h-4 text-blue-500" />;
      case 'Cancelled': return <Clock className="w-4 h-4 text-red-500" />;
      default: return <Package className="w-4 h-4 text-yellow-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-white pb-32">
      <div className="container mx-auto px-6 md:px-16 pt-32 pb-20">
        <div className="max-w-4xl mx-auto space-y-12">
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-4xl font-bold tracking-tight uppercase">My Orders</h1>
              <p className="text-[10px] font-bold text-black/30 uppercase tracking-[0.2em]">Track your acquisitions and history</p>
            </div>
            <Link href="/profile" className="p-3 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
               <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>

          <div className="space-y-6">
            {loading ? (
               Array(3).fill(0).map((_, i) => (
                 <div key={i} className="h-32 bg-gray-50 rounded-3xl animate-pulse" />
               ))
            ) : orders.length === 0 ? (
               <div className="text-center py-20 bg-gray-50 rounded-[3rem] space-y-6">
                  <ShoppingBag className="w-12 h-12 text-black/10 mx-auto" />
                  <div className="space-y-2">
                     <p className="text-sm font-bold uppercase tracking-widest">No orders yet</p>
                     <p className="text-xs text-black/40">You haven&apos;t made any acquisitions yet.</p>
                  </div>
                  <Link href="/shop" className="inline-block bg-black text-white px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-black/90 transition-all">
                     Start Shopping
                  </Link>
               </div>
            ) : (
               orders.map((order) => (
                 <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={order._id}
                    className="bg-white border border-black/5 rounded-[2rem] p-8 hover:border-black/10 transition-all group"
                 >
                    <div className="flex flex-col md:flex-row justify-between gap-8">
                       <div className="space-y-6 flex-1">
                          <div className="flex items-center gap-4">
                             <div className="px-3 py-1 bg-black text-white text-[9px] font-bold tracking-widest rounded-full uppercase">
                                {order.orderNumber}
                             </div>
                             <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black/40">
                                {getStatusIcon(order.status)}
                                {order.status}
                             </div>
                          </div>

                          <div className="flex -space-x-4 overflow-hidden">
                             {order.items.slice(0, 4).map((item, i) => (
                               <div key={i} className="relative w-16 h-20 rounded-xl overflow-hidden border-2 border-white bg-gray-100 shadow-sm">
                                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                               </div>
                             ))}
                             {order.items.length > 4 && (
                               <div className="relative w-16 h-20 rounded-xl bg-gray-900 border-2 border-white flex items-center justify-center text-white text-[10px] font-bold">
                                  +{order.items.length - 4}
                               </div>
                             )}
                          </div>
                       </div>

                       <div className="flex flex-col justify-between items-end text-right">
                          <div className="space-y-1">
                             <p className="text-[9px] font-bold text-black/30 uppercase tracking-widest">Ordered On</p>
                             <p className="text-sm font-bold">{new Date(order.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="space-y-1 mt-6">
                             <p className="text-[9px] font-bold text-black/30 uppercase tracking-widest">Total Amount</p>
                             <p className="text-2xl font-bold tracking-tight">${order.financials.total.toLocaleString()}</p>
                          </div>
                          <Link 
                            href={`/profile/orders/${order._id}`}
                            className="mt-6 flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest hover:gap-4 transition-all group"
                          >
                             View Details <ChevronRight className="w-4 h-4" />
                          </Link>
                       </div>
                    </div>
                 </motion.div>
               ))
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
