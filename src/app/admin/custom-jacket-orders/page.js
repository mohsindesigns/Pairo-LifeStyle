"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { toast } from "react-hot-toast";
import { Eye, Search, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { BADGE_COLORS, DEFAULT_BADGE_COLOR } from "@/lib/statusBadgeColors";

const PAYMENT_STATUS_COLORS = {
  Paid: BADGE_COLORS.green,
  Pending: BADGE_COLORS.amber,
  Failed: BADGE_COLORS.red,
  Refunded: BADGE_COLORS.gray,
  "Partially Refunded": BADGE_COLORS.gray,
};

const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded", "Partially Refunded"];

export default function CustomJacketOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [counts, setCounts] = useState({});
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.set("search", search);
      if (paymentStatusFilter !== "all") params.set("paymentStatus", paymentStatusFilter);

      const res = await fetch(`/api/admin/custom-jacket-orders?${params}`);
      const data = await res.json();
      if (res.ok) {
        setOrders(data.items || []);
        setPagination(data.pagination || {});
        setCounts(data.counts || {});
      }
    } catch {
      toast.error("Failed to load custom orders");
    } finally {
      setLoading(false);
    }
  }, [page, search, paymentStatusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <AdminPageLayout
      title="Custom Orders"
      breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Custom Orders" }]}
    >
      <div className="space-y-4">
        {/* Payment Status Tabs */}
        <ul className="flex flex-wrap items-center gap-2 text-[13px] text-[#2271b1]">
          {[["all", "All"], ...PAYMENT_STATUSES.map(s => [s, s])].map(([val, label]) => (
            <li key={val} className="flex items-center gap-1">
              <button
                onClick={() => { setPaymentStatusFilter(val); setPage(1); }}
                className={`hover:text-[#135e96] ${paymentStatusFilter === val ? "text-[#1d2327] font-semibold" : ""}`}
              >
                {label} <span className="text-[#646970] font-normal">({counts[val] || 0})</span>
              </button>
              {val !== "Partially Refunded" && <span className="text-[#c3c4c7]">|</span>}
            </li>
          ))}
        </ul>

        {/* Search */}
        <div className="bg-white border border-[#ccd0d4] p-3 flex items-center gap-2 shadow-sm">
          <input
            type="text"
            placeholder="Search by order #, name, email, jacket type..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="border border-[#8c8f94] outline-none px-3 py-1 text-[13px] w-full max-w-sm bg-white focus:border-[#2271b1] rounded-[3px]"
          />
          <button className="border border-[#8c8f94] text-[#3c434a] px-3 py-1 rounded-[3px] text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#ccd0d4] overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse text-[13px] min-w-[900px]">
            <thead>
              <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4]">
                <th className="px-4 py-2 font-bold text-[#1d2327]">Order</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Customer</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Item</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Source</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Amount</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Payment</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Order Status</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Date</th>
                <th className="px-4 py-2 font-bold text-[#1d2327]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1]">
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center italic text-gray-400">Loading custom orders...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center italic text-gray-400">No custom orders yet.</td></tr>
              ) : (
                orders.map(order => (
                  <tr key={order._id} className="hover:bg-[#f6f7f7] group transition-colors">
                    <td className="px-4 py-3 font-bold text-[#2271b1]">
                      <Link href={`/admin/orders/${order._id}`} className="hover:text-[#135e96]">
                        #{order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1d2327]">{order.shippingAddress?.fullName || "—"}</p>
                      <p className="text-[#646970] text-[12px]">{order.customer?.email || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-[#646970]">
                      {order.customJacketSnapshot?.jacketType || order.items?.[0]?.name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {order.payment?.method === "Custom Order" ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 uppercase tracking-wide">
                          Jacket Inquiry
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full border bg-purple-50 text-purple-700 border-purple-200 uppercase tracking-wide">
                          Product Customization
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-[#1d2327]">
                      {order.financials?.currency || "USD"} {(order.financials?.total || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${PAYMENT_STATUS_COLORS[order.payment?.status] || DEFAULT_BADGE_COLOR}`}>
                        {order.payment?.status || "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#646970]">{order.status}</td>
                    <td className="px-4 py-3 text-[#646970]">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order._id}`}
                        className="flex items-center gap-1 text-[#2271b1] hover:text-[#135e96] text-[12px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center gap-2 text-[13px]">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="border border-[#ccd0d4] px-2 py-1 rounded-[3px] disabled:opacity-40 hover:bg-[#f6f7f7]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[#646970]">Page {page} of {pagination.pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="border border-[#ccd0d4] px-2 py-1 rounded-[3px] disabled:opacity-40 hover:bg-[#f6f7f7]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </AdminPageLayout>
  );
}
