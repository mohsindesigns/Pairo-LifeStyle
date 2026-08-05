"use client";

import { useEffect, useState, use } from "react";
import { ArrowLeft, User as UserIcon, Package, Calendar, Mail, MapPin, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminPageLayout from "@/components/admin/AdminPageLayout";

export default function CustomerDetail({ params }) {
  const { id } = use(params);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const res = await fetch(`/api/admin/customers/${id}`);
        if (res.status === 403) {
          router.push("/admin?error=NoPermission");
          return;
        }
        if (res.status === 401) {
          router.push("/admin-login");
          return;
        }
        const data = await res.json();
        if (res.ok) setCustomer(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomer();
  }, [id, router]);

  if (loading) return <AdminPageLayout title="Loading Customer..."><div className="p-10 text-center italic text-gray-400">Loading details...</div></AdminPageLayout>;
  if (!customer) return <AdminPageLayout title="Error"><div className="p-10 text-center text-red-500 font-bold uppercase">Customer not found</div></AdminPageLayout>;

  return (
    <AdminPageLayout 
      title={customer.name} 
      breadcrumbs={[{ label: "Customers", href: "/admin/customers" }, { label: customer.name }]}
    >
      <div className="space-y-6">
         <div className="flex items-center gap-4 mb-2">
            <Link href="/admin/customers" className="text-[#2271b1] hover:text-[#135e96] flex items-center gap-1 text-[13px] font-medium">
               <ArrowLeft className="w-4 h-4" /> Back to Customers
            </Link>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sidebar: Profile Info */}
            <div className="space-y-6">
               <div className="bg-white border border-[#ccd0d4] p-6 shadow-sm">
                  <div className="flex flex-col items-center text-center pb-6 border-b border-[#f0f0f1]">
                     <div className="w-20 h-20 bg-gray-50 border border-gray-200 rounded-[2px] flex items-center justify-center text-[#8c8f94] mb-4">
                        <UserIcon className="w-10 h-10" />
                     </div>
                     <h2 className="text-xl font-bold text-[#1d2327] uppercase leading-tight">{customer.name}</h2>
                     <p className="text-[13px] text-[#646970] mt-1">{customer.email}</p>
                     <span className="mt-3 px-3 py-1 bg-[#f6f7f7] border border-[#ccd0d4] text-[11px] font-bold uppercase tracking-wider rounded-[2px]">
                        {customer.role || 'CUSTOMER'}
                     </span>
                  </div>

                  <div className="py-6 space-y-4">
                     <div className="flex items-start gap-3">
                        <Mail className="w-4 h-4 text-[#8c8f94] mt-0.5" />
                        <div>
                           <p className="text-[11px] font-bold text-[#1d2327] uppercase">Contact</p>
                           <p className="text-[13px] text-[#2271b1] hover:underline cursor-pointer">{customer.email}</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-3">
                        <Calendar className="w-4 h-4 text-[#8c8f94] mt-0.5" />
                        <div>
                           <p className="text-[11px] font-bold text-[#1d2327] uppercase">Customer Since</p>
                           <p className="text-[13px] text-[#3c434a]">{new Date(customer.createdAt).toLocaleDateString()}</p>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Addresses */}
               <div className="bg-white border border-[#ccd0d4] shadow-sm">
                  <div className="p-4 border-b border-[#ccd0d4] bg-[#f6f7f7]">
                     <h3 className="text-[13px] font-bold text-[#1d2327] uppercase tracking-wide">Saved Addresses</h3>
                  </div>
                  <div className="p-4 space-y-4">
                     {customer.addresses?.length === 0 ? (
                        <p className="text-[13px] text-gray-400 italic">No addresses saved.</p>
                     ) : (
                        customer.addresses?.map((addr, i) => (
                           <div key={i} className="p-3 bg-[#fbfbfb] border border-[#f0f0f1] rounded-[2px]">
                              <p className="text-[13px] font-bold text-[#3c434a]">{addr.fullName}</p>
                              <p className="text-[12px] text-[#646970] leading-relaxed">
                                 {addr.street}<br />
                                 {addr.city}, {addr.state} {addr.zipCode}<br />
                                 {addr.country}
                              </p>
                           </div>
                        ))
                     )}
                  </div>
               </div>
            </div>

            {/* Main Content: Order History */}
            <div className="lg:col-span-2 space-y-6">
               <div className="bg-white border border-[#ccd0d4] shadow-sm">
                  <div className="p-4 border-b border-[#ccd0d4] bg-[#f6f7f7] flex items-center justify-between">
                     <h3 className="text-[13px] font-bold text-[#1d2327] uppercase tracking-wide">Order History</h3>
                     <span className="text-[11px] font-bold text-[#646970] uppercase">{customer.orders?.length || 0} Total Orders</span>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left border-collapse text-[13px]">
                        <thead>
                           <tr className="border-b border-[#f0f0f1] text-[#646970]">
                              <th className="px-4 py-3 font-bold uppercase text-[11px]">Order #</th>
                              <th className="px-4 py-3 font-bold uppercase text-[11px]">Date</th>
                              <th className="px-4 py-3 font-bold uppercase text-[11px]">Status</th>
                              <th className="px-4 py-3 font-bold uppercase text-[11px] text-right">Total</th>
                              <th className="px-4 py-3 w-10"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0f0f1]">
                           {customer.orders?.length === 0 ? (
                              <tr><td colSpan={5} className="p-12 text-center italic text-gray-400">No orders placed by this customer yet.</td></tr>
                           ) : (
                              customer.orders?.map((order) => (
                                 <tr key={order.id} className="hover:bg-[#fbfbfb]">
                                    <td className="px-4 py-4">
                                       <Link href={`/admin/orders/${order.id}`} className="font-bold text-[#2271b1] hover:underline">
                                          #{order.orderNumber}
                                       </Link>
                                    </td>
                                    <td className="px-4 py-4 text-[#3c434a]">
                                       {new Date(order.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-4">
                                       <span className={`px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider ${
                                          order.status === 'Delivered' ? 'bg-[#c6e1c6] text-[#1e4620]' :
                                          order.status === 'Cancelled' ? 'bg-[#f8d7da] text-[#842029]' :
                                          'bg-[#d9ebf5] text-[#1a4a6e]'
                                       }`}>
                                          {order.status}
                                       </span>
                                    </td>
                                    <td className="px-4 py-4 text-right font-bold text-[#1d2327]">
                                       ${(order.financials?.total ?? 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                       <Link href={`/admin/orders/${order.id}`} className="text-[#8c8f94] hover:text-[#2271b1]">
                                          <ExternalLink className="w-4 h-4" />
                                       </Link>
                                    </td>
                                 </tr>
                              ))
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>

               {/* Detailed Item View */}
               {customer.orders?.length > 0 && (
                  <div className="bg-white border border-[#ccd0d4] shadow-sm">
                     <div className="p-4 border-b border-[#ccd0d4] bg-[#f6f7f7]">
                        <h3 className="text-[13px] font-bold text-[#1d2327] uppercase tracking-wide">Item Acquisition History</h3>
                     </div>
                     <div className="p-6 space-y-6">
                        {customer.orders.map((order) => (
                           <div key={order.id} className="space-y-4">
                              <div className="flex items-center gap-2 text-[11px] font-bold text-[#646970] uppercase">
                                 <Package className="w-3 h-3" /> 
                                 Order #{order.orderNumber} — {new Date(order.createdAt).toLocaleDateString()}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                 {order.items?.map((item, idx) => (
                                    <div key={idx} className="flex gap-4 p-3 border border-[#f0f0f1] rounded-[2px] bg-[#fbfbfb]">
                                       <div className="w-12 h-12 bg-gray-100 rounded-[2px] overflow-hidden flex-shrink-0">
                                          <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                                       </div>
                                       <div>
                                          <p className="text-[13px] font-bold text-[#1d2327] uppercase leading-tight">{item.name}</p>
                                          <p className="text-[11px] text-[#646970] mt-0.5">
                                             QTY: {item.quantity} | {item.selectedVariant?.title || 'Standard'}
                                          </p>
                                          <p className="text-[12px] font-bold text-[#3c434a] mt-1">${((item.priceAtPurchase || 0) * (item.quantity || 0)).toLocaleString()}</p>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                              <div className="h-px bg-[#f0f0f1] last:hidden" />
                           </div>
                        ))}
                     </div>
                  </div>
               )}
            </div>
         </div>
      </div>
    </AdminPageLayout>
  );
}
