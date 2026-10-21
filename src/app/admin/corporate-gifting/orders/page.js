"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { toast } from "react-hot-toast";
import { Eye, Search, ChevronLeft, ChevronRight, X, Gift, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { BADGE_COLORS, DEFAULT_BADGE_COLOR } from "@/lib/statusBadgeColors";
import RequirePermission from "@/components/admin/RequirePermission";

const PAYMENT_STATUS_COLORS = {
  Paid: BADGE_COLORS.green,
  Pending: BADGE_COLORS.amber,
  Failed: BADGE_COLORS.red,
  Refunded: BADGE_COLORS.gray,
  "Partially Refunded": BADGE_COLORS.gray,
};

const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded", "Partially Refunded"];

function OrderDetailModal({ order, onClose }) {
  const giftItems = (order.items || []).filter((i) => i.corporateGifting?.enabled);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <div>
            <p className="text-[15px] font-bold text-[#1d2327]">Order #{order.orderNumber}</p>
            <p className="text-[12px] text-[#8c8f94]">{order.customer?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/orders/${order._id}`}
              className="flex items-center gap-1 text-[12px] font-semibold text-[#2271b1] hover:text-[#135e96]"
            >
              Full order <ExternalLink className="w-3 h-3" />
            </Link>
            <button onClick={onClose} className="text-[#646970] hover:text-[#1d2327]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {giftItems.length === 0 ? (
            <p className="text-[13px] text-[#8c8f94] italic">No Corporate Gifting items on this order.</p>
          ) : (
            giftItems.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-black/5 p-4">
                <div className="flex items-center gap-3 mb-3">
                  {item.image && (
                    <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-black/10" />
                  )}
                  <div>
                    <p className="text-[13px] font-bold text-[#1d2327]">{item.name}</p>
                    <p className="text-[11px] text-[#8c8f94]">Qty {item.quantity} &middot; ${Number(item.priceAtPurchase || 0).toFixed(2)} each</p>
                  </div>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Min {item.corporateGifting.minSelections || 3} selections
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(item.corporateGifting.selections || []).map((sel, sidx) => (
                    <div key={sidx} className="flex items-center gap-2.5 bg-black/[0.03] rounded-lg px-3 py-2.5">
                      <div className="w-9 h-9 rounded-md overflow-hidden bg-white border border-black/10 shrink-0">
                        {sel.image ? (
                          <img src={sel.image} alt={sel.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Gift className="w-4 h-4 text-black/20" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-[#1d2327] truncate">{sel.name}</p>
                        <p className="text-[11px] text-[#8c8f94]">+${Number(sel.priceDelta || 0).toFixed(2)}</p>
                      </div>
                      {sel.artwork?.url ? (
                        <a
                          href={sel.artwork.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-[#2271b1] hover:text-[#135e96] bg-white border border-[#2271b1]/30 px-2 py-1 rounded-md"
                        >
                          <FileText className="w-3 h-3" /> Logo
                        </a>
                      ) : (
                        <span className="shrink-0 text-[10px] text-[#c3c4c7] font-semibold">No logo</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function CorporateGiftingOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [counts, setCounts] = useState({});
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [detailOrder, setDetailOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.set("search", search);
      if (paymentStatusFilter !== "all") params.set("paymentStatus", paymentStatusFilter);

      const res = await fetch(`/api/admin/corporate-gifting/orders?${params}`);
      const data = await res.json();
      if (res.ok) {
        setOrders(data.items || []);
        setPagination(data.pagination || {});
        setCounts(data.counts || {});
      }
    } catch {
      toast.error("Failed to load Corporate Gifting orders");
    } finally {
      setLoading(false);
    }
  }, [page, search, paymentStatusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Debounced — fire once per settled query, not per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, searchInput ? 350 : 0);
    return () => clearTimeout(t);
  }, [searchInput]);

  return (
    <RequirePermission permission="corporate_gifting.view">
      <AdminPageLayout
        title="Corporate Gifting Orders"
        breadcrumbs={[{ label: "Products", href: "/admin/products" }, { label: "Corporate Gifting", href: "/admin/corporate-gifting" }, { label: "Orders" }]}
      >
        <div className="space-y-4">
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

          <div className="bg-white border border-[#ccd0d4] p-2 sm:p-3 flex items-center gap-2 shadow-sm rounded-xl">
            <input
              type="text"
              placeholder="Search by order #, name, email, item..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="border border-[#8c8f94] outline-none px-2.5 xs:px-3 py-1 text-[12px] xs:text-[13px] w-full max-w-sm bg-white focus:border-[#2271b1] rounded-[6px]"
            />
            <button className="border border-[#8c8f94] text-[#3c434a] px-2.5 xs:px-3 py-1 rounded-[6px] text-[12px] xs:text-[13px] font-medium bg-[#f6f7f7] hover:bg-[#f0f0f1]">
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white border border-[#ccd0d4] rounded-xl overflow-x-auto max-w-full shadow-sm">
            <table className="w-full text-left border-collapse text-[13px] min-w-[650px] md:min-w-[900px]">
              <thead>
                <tr className="bg-[#f6f7f7] border-b border-[#ccd0d4]">
                  <th className="px-4 py-2 font-bold text-[#1d2327]">Order</th>
                  <th className="px-4 py-2 font-bold text-[#1d2327]">Customer</th>
                  <th className="px-4 py-2 font-bold text-[#1d2327]">Item</th>
                  <th className="px-4 py-2 font-bold text-[#1d2327]">Selections</th>
                  <th className="px-4 py-2 font-bold text-[#1d2327]">Amount</th>
                  <th className="px-4 py-2 font-bold text-[#1d2327]">Payment</th>
                  <th className="px-4 py-2 font-bold text-[#1d2327]">Date</th>
                  <th className="px-4 py-2 font-bold text-[#1d2327]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f1]">
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center italic text-gray-400">Loading orders...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center italic text-gray-400">No Corporate Gifting orders yet.</td></tr>
                ) : (
                  orders.map(order => {
                    const giftItem = order.items?.find((i) => i.corporateGifting?.enabled);
                    return (
                      <tr key={order._id} className="hover:bg-[#f6f7f7] group transition-colors">
                        <td className="px-4 py-3 font-bold text-[#2271b1]">#{order.orderNumber}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#1d2327]">{order.shippingAddress?.fullName || "—"}</p>
                          <p className="text-[#646970] text-[12px] break-all">{order.customer?.email || "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-[#646970]">{giftItem?.name || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-bold px-2 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                            {giftItem?.corporateGifting?.selections?.length || 0} items
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-[#1d2327]">
                          {order.financials?.currency || "USD"} {(order.financials?.total || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${PAYMENT_STATUS_COLORS[order.payment?.status] || DEFAULT_BADGE_COLOR}`}>
                            {order.payment?.status || "Pending"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#646970]">{new Date(order.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setDetailOrder(order)}
                            className="flex items-center gap-1 text-[#2271b1] hover:text-[#135e96] text-[12px] font-medium opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center gap-2 text-[13px]">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="border border-[#ccd0d4] px-2 py-1 rounded-[6px] disabled:opacity-40 hover:bg-[#f6f7f7]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[#646970]">Page {page} of {pagination.pages}</span>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="border border-[#ccd0d4] px-2 py-1 rounded-[6px] disabled:opacity-40 hover:bg-[#f6f7f7]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {detailOrder && <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />}
      </AdminPageLayout>
    </RequirePermission>
  );
}
