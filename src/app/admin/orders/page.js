"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Search, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { useRouter } from "next/navigation";

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [affiliateOnly, setAffiliateOnly] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, currentPage: 1 });
  
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");

  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders?page=${page}&status=${statusFilter}&search=${search}&affiliateOnly=${affiliateOnly}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, affiliateOnly]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchOrders]);

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to move this order to trash?")) return;
    try {
      const res = await fetch(`/api/admin/orders?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchOrders(pagination.currentPage);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDuplicate = async (order) => {
    try {
      const { _id, createdAt, updatedAt, orderNumber, ...rest } = order;
      const copy = {
        ...rest,
        orderNumber: `COPY-${orderNumber || Math.floor(Math.random() * 1000)}`,
        status: "Pending"
      };
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copy)
      });
      if (res.ok) fetchOrders(pagination.currentPage);
    } catch (err) {
      console.error("Duplicate failed:", err);
    }
  };

  const handleBulkAction = async () => {
     if (bulkAction === "Bulk actions" || selectedIds.length === 0) return;
     if (confirm(`Apply "${bulkAction}" to ${selectedIds.length} orders?`)) {
        try {
           for (const id of selectedIds) {
              if (bulkAction === "Move to Trash" || bulkAction === "Delete Permanently") {
                  await fetch(`/api/admin/orders?id=${id}`, { method: "DELETE" });
              } else if (bulkAction === "Duplicate") {
                  const order = orders.find(o => o._id === id);
                  if (order) await handleDuplicate(order);
              }
           }
           setSelectedIds([]);
           fetchOrders(pagination.currentPage);
        } catch (err) {
           console.error("Bulk action failed:", err);
        }
     }
  };

  const toggleSelect = (id) => {
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
     if (selectedIds.length === orders.length) setSelectedIds([]);
     else setSelectedIds(orders.map(o => o._id));
  };

  const getStatusBadge = (status) => {
    const styles = {
      'Pending': 'bg-[#fcf3d7] text-[#856404]',
      'Confirmed': 'bg-[#d1ecf1] text-[#0c5460]',
      'Processing': 'bg-[#e2e3e5] text-[#383d41]',
      'Shipped': 'bg-[#d4edda] text-[#155724]',
      'Delivered': 'bg-[#d4edda] text-[#155724]',
      'Cancelled': 'bg-[#f8d7da] text-[#721c24]',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <AdminPageLayout 
      title="Orders" 
      addNewLink="/admin/orders/new"
      addNewLabel="Add New"
      breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Orders" }]}
    >
      <div className="space-y-4">
        {/* View Tabs */}
        <ul className="flex items-center gap-2 text-[13px] text-[#2271b1]">
           <li className={`${statusFilter === 'all' ? 'text-[#1d2327] font-semibold' : 'cursor-pointer hover:text-[#135e96]'}`} onClick={() => setStatusFilter('all')}>
              All <span className="text-[#646970] font-normal">({statusFilter === 'all' ? pagination.total : '-'})</span>
           </li>
           <span className="text-[#c3c4c7]">|</span>
           <li className={`${statusFilter === 'Processing' ? 'text-[#1d2327] font-semibold' : 'cursor-pointer hover:text-[#135e96]'}`} onClick={() => setStatusFilter('Processing')}>
              Processing <span className="text-[#646970] font-normal">({statusFilter === 'Processing' ? pagination.total : '-'})</span>
           </li>
           <span className="text-[#c3c4c7]">|</span>
           <li className={`${statusFilter === 'Completed' ? 'text-[#1d2327] font-semibold' : 'cursor-pointer hover:text-[#135e96]'}`} onClick={() => setStatusFilter('Completed')}>
              Completed <span className="text-[#646970] font-normal">({statusFilter === 'Completed' ? pagination.total : '-'})</span>
           </li>
           <span className="text-[#c3c4c7]">|</span>
           <li className={`${statusFilter === 'Cancelled' ? 'text-[#1d2327] font-semibold' : 'cursor-pointer hover:text-[#135e96]'}`} onClick={() => setStatusFilter('Cancelled')}>
              Cancelled <span className="text-[#646970] font-normal">({statusFilter === 'Cancelled' ? pagination.total : '-'})</span>
           </li>
        </ul>

        {/* Filter Bar */}
        <div className="bg-white border border-[#ccd0d4] p-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
           <div className="flex items-center gap-2">
              <select className="border border-[#8c8f94] bg-white text-[13px] px-2 py-1 rounded-[3px] outline-none" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
                 <option>Bulk actions</option>
                 <option>Duplicate</option>
                 <option>Move to Trash</option>
                 <option>Delete Permanently</option>
              </select>
              <button onClick={handleBulkAction} className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">Apply</button>
           </div>
           
           <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-[13px] cursor-pointer select-none">
                 <input
                    type="checkbox"
                    checked={affiliateOnly}
                    onChange={(e) => setAffiliateOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#2271b1] focus:ring-[#2271b1]"
                 />
                 <span className="font-bold text-[#1d2327]">Affiliate Orders Only</span>
              </label>
           </div>
           <div className="flex items-center gap-2 w-full md:w-auto">
              <input 
                type="text" 
                placeholder="Search orders..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-[#8c8f94] outline-none px-3 py-1 text-[13px] flex-1 md:w-64 bg-white focus:border-[#2271b1] rounded-[3px]"
              />
              <button className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">Search Orders</button>
           </div>
        </div>

        {/* WP Data Table */}
        <div className="bg-white border border-[#ccd0d4] overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse text-[13px] min-w-[800px]">
            <thead>
              <tr className="border-b border-[#ccd0d4] bg-[#f6f7f7]">
                <th className="px-3 py-2 w-8 text-center"><input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === orders.length} onChange={toggleSelectAll} /></th>
                <th className="px-3 py-2 font-bold text-[#1d2327]">Order</th>
                <th className="px-3 py-2 font-bold text-[#1d2327]">Date</th>
                <th className="px-3 py-2 font-bold text-[#1d2327]">Status</th>
                <th className="px-3 py-2 font-bold text-[#1d2327]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1]">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center italic text-gray-400">Loading orders...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center italic text-gray-400">No orders found.</td></tr>
              ) : (
                orders.map((order) => (
                  <tr key={order._id} className={`hover:bg-[#f6f7f7] group transition-colors ${selectedIds.includes(order._id) ? "bg-[#f0f6fa]" : ""}`}>
                    <td className="px-3 py-4 text-center align-top"><input type="checkbox" checked={selectedIds.includes(order._id)} onChange={() => toggleSelect(order._id)} /></td>
                    <td className="px-3 py-4 align-top">
                       <Link href={`/admin/orders/${order._id}`} className="text-[#2271b1] font-bold text-[14px] hover:underline block mb-1">
                          #{order.orderNumber} {order.shippingAddress?.fullName ? `by ${order.shippingAddress.fullName}` : (order.customer?.email ? `by ${order.customer.email}` : "by Guest")}
                       </Link>
                       {order.affiliateReferralCode && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200 mt-1 mr-2">
                          Referred: {order.affiliateReferralCode}
                        </span>
                      )}
                       <div className="flex flex-wrap items-center gap-x-2 gap-y-1 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-[#2271b1] font-medium">
                          <Link href={`/admin/orders/${order._id}`} className="hover:text-[#135e96]">View</Link>
                          <span className="text-[#c3c4c7]">|</span>
                          <button onClick={() => handleDuplicate(order)} className="hover:text-[#135e96]">Duplicate</button>
                          <span className="text-[#c3c4c7]">|</span>
                          <button onClick={() => handleDelete(order._id)} className="text-[#d63638] hover:text-[#bc0b0d]">Trash</button>
                       </div>
                    </td>
                    <td className="px-3 py-4 align-top text-[#646970]">
                       {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-4 align-top">
                       <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold uppercase ${getStatusBadge(order.status)}`}>
                          {order.status}
                       </span>
                    </td>
                    <td className="px-3 py-4 align-top font-bold">
                       ${order.financials?.total?.toLocaleString() || "0"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* WP Pagination Bar */}
        <div className="flex items-center justify-between text-[13px] text-[#646970]">
           <p>{pagination.total} items</p>
           <div className="flex items-center gap-1">
              <button 
                disabled={pagination.currentPage === 1}
                onClick={() => fetchOrders(pagination.currentPage - 1)}
                className="p-1 border border-[#ccd0d4] bg-white rounded hover:bg-gray-50 disabled:opacity-50"
              >
                 <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3">{pagination.currentPage} of {pagination.pages}</span>
              <button 
                disabled={pagination.currentPage === pagination.pages}
                onClick={() => fetchOrders(pagination.currentPage + 1)}
                className="p-1 border border-[#ccd0d4] bg-white rounded hover:bg-gray-50 disabled:opacity-50"
              >
                 <ChevronRight className="w-4 h-4" />
              </button>
           </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}
