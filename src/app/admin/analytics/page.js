"use client";

import { useState, useEffect } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Package, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronLeft
} from "lucide-react";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/AdminPageLayout";

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/admin/analytics");
        const data = await res.json();
        if (data.success) setStats(data.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <AdminPageLayout title="Store Analytics" breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Analytics" }]}>
        <div className="p-20 text-center text-[13px] text-gray-500 italic bg-white border border-[#ccd0d4]">Analyzing store data...</div>
      </AdminPageLayout>
    );
  }

  if (!stats) {
    return (
      <AdminPageLayout title="Store Analytics" breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Analytics" }]}>
        <div className="p-20 text-center text-[13px] text-red-500 font-bold bg-white border border-[#ccd0d4]">Failed to load analytics.</div>
      </AdminPageLayout>
    );
  }

  const overall = stats.overall[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 };
  const last30 = stats.last30Days[0] || { revenue: 0, count: 0 };

  return (
    <AdminPageLayout 
      title="Store Analytics" 
      breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Analytics" }]}
    >
      <div className="space-y-6 sm:space-y-8">
        
        {/* Metric Cards */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {[
            { label: 'Total Revenue', value: `$${overall.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-600' },
            { label: 'Total Orders', value: overall.totalOrders, icon: Package, color: 'text-[#2271b1]' },
            { label: 'Avg Order Value', value: `$${Math.round(overall.avgOrderValue || 0).toLocaleString()}`, icon: TrendingUp, color: 'text-orange-500' },
            { label: 'Last 30 Days Sales', value: `$${last30.revenue.toLocaleString()}`, icon: Users, color: 'text-purple-500' },
          ].map((item, i) => (
            <div key={i} className="bg-white border border-[#ccd0d4] p-3.5 sm:p-6 shadow-sm rounded-[2px]">
               <div className="flex justify-between items-start mb-3 sm:mb-4">
                  <div className={`p-1.5 sm:p-2 bg-gray-50 rounded-[3px] ${item.color}`}>
                     <item.icon className="w-4 sm:w-5 h-4 sm:h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-green-500 flex items-center">
                    <ArrowUpRight className="w-3 h-3" /> 12%
                  </span>
               </div>
               <p className="text-[10px] sm:text-[11px] font-bold text-[#646970] uppercase tracking-widest mb-1 truncate">{item.label}</p>
               <p className="text-lg sm:text-2xl font-bold tracking-tight text-[#1d2327] truncate">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-start">
           
           {/* Sales Chart */}
           <div className="lg:col-span-8 bg-white border border-[#ccd0d4] shadow-sm overflow-hidden rounded-[2px]">
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#ccd0d4] bg-[#f6f7f7] flex justify-between items-center gap-2">
                 <h2 className="text-[13px] sm:text-[14px] font-bold text-[#1d2327]">Sales Performance (Last 30 Days)</h2>
                 <span className="text-[10px] sm:text-[11px] text-[#646970] shrink-0">Daily Trend</span>
              </div>
              <div className="p-3 sm:p-6">
                 <div className="h-48 sm:h-64 flex items-end justify-between gap-1 border-b border-[#ccd0d4] pb-2">
                    {stats.salesByDay.map((day, i) => {
                      const maxRevenue = Math.max(...stats.salesByDay.map(d => d.revenue)) || 1;
                      const height = (day.revenue / maxRevenue) * 100;
                      return (
                        <div key={i} className="group relative flex-1">
                           <div 
                              className="bg-[#2271b1] hover:bg-[#135e96] transition-all rounded-t-[2px]" 
                              style={{ height: `${Math.max(height, 5)}%` }} 
                           />
                           {/* Tooltip */}
                           <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[#1d2327] text-white text-[9px] font-bold p-2 rounded shadow-xl z-20 whitespace-nowrap">
                              {new Date(day._id).toLocaleDateString()}<br/>
                              ${day.revenue.toLocaleString()}
                           </div>
                        </div>
                      )
                    })}
                 </div>
                 <div className="flex justify-between text-[9px] font-bold text-[#646970] uppercase tracking-widest mt-4 px-1 sm:px-2">
                    <span>{stats.salesByDay[0]?._id || "Start"}</span>
                    <span>Recent History</span>
                    <span>{stats.salesByDay[stats.salesByDay.length - 1]?._id || "End"}</span>
                 </div>
              </div>
           </div>

           {/* Top Products */}
           <div className="lg:col-span-4 bg-white border border-[#ccd0d4] shadow-sm overflow-hidden rounded-[2px]">
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#ccd0d4] bg-[#f6f7f7]">
                 <h2 className="text-[13px] sm:text-[14px] font-bold text-[#1d2327]">Top Products</h2>
              </div>
              <div className="divide-y divide-[#f0f0f1]">
                 {stats.topProducts.map((product, i) => (
                    <div key={i} className="p-3 sm:p-4 flex items-center justify-between hover:bg-[#f6f7f7] transition-colors group">
                       <div className="space-y-0.5 min-w-0 pr-2">
                          <p className="text-[12px] font-bold text-[#2271b1] group-hover:underline truncate">{product._id}</p>
                          <p className="text-[10px] text-[#646970] font-medium">{product.unitsSold} units sold</p>
                       </div>
                       <p className="text-[12px] font-bold text-[#2c3338] shrink-0">${Math.round(product.revenue).toLocaleString()}</p>
                    </div>
                 ))}
                 {stats.topProducts.length === 0 && <p className="p-8 text-center text-xs italic text-gray-400">No sales data yet.</p>}
              </div>
           </div>

           {/* Variant Insights */}
           <div className="lg:col-span-12 bg-white border border-[#ccd0d4] shadow-sm overflow-hidden rounded-[2px]">
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#ccd0d4] bg-[#f6f7f7]">
                 <h2 className="text-[13px] sm:text-[14px] font-bold text-[#1d2327]">Variant-Level Intelligence</h2>
              </div>
              <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-y xs:divide-y-0 xs:divide-x divide-[#f0f0f1]">
                 {stats.variantInsights.slice(0, 5).map((variant, i) => (
                    <div key={i} className="p-3.5 sm:p-6 space-y-2 hover:bg-[#f6f7f7] transition-colors">
                       <p className="text-[10px] font-bold text-[#646970] uppercase tracking-widest">#{i+1} Best Seller</p>
                       <h3 className="text-[13px] font-bold text-[#1d2327] line-clamp-1">{variant._id.name}</h3>
                       <p className="text-[11px] font-medium text-[#2271b1] uppercase tracking-widest truncate">{variant._id.variant}</p>
                       <div className="flex items-center gap-2 pt-2">
                          <span className="text-xl font-black text-[#1d2327]">{variant.unitsSold}</span>
                          <span className="text-[9px] font-bold text-[#646970] uppercase">Units Shipped</span>
                       </div>
                    </div>
                 ))}
                 {stats.variantInsights.length === 0 && <p className="col-span-full p-8 sm:p-12 text-center text-[13px] italic text-gray-400">Deep variant data will appear as orders are fulfilled.</p>}
              </div>
           </div>

        </div>
      </div>
    </AdminPageLayout>
  );
}
