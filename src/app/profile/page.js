"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { User, Package, CreditCard, LogOut, Shield, ChevronRight, ShoppingBag, Trash2, Plus, Edit2, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingInfo, setEditingInfo] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  
  const [infoForm, setInfoForm] = useState({ name: "", email: "" });
  const [addressForm, setAddressForm] = useState({ fullName: "", street: "", city: "", state: "", zipCode: "", country: "United States" });

  const router = useRouter();

  const fetchUserData = useCallback(async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setUserData(data);
        setInfoForm({ name: data.name, email: data.email });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (status === "unauthenticated") {
        router.push("/login");
      } else if (status === "authenticated") {
        fetchUserData();
      }
    });
  }, [status, router, fetchUserData]);

  const handleAction = async (action, data) => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data })
      });
      if (res.ok) {
        await fetchUserData();
        setEditingInfo(false);
        setShowAddressForm(false);
        if (action === "deleteAccount") signOut({ callbackUrl: "/" });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white font-medium">
        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !userData) return null;

  return (
    <div className="min-h-screen bg-white text-black font-medium">
      <div className="max-w-3xl mx-auto px-6 py-10 md:py-16">
        
        {/* Header - Medium Weight */}
        <div className="flex items-center justify-between mb-10 border-b border-black/5 pb-8">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gray-50 border border-black/5 rounded-full flex items-center justify-center text-2xl font-medium uppercase">
              {userData.name?.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-medium uppercase tracking-tight leading-none">{userData.name}</h1>
              <p className="text-sm font-medium text-black/30 uppercase tracking-[0.2em] mt-1">{userData.email}</p>
            </div>
          </div>
          <button 
            onClick={() => signOut({ callbackUrl: "/" })}
            className="px-6 py-2.5 bg-red-50 text-red-600 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-red-100 transition-all"
          >
            Sign Out
          </button>
        </div>

        {/* Stats Row - Medium Weight */}
        <div className="grid grid-cols-2 gap-4 mb-12">
          <div className="p-8 bg-black text-white rounded-3xl">
            <p className="text-[9px] text-white/40 uppercase tracking-[0.2em] mb-2 font-bold">Total Spent</p>
            <p className="text-4xl font-medium tracking-tighter">${userData.orderHistory?.reduce((acc, o) => acc + o.total, 0).toFixed(0)}</p>
          </div>
          <div className="p-8 bg-gray-50 border border-black/5 rounded-3xl">
            <p className="text-[9px] text-black/30 uppercase tracking-[0.2em] mb-2 font-bold">Orders</p>
            <p className="text-4xl font-medium tracking-tighter">{userData.orderHistory?.length || 0}</p>
          </div>
        </div>

        <div className="space-y-12">
          
          {/* Section: Profile */}
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-black/5 pb-3">
              <h2 className="text-[11px] uppercase tracking-[0.3em] text-black/30 font-bold">Account Information</h2>
              <button onClick={() => setEditingInfo(!editingInfo)} className="text-[10px] uppercase tracking-widest text-black font-bold hover:underline underline-offset-8">
                {editingInfo ? "Cancel" : "Edit Info"}
              </button>
            </div>
            
            {editingInfo ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input 
                  className="w-full bg-gray-50 border border-black/5 rounded-2xl p-4 text-sm font-medium" 
                  value={infoForm.name} 
                  onChange={(e) => setInfoForm({...infoForm, name: e.target.value})}
                  placeholder="Full Name"
                />
                <input 
                  className="w-full bg-gray-50 border border-black/5 rounded-2xl p-4 text-sm font-medium" 
                  value={infoForm.email} 
                  onChange={(e) => setInfoForm({...infoForm, email: e.target.value})}
                  placeholder="Email"
                />
                <button 
                  onClick={() => handleAction("updateInfo", infoForm)}
                  className="md:col-span-2 bg-black text-white py-4 rounded-2xl text-[10px] font-bold uppercase tracking-[0.3em]"
                >
                  Save Profile
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 pt-2">
                <div>
                  <p className="text-[9px] text-black/20 uppercase tracking-[0.2em] mb-2 font-bold">Display Name</p>
                  <p className="text-xl font-medium uppercase tracking-tight">{userData.name}</p>
                </div>
                <div>
                  <p className="text-[9px] text-black/20 uppercase tracking-[0.2em] mb-2 font-bold">Primary Email</p>
                  <p className="text-xl font-medium tracking-tight">{userData.email}</p>
                </div>
              </div>
            )}
          </section>

          {/* Section: Shipping */}
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-black/5 pb-3">
              <h2 className="text-[11px] uppercase tracking-[0.3em] text-black/30 font-bold">Shipping Details</h2>
              <button onClick={() => setShowAddressForm(!showAddressForm)} className="bg-black text-white px-5 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest">
                {showAddressForm ? "Cancel" : "Add Address"}
              </button>
            </div>

            <AnimatePresence>
              {showAddressForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-6">
                  <div className="p-6 bg-gray-50 rounded-3xl border border-black/5 grid grid-cols-2 gap-3">
                    <input placeholder="Full Name" className="col-span-2 p-4 rounded-2xl text-xs bg-white border border-black/5 font-medium" value={addressForm.fullName} onChange={e => setAddressForm({...addressForm, fullName: e.target.value})} />
                    <input placeholder="Street" className="col-span-2 p-4 rounded-2xl text-xs bg-white border border-black/5 font-medium" value={addressForm.street} onChange={e => setAddressForm({...addressForm, street: e.target.value})} />
                    <input placeholder="City" className="p-4 rounded-2xl text-xs bg-white border border-black/5 font-medium" value={addressForm.city} onChange={e => setAddressForm({...addressForm, city: e.target.value})} />
                    <input placeholder="Zip Code" className="p-4 rounded-2xl text-xs bg-white border border-black/5 font-medium" value={addressForm.zipCode} onChange={e => setAddressForm({...addressForm, zipCode: e.target.value})} />
                    <button onClick={() => handleAction("addAddress", addressForm)} className="col-span-2 bg-black text-white py-4 rounded-2xl text-[10px] font-bold uppercase tracking-[0.3em]">Save Location</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {userData.addresses?.length === 0 ? (
                <p className="text-[10px] text-black/20 uppercase tracking-widest text-center py-8 font-medium">No locations saved</p>
              ) : (
                userData.addresses.map((addr) => (
                  <div key={addr._id} className="p-6 bg-gray-50 border border-black/[0.03] rounded-3xl flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium uppercase mb-1">{addr.fullName}</p>
                      <p className="text-[11px] text-black/40 uppercase tracking-wider leading-relaxed font-medium">{addr.street}<br/>{addr.city}, {addr.zipCode}</p>
                    </div>
                    <button onClick={() => handleAction("deleteAddress", { id: addr._id })} className="text-black/10 hover:text-red-500 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Section: History */}
          <section className="space-y-6">
             <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <h2 className="text-[11px] uppercase tracking-[0.3em] text-black/30 font-bold">Recent History</h2>
             </div>
             {userData.orderHistory?.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-black/10 rounded-3xl">
                   <p className="text-[10px] text-black/20 uppercase tracking-widest font-medium">Your history is currently empty</p>
                </div>
             ) : (
                <div className="space-y-3">
                  {userData.orderHistory.map((order, i) => (
                    <div key={i} className="p-6 bg-gray-50/50 border border-black/[0.03] rounded-3xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <p className="text-sm font-medium uppercase tracking-tight opacity-40">#{order.orderNumber || i+1024}</p>
                          <span className={`text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                            order.status === 'Delivered' ? 'bg-green-100 text-green-700' : 
                            order.status === 'Cancelled' ? 'bg-red-50 text-red-400' :
                            'bg-black text-white'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <p className="text-sm font-medium uppercase tracking-widest opacity-20">{new Date(order.date).toLocaleDateString()}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex -space-x-2">
                          {(order.items || []).slice(0, 3).map((item, idx) => (
                            <div key={idx} className="w-8 h-8 rounded-full border border-white bg-gray-200 overflow-hidden">
                              <img src={item.image} className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {order.items?.length > 3 && (
                            <div className="w-8 h-8 rounded-full border border-white bg-black text-white text-[8px] flex items-center justify-center">
                              +{order.items.length - 3}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-medium tracking-tighter">${order.total.toFixed(0)}</p>
                          {['Pending', 'Confirmed', 'Processing'].includes(order.status) && (
                            <button 
                              onClick={() => handleAction("cancelOrder", { orderId: order.id })}
                              className="text-[9px] font-bold text-red-500 uppercase tracking-widest hover:underline mt-1"
                            >
                              Request Cancellation
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
             )}
          </section>

          {/* Minimal Actions */}
          <div className="flex flex-col items-center pt-12 border-t border-black/5 space-y-6">
            <button 
              onClick={() => handleAction("deleteAccount")}
              className="text-[10px] text-black/30 hover:text-red-500 uppercase tracking-[0.4em] font-medium transition-colors"
            >
              Delete Profile Account
            </button>
            <div className="w-1 h-1 bg-black/10 rounded-full" />
            <p className="text-[8px] text-black/10 uppercase tracking-[0.6em] font-medium">PAIRO COLLECTION</p>
          </div>

        </div>
      </div>
    </div>
  );
}
