"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  FileText, 
  Package, 
  MessageSquare, 
  ShoppingBag, 
  ChevronRight, 
  ExternalLink,
  Plus,
  Settings,
  HelpCircle,
  Clock,
  ArrowRight,
  Image as ImageIcon,
  TrendingUp,
  Bell
} from "lucide-react";

// ── WordPress-Style Meta Box ───────────────────────────────
function MetaBox({ title, children, footer, className = "" }) {
  return (
    <div className={`bg-white border border-[#c3c4c7] shadow-sm mb-5 ${className}`}>
      {title && (
        <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-[#1d2327]">{title}</h2>
          <button className="text-gray-400 hover:text-gray-600">
            <ChevronRight className="w-4 h-4 rotate-90" />
          </button>
        </div>
      )}
      <div className="p-3 xs:p-4">
        {children}
      </div>
      {footer && (
        <div className="bg-[#f6f7f7] border-t border-[#c3c4c7] px-3 py-2">
          {footer}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────
export default function AdminDashboard() {
  const [stats, setStats] = useState({
    products: 0,
    posts: 0,
    orders: 0,
    revenue: 0,
    recentOrders: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          const d = json.data;
          setStats({
            products: d.totalProducts || 0,
            posts: d.totalBlogs || 0,
            orders: d.overall?.[0]?.totalOrders || 0,
            revenue: d.overall?.[0]?.totalSales || 0,
            recentOrders: d.recentOrders || []
          });
        }
        setLoading(false);
      });
  }, []);

  return (
    <div className="font-sans text-[#3c434a] bg-[#f0f2f1] min-h-screen p-2 xs:p-3 sm:p-4 md:p-6 w-full max-w-full overflow-hidden">
      <div className="w-full">
        <div className="flex justify-between items-center mb-4 xs:mb-6">
          <h1 className="text-[18px] xs:text-[20px] sm:text-[23px] font-medium text-[#1d2327]">Dashboard Overview</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 xs:gap-5 items-start">
          
          {/* Left Column (Primary) */}
          <div className="lg:col-span-3 min-w-0">
            
            {/* At a Glance */}
            <MetaBox title="At a Glance">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4">
                 <div className="space-y-4">
                    <Link href="/admin/blogs" className="flex items-center gap-2 group">
                       <FileText className="w-4 h-4 text-gray-400 group-hover:text-[#2271b1] shrink-0" />
                       <span className="text-[13px] text-[#2271b1] hover:underline font-medium">{stats.posts} Posts</span>
                    </Link>
                    <Link href="/admin/media" className="flex items-center gap-2 group">
                       <ImageIcon className="w-4 h-4 text-gray-400 group-hover:text-[#2271b1] shrink-0" />
                       <span className="text-[13px] text-[#2271b1] hover:underline font-medium">Media Library</span>
                    </Link>
                 </div>
                 <div className="space-y-4">
                    <Link href="/admin/products" className="flex items-center gap-2 group">
                       <Package className="w-4 h-4 text-gray-400 group-hover:text-[#2271b1] shrink-0" />
                       <span className="text-[13px] text-[#2271b1] hover:underline font-medium">{stats.products} Products</span>
                    </Link>
                    <div className="flex items-center gap-2">
                       <MessageSquare className="w-4 h-4 text-gray-400 shrink-0" />
                       <span className="text-[13px] text-gray-600">0 Comments</span>
                    </div>
                 </div>
              </div>
              <div className="mt-6 pt-4 border-t border-[#f0f0f1] text-[12px] xs:text-[13px] text-gray-500 italic">
                 Pairo v1.0.0 running Modern Theme.
              </div>
            </MetaBox>

            {/* Activity */}
            <MetaBox title="Recent Activity">
               <div className="space-y-4">
                  {loading ? (
                    <p className="text-[13px] text-gray-400 italic">Loading activity...</p>
                  ) : stats.recentOrders.length === 0 ? (
                    <p className="text-[13px] text-gray-400 italic">No recent activity found.</p>
                  ) : (
                    <div className="divide-y divide-[#f0f0f1]">
                       {stats.recentOrders.map((order, idx) => (
                          <div key={idx} className="py-3 first:pt-0 last:pb-0 flex flex-col xs:flex-row xs:items-center justify-between gap-1 xs:gap-2 group">
                             <div className="flex items-start gap-2.5 min-w-0">
                                <div className="mt-1 shrink-0">
                                   <div className="w-2 h-2 rounded-full bg-[#2271b1]" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                   <Link href={`/admin/orders/${order._id}`} className="text-[13px] font-bold text-[#2271b1] group-hover:underline truncate">
                                      Order #{order.orderNumber}
                                   </Link>
                                   <span className="text-[11px] xs:text-[12px] text-gray-500 truncate">by {order.shippingAddress?.fullName}</span>
                                </div>
                             </div>
                             <span className="text-[11px] text-gray-400 font-mono shrink-0 pl-4 xs:pl-0">{new Date(order.createdAt).toLocaleDateString()}</span>
                          </div>
                       ))}
                    </div>
                  )}
               </div>
            </MetaBox>

          </div>

          {/* Right Column (Secondary) */}
          <div className="lg:col-span-2 space-y-4 xs:space-y-5 min-w-0">
             
             {/* WooCommerce Status */}
             <MetaBox title="WooCommerce Status">
                <div className="space-y-4 xs:space-y-6">
                   <div className="flex items-center justify-between border-b border-[#f0f0f1] pb-3">
                      <div className="flex flex-col">
                         <span className="text-[11px] xs:text-[12px] text-gray-500 uppercase font-bold tracking-wider">Net Sales</span>
                         <span className="text-[20px] xs:text-[24px] font-light text-[#1d2327]">${stats.revenue.toLocaleString()}</span>
                      </div>
                      <TrendingUp className="w-7 h-7 xs:w-8 xs:h-8 text-[#00a32a] opacity-20 shrink-0" />
                   </div>
                   
                   <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 xs:gap-4">
                      <div className="bg-[#f6f7f7] p-2.5 xs:p-3 rounded-[2px] border border-[#ccd0d4]">
                         <span className="text-[11px] text-gray-500 block mb-1">Orders</span>
                         <span className="text-[16px] xs:text-[18px] font-bold text-[#1d2327]">{stats.orders}</span>
                      </div>
                      <div className="bg-[#f6f7f7] p-2.5 xs:p-3 rounded-[2px] border border-[#ccd0d4]">
                         <span className="text-[11px] text-gray-500 block mb-1">Awaiting Processing</span>
                         <span className="text-[16px] xs:text-[18px] font-bold text-[#d63638]">0</span>
                      </div>
                   </div>

                   <Link href="/admin/orders" className="text-[12px] xs:text-[13px] text-[#2271b1] hover:underline flex items-center gap-1 font-medium">
                      View all orders <ArrowRight className="w-3 h-3" />
                   </Link>
                </div>
             </MetaBox>

             {/* Quick Links */}
             <MetaBox title="Quick Links">
                <div className="grid grid-cols-1 gap-2">
                   {[
                      { label: "Site Settings", href: "/admin/settings", icon: Settings },
                      { label: "E-commerce Support", href: "#", icon: HelpCircle },
                      { label: "View Storefront", href: "/", icon: ExternalLink },
                   ].map((item, i) => (
                      <Link key={i} href={item.href} className="flex items-center justify-between p-2 hover:bg-[#f6f7f7] rounded-[2px] transition-colors group">
                         <div className="flex items-center gap-3">
                            <item.icon className="w-4 h-4 text-gray-400 group-hover:text-[#2271b1]" />
                            <span className="text-[13px] text-[#2271b1] font-medium">{item.label}</span>
                         </div>
                         <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-[#2271b1]" />
                      </Link>
                   ))}
                </div>
             </MetaBox>

             {/* Dashboard Widgets Help */}
             <div className="text-[12px] text-gray-500 px-2 flex items-center gap-2">
                <HelpCircle className="w-3 h-3" />
                <span>Learn more about <button className="text-[#2271b1] hover:underline">Dashboard Widgets</button></span>
             </div>

          </div>

        </div>
      </div>
    </div>
  );
}
