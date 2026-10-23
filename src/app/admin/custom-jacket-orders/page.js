"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { toast } from "react-hot-toast";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/admin/ui";
import RequirePermission from "@/components/admin/RequirePermission";

const PAYMENT_STATUS_COLORS = {
  Paid: "wp-st-paid",
  Pending: "wp-st-unpaid",
  Failed: "wp-st-failed",
  Refunded: "wp-st-refunded",
  "Partially Refunded": "wp-st-refunded",
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

  const headerRow = (
    <tr>
      <th scope="col">Order</th>
      <th scope="col" className="wp-hide-sm">Item</th>
      <th scope="col" className="wp-hide-sm">Source</th>
      <th scope="col" className="wp-hide-sm">Amount</th>
      <th scope="col">Payment</th>
      <th scope="col" className="wp-hide-sm">Order status</th>
      <th scope="col" className="wp-hide-sm">Date</th>
    </tr>
  );

  const pager = (
    <div className="wp-pages">
      <button
        type="button"
        className="wp-pager"
        aria-label="Previous page"
        onClick={() => setPage(p => Math.max(1, p - 1))}
        disabled={page === 1}
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>
      <span>Page {page} of {pagination.pages}</span>
      <button
        type="button"
        className="wp-pager"
        aria-label="Next page"
        onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
        disabled={page === pagination.pages}
      >
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <RequirePermission permission="orders.view">
    <AdminPageLayout
      title="Custom Orders"
      breadcrumbs={[{ label: "WooCommerce", href: "/admin/orders" }, { label: "Custom Orders" }]}
    >
      {/* Payment Status Tabs */}
      <div className="wp-subsub" role="tablist" aria-label="Filter custom orders by payment status">
        {[["all", "All"], ...PAYMENT_STATUSES.map(s => [s, s])].map(([val, label], i) => (
          <Fragment key={val}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={paymentStatusFilter === val}
              onClick={() => { setPaymentStatusFilter(val); setPage(1); }}
              className={paymentStatusFilter === val ? "is-current" : undefined}
            >
              {label} <span className="wp-count">({counts[val] || 0})</span>
            </button>
          </Fragment>
        ))}
      </div>

      {/* Search */}
      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <div className="wp-search" role="search">
          <label htmlFor="custom-orders-search" className="sr-only">Search custom orders</label>
          <input
            id="custom-orders-search"
            type="search"
            placeholder="Search by order #, name, email, jacket type..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="wp-input"
            style={{ minWidth: 0, width: 300, maxWidth: "100%" }}
          />
          <button type="button" className="wp-btn">
            Search orders
          </button>
        </div>
      </div>

      {pagination.pages > 1 && <div className="wp-toolbar"><span className="wp-spacer" />{pager}</div>}

      {/* Table */}
      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="wp-muted">Loading custom orders...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={8} className="wp-muted">No custom orders yet.</td></tr>
            ) : (
              orders.map(order => (
                <tr key={order._id}>
                  <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                    <Link href={`/admin/orders/${order._id}`} className="wp-row-title">
                      #{order.orderNumber} {order.shippingAddress?.fullName || "—"}
                    </Link>
                    <div className="wp-muted wp-small" style={{ wordBreak: "break-all" }}>{order.customer?.email || "—"}</div>
                    <div className="wp-mobile-meta">
                      {order.customJacketSnapshot?.jacketType || order.items?.[0]?.name || "—"}
                      {" · "}
                      <span className="wp-strong">{order.financials?.currency || "USD"} {(order.financials?.total || 0).toLocaleString()}</span>
                      {" · "}
                      {new Date(order.createdAt).toLocaleDateString()}
                    </div>
                    <div className="wp-row-actions">
                      <span><Link href={`/admin/orders/${order._id}`}>View</Link></span>
                    </div>
                  </td>
                  <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>
                    {order.customJacketSnapshot?.jacketType || order.items?.[0]?.name || "—"}
                  </td>
                  <td className="wp-hide-sm">
                    {order.payment?.method === "Custom Order" ? (
                      <span className="wp-pill wp-pill-sm wp-st-out">Jacket inquiry</span>
                    ) : (
                      <span className="wp-pill wp-pill-sm wp-st-packed">Product customization</span>
                    )}
                  </td>
                  <td className="wp-hide-sm wp-strong" style={{ whiteSpace: "nowrap" }}>
                    {order.financials?.currency || "USD"} {(order.financials?.total || 0).toLocaleString()}
                  </td>
                  <td>
                    <span className={`wp-pill ${PAYMENT_STATUS_COLORS[order.payment?.status] || "wp-st-draft"}`}>
                      {order.payment?.status || "Pending"}
                    </span>
                  </td>
                  <td className="wp-hide-sm"><StatusPill status={order.status} small /></td>
                  <td className="wp-hide-sm wp-muted">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>{headerRow}</tfoot>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && <div className="wp-toolbar"><span className="wp-spacer" />{pager}</div>}
    </AdminPageLayout>
    </RequirePermission>
  );
}
