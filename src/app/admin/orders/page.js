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
import { toast } from "react-hot-toast";

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [referralFilter, setReferralFilter] = useState("all");
  const [pagination, setPagination] = useState({ total: 0, pages: 1, currentPage: 1 });
  
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");

  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders?page=${page}&status=${statusFilter}&search=${search}`);
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
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchOrders]);

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this order permanently?")) return;
    const previousOrders = orders;
    setOrders(prev => prev.filter(o => o._id !== id));
    
    const deletePromise = fetch(`/api/admin/orders?id=${id}`, { method: "DELETE" })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to delete order.");
        }
        fetchOrders(pagination.currentPage);
      });

    toast.promise(deletePromise, {
      loading: 'Deleting order...',
      success: 'Order deleted successfully.',
      error: (err) => {
        setOrders(previousOrders);
        return err.message || 'Failed to delete order.';
      }
    });
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
     if (selectedIds.length === displayedOrders.length) setSelectedIds([]);
     else setSelectedIds(displayedOrders.map(o => o._id));
  };

  const getStatusBadge = (status) => {
    const styles = {
      'Pending': 'bg-[#fcf3d7] text-[#856404] border-[#856404]/20',
      'Confirmed': 'bg-[#d1ecf1] text-[#0c5460] border-[#0c5460]/20',
      'Processing': 'bg-[#f8f9fa] text-[#383d41] border-[#383d41]/25',
      'Shipped': 'bg-[#e2f0d9] text-[#2e7d32] border-[#2e7d32]/20',
      'Delivered': 'bg-[#e2f0d9] text-[#2e7d32] border-[#2e7d32]/20',
      'Cancelled': 'bg-[#f8d7da] text-[#721c24] border-[#721c24]/20',
    };
    return styles[status] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const displayedOrders = orders.filter(order => {
    if (referralFilter === "referred") return !!order.affiliateReferralCode;
    if (referralFilter === "non-referred") return !order.affiliateReferralCode;
    return true;
  });

  return (
    <AdminPageLayout 
      title="Orders" 
      addNewLink="/admin/orders/new"
      addNewLabel="Add New"
      breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Orders" }]}
    >
      <div className="space-y-4">
        {/* View Tabs */}
        <ul className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#2271b1] select-none font-sans">
          <li className={`${statusFilter === 'all' ? 'text-[#1d2327] font-semibold' : 'cursor-pointer hover:text-[#135e96]'}`} onClick={() => setStatusFilter('all')}>
            All <span className="text-[#646970] font-normal">({statusFilter === 'all' ? pagination.total : '-'})</span>
          </li>
          <span className="text-[#c3c4c7] font-normal">|</span>
          <li className={`${statusFilter === 'Processing' ? 'text-[#1d2327] font-semibold' : 'cursor-pointer hover:text-[#135e96]'}`} onClick={() => setStatusFilter('Processing')}>
            Processing <span className="text-[#646970] font-normal">({statusFilter === 'Processing' ? pagination.total : '-'})</span>
          </li>
          <span className="text-[#c3c4c7] font-normal">|</span>
          <li className={`${statusFilter === 'Completed' ? 'text-[#1d2327] font-semibold' : 'cursor-pointer hover:text-[#135e96]'}`} onClick={() => setStatusFilter('Completed')}>
            Completed <span className="text-[#646970] font-normal">({statusFilter === 'Completed' ? pagination.total : '-'})</span>
          </li>
          <span className="text-[#c3c4c7] font-normal">|</span>
          <li className={`${statusFilter === 'Cancelled' ? 'text-[#1d2327] font-semibold' : 'cursor-pointer hover:text-[#135e96]'}`} onClick={() => setStatusFilter('Cancelled')}>
            Cancelled <span className="text-[#646970] font-normal">({statusFilter === 'Cancelled' ? pagination.total : '-'})</span>
          </li>
          <span className="text-[#c3c4c7] font-normal">|</span>
          <li className={`${statusFilter === 'Affiliate' ? 'text-[#1d2327] font-semibold' : 'cursor-pointer hover:text-[#135e96]'}`} onClick={() => setStatusFilter('Affiliate')}>
            Affiliate Orders <span className="text-[#646970] font-normal">({statusFilter === 'Affiliate' ? pagination.total : '-'})</span>
          </li>
        </ul>

        {/* Filter Bar */}
        <div className="bg-white border border-[#ccd0d4] p-2.5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm font-sans">
          <div className="flex items-center gap-2">
            <select 
              className="border border-[#8c8f94] bg-white text-[13px] px-2 py-1.5 rounded-[3px] outline-none cursor-pointer focus:border-[#2271b1]" 
              value={bulkAction} 
              onChange={(e) => setBulkAction(e.target.value)}
            >
              <option>Bulk actions</option>
              <option>Duplicate</option>
              <option>Move to Trash</option>
              <option>Delete Permanently</option>
            </select>
            <button 
              type="button"
              onClick={handleBulkAction} 
              className="border border-[#8c8f94] text-[#3c434a] px-3 py-1.5 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1] cursor-pointer hover:text-[#000]"
            >
              Apply
            </button>
            <select 
              className="border border-[#8c8f94] bg-white text-[13px] px-2 py-1.5 rounded-[3px] outline-none cursor-pointer focus:border-[#2271b1]" 
              value={referralFilter} 
              onChange={(e) => setReferralFilter(e.target.value)}
            >
              <option value="all">All referral states</option>
              <option value="referred">Referred only</option>
              <option value="non-referred">Non-referred</option>
            </select>
          </div>
           
          <div className="flex items-center gap-2 w-full md:w-auto">
            <input 
              type="text" 
              placeholder="Search orders..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-[#8c8f94] outline-none px-3 py-1.5 text-[13px] flex-1 md:w-56 bg-white focus:border-[#2271b1] rounded-[3px]"
            />
            <button 
              type="button"
              className="border border-[#8c8f94] text-[#3c434a] px-3 py-1.5 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1] cursor-pointer"
            >
              Search Orders
            </button>
          </div>
        </div>

        {/* WP Data Table */}
        <div className="bg-white border border-[#ccd0d4] overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse text-[13px] min-w-[800px] font-sans">
            <thead>
              <tr className="border-b border-[#ccd0d4] bg-[#f6f7f7] text-[#2c3539]">
                <th className="px-3 py-2.5 w-9 text-center align-middle"><input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === displayedOrders.length} onChange={toggleSelectAll} className="rounded-[2px] border-gray-300" /></th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327] w-auto">Order</th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327] w-36">Date</th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327] w-32">Status</th>
                <th className="px-3 py-2.5 font-bold text-[#1d2327] w-28">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1] text-[#2c3539]">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center italic text-gray-400">Loading orders...</td></tr>
              ) : displayedOrders.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center italic text-gray-400">No orders found.</td></tr>
              ) : (
                displayedOrders.map((order) => (
                  <tr key={order._id} className={`hover:bg-[#f6f7f7] group transition-colors ${selectedIds.includes(order._id) ? "bg-[#f0f6fa]" : ""}`}>
                    <td className="px-3 py-3.5 text-center align-top pt-4"><input type="checkbox" checked={selectedIds.includes(order._id)} onChange={() => toggleSelect(order._id)} className="rounded-[2px] border-gray-300" /></td>
                    <td className="px-3 py-3.5 align-top pt-4">
                      <Link href={`/admin/orders/${order._id}`} className="text-[#2271b1] font-bold hover:text-[#135e96] text-[14px] block mb-0.5 leading-tight">
                        #{order.orderNumber} {order.shippingAddress?.fullName ? `by ${order.shippingAddress.fullName}` : (order.customer?.email ? `by ${order.customer.email}` : "by Guest")}
                      </Link>
                      
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 mb-1">
                        {order.affiliateReferralCode && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200">
                            Referred: {order.affiliateReferralCode}
                          </span>
                        )}
                        {order.items?.some(item => item.customization?.enabled) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-800 border border-purple-200 animate-pulse">
                            Custom Order
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-[#2271b1] font-medium mt-1">
                        <Link href={`/admin/orders/${order._id}`} className="hover:text-[#135e96]">View</Link>
                        <span className="text-[#c3c4c7] font-normal">|</span>
                        <button onClick={() => handleDuplicate(order)} className="hover:text-[#135e96] cursor-pointer">Duplicate</button>
                        <span className="text-[#c3c4c7] font-normal">|</span>
                        <button onClick={() => handleDelete(order._id)} className="text-[#bc0b0d] cursor-pointer">Trash</button>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 align-top pt-4 text-[#646970] leading-normal">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3.5 align-top pt-3.5">
                      <span className={`inline-block px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 align-top pt-4 font-bold text-neutral-800">
                      ${order.financials?.total?.toLocaleString() || "0"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* WP Pagination Bar */}
        <div className="flex items-center justify-between text-[13px] text-[#646970] font-sans">
           <p>{pagination.total} items</p>
           <div className="flex items-center gap-1">
              <button 
                disabled={pagination.currentPage === 1}
                onClick={() => fetchOrders(pagination.currentPage - 1)}
                className="p-1 border border-[#ccd0d4] bg-[#f6f7f7] hover:bg-[#f0f0f1] rounded disabled:opacity-50 cursor-pointer"
              >
                 <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="px-2">{pagination.currentPage} of {pagination.pages}</span>
              <button 
                disabled={pagination.currentPage === pagination.pages}
                onClick={() => fetchOrders(pagination.currentPage + 1)}
                className="p-1 border border-[#ccd0d4] bg-[#f6f7f7] hover:bg-[#f0f0f1] rounded disabled:opacity-50 cursor-pointer"
              >
                 <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
           </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}
