"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Page, PageHeader, StatusPill, formatMoney, formatDate } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

export default function AdminOrdersPage() {
  const router = useRouter();
  const { showConfirm } = usePopup();
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
    const ok = await showConfirm("Are you sure you want to delete this order permanently?");
    if (!ok) return;
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
     const ok = await showConfirm(`Apply "${bulkAction}" to ${selectedIds.length} orders?`);
     if (ok) {
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

  const displayedOrders = orders.filter(order => {
    if (referralFilter === "referred") return !!order.affiliateReferralCode;
    if (referralFilter === "non-referred") return !order.affiliateReferralCode;
    return true;
  });

  const STATUS_TABS = [
    { value: "all", label: "All" },
    { value: "Processing", label: "Processing" },
    { value: "Completed", label: "Completed" },
    { value: "Cancelled", label: "Cancelled" },
    { value: "Affiliate", label: "Affiliate Orders" },
  ];

  const PAYMENT_CLASS = {
    Paid: "wp-st-paid",
    Pending: "wp-st-unpaid",
    Failed: "wp-st-failed",
    Refunded: "wp-st-refunded",
    "Partially Refunded": "wp-st-refunded",
  };

  const allSelected = selectedIds.length > 0 && selectedIds.length === displayedOrders.length;

  const pager = (
    <div className="wp-pages">
      <span>{pagination.total} items</span>
      <button
        type="button"
        className="wp-pager"
        aria-label="Previous page"
        disabled={pagination.currentPage === 1}
        onClick={() => fetchOrders(pagination.currentPage - 1)}
      >
        ‹
      </button>
      <span>{pagination.currentPage} of {pagination.pages}</span>
      <button
        type="button"
        className="wp-pager"
        aria-label="Next page"
        disabled={pagination.currentPage === pagination.pages}
        onClick={() => fetchOrders(pagination.currentPage + 1)}
      >
        ›
      </button>
    </div>
  );

  const headRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input type="checkbox" aria-label="Select all orders" checked={allSelected} onChange={toggleSelectAll} />
      </th>
      <th scope="col">Order</th>
      <th scope="col" className="wp-hide-sm">Date</th>
      <th scope="col" className="wp-hide-sm">Status</th>
      <th scope="col" className="wp-hide-sm">Ship to</th>
      <th scope="col" className="wp-hide-sm">Payment</th>
      <th scope="col" className="wp-num">Total</th>
    </tr>
  );

  return (
    <RequirePermission permission="orders.view">
    <Page>
      <PageHeader
        title="Orders"
        actions={<Link href="/admin/orders/new" className="wp-btn">Add New</Link>}
      />

      <nav className="wp-subsub" aria-label="Filter orders by status">
        {STATUS_TABS.map((tab, i) => (
          <span key={tab.value}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              className={statusFilter === tab.value ? "is-current" : undefined}
              aria-current={statusFilter === tab.value ? "page" : undefined}
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}{" "}
              <span className="wp-count">({statusFilter === tab.value ? pagination.total : "-"})</span>
            </button>
          </span>
        ))}
      </nav>

      <div className="wp-toolbar">
        <label htmlFor="orders-bulk-action" className="sr-only">Bulk actions</label>
        <select
          id="orders-bulk-action"
          className="wp-select"
          value={bulkAction}
          onChange={(e) => setBulkAction(e.target.value)}
        >
          <option>Bulk actions</option>
          <option>Duplicate</option>
          <option>Move to Trash</option>
          <option>Delete Permanently</option>
        </select>
        <button type="button" onClick={handleBulkAction} className="wp-btn">
          Apply
        </button>
        <label htmlFor="orders-referral-filter" className="sr-only">Filter by referral</label>
        <select
          id="orders-referral-filter"
          className="wp-select"
          value={referralFilter}
          onChange={(e) => setReferralFilter(e.target.value)}
        >
          <option value="all">All referral states</option>
          <option value="referred">Referred only</option>
          <option value="non-referred">Non-referred</option>
        </select>
        <span className="wp-spacer" />
        <div className="wp-search" role="search">
          <label htmlFor="orders-search" className="sr-only">Search orders</label>
          <input
            id="orders-search"
            type="search"
            className="wp-input"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="wp-btn">
            Search Orders
          </button>
        </div>
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="wp-muted">Loading orders...</td></tr>
            ) : displayedOrders.length === 0 ? (
              <tr><td colSpan={7} className="wp-muted">No orders found.</td></tr>
            ) : (
              displayedOrders.map((order) => {
                const customerName = order.shippingAddress?.fullName || order.customer?.email || "Guest";
                const itemCount = (order.items || []).reduce((n, item) => n + (Number(item.quantity) || 1), 0);
                const paymentStatus = order.payment?.status;
                const shipTo = [order.shippingAddress?.city, order.shippingAddress?.state, order.shippingAddress?.country]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <tr key={order._id} className={selectedIds.includes(order._id) ? "is-selected" : undefined}>
                    <td className="wp-check-col">
                      <input
                        type="checkbox"
                        aria-label={`Select order #${order.orderNumber}`}
                        checked={selectedIds.includes(order._id)}
                        onChange={() => toggleSelect(order._id)}
                      />
                    </td>
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      <Link href={`/admin/orders/${order._id}`} className="wp-row-title">
                        #{order.orderNumber} {customerName}
                      </Link>
                      {(order.affiliateReferralCode || order.items?.some(item => item.customization?.enabled)) && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                          {order.affiliateReferralCode && (
                            <span className="wp-pill wp-pill-sm wp-st-shipped">Referred: {order.affiliateReferralCode}</span>
                          )}
                          {order.items?.some(item => item.customization?.enabled) && (
                            <span className="wp-pill wp-pill-sm wp-st-packed">Custom order</span>
                          )}
                        </div>
                      )}
                      <div className="wp-mobile-meta">
                        <StatusPill status={order.status} small /> · {formatDate(order.createdAt)}
                      </div>
                      <div className="wp-row-actions">
                        <Link href={`/admin/orders/${order._id}`}>View</Link>
                        <button type="button" onClick={() => handleDuplicate(order)}>Duplicate</button>
                        <button type="button" className="is-danger" onClick={() => handleDelete(order._id)}>Trash</button>
                      </div>
                    </td>
                    <td className="wp-hide-sm">
                      <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time>
                    </td>
                    <td className="wp-hide-sm">
                      <StatusPill status={order.status} />
                    </td>
                    <td className="wp-hide-sm">
                      <div className="wp-strong">{order.shippingAddress?.fullName || order.customer?.email || "Guest"}</div>
                      {shipTo && <div className="wp-muted wp-small">{shipTo}</div>}
                    </td>
                    <td className="wp-hide-sm">
                      {paymentStatus && (
                        <span className={`wp-pill wp-pill-sm ${PAYMENT_CLASS[paymentStatus] || ""}`}>{paymentStatus}</span>
                      )}
                      {order.payment?.method && <div className="wp-muted wp-small" style={{ marginTop: 4 }}>{order.payment.method}</div>}
                    </td>
                    <td className="wp-num">
                      <span className="wp-strong">{formatMoney(order.financials?.total, order.financials?.currency || "USD")}</span>
                      <div className="wp-muted wp-small">{itemCount} item{itemCount === 1 ? "" : "s"}</div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>{headRow}</tfoot>
        </table>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pager}
      </div>
    </Page>
    </RequirePermission>
  );
}
