"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Page, PageHeader, StatusPill, formatMoney, formatDate } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

// "Completed" = Delivered (an order that reached its final, successful status).
const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "Processing", label: "Processing" },
  { value: "Delivered", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "affiliate", label: "Affiliate Orders" },
  { value: "trash", label: "Trash" },
];

async function readError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export default function AdminOrdersPage() {
  const { showConfirm } = usePopup();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [referralFilter, setReferralFilter] = useState("all");
  const [pagination, setPagination] = useState({ total: 0, pages: 1, currentPage: 1 });
  const [counts, setCounts] = useState(null);

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  const searchTimer = useRef(null);

  const isTrash = statusFilter === "trash";

  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), search });
      if (statusFilter === "trash") params.set("trash", "true");
      else if (statusFilter === "affiliate") params.set("affiliateOnly", "true");
      else params.set("status", statusFilter);
      if (referralFilter !== "all") params.set("referral", referralFilter);

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
        setSelectedIds([]); // selection only ever refers to the rows currently shown
        setPagination(data.pagination);
        setCounts(data.counts || null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, referralFilter]);

  useEffect(() => {
    searchTimer.current = setTimeout(() => {
      fetchOrders(1);
    }, 500);
    return () => clearTimeout(searchTimer.current);
  }, [fetchOrders]);

  const runSearchNow = (e) => {
    e?.preventDefault();
    clearTimeout(searchTimer.current);
    fetchOrders(1);
  };

  const reloadCurrentPage = () => {
    // If the last item on a page was removed, step back a page.
    const page = orders.length <= 1 && pagination.currentPage > 1 ? pagination.currentPage - 1 : pagination.currentPage;
    fetchOrders(page);
  };

  // --- single-order requests (throw on failure) ---
  const trashOrder = async (id) => {
    const res = await fetch(`/api/admin/orders?id=${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await readError(res, "Failed to move order to trash."));
  };

  const deleteOrderPermanently = async (id) => {
    const res = await fetch(`/api/admin/orders?id=${id}&permanent=true`, { method: "DELETE" });
    if (!res.ok) throw new Error(await readError(res, "Failed to delete order."));
  };

  const restoreOrder = async (id) => {
    const res = await fetch("/api/admin/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isDeleted: false }),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to restore order."));
  };

  // Server-side copy: keeps the original prices, no stock deduction, no emails or
  // commissions; the copy is a Pending draft noted "Duplicated from #<n>".
  const duplicateOrder = async (order) => {
    const res = await fetch(`/api/admin/orders/${order._id}/duplicate`, { method: "POST" });
    if (!res.ok) throw new Error(await readError(res, "Failed to duplicate order."));
  };

  // --- row actions ---
  const runRowAction = async (action, messages) => {
    const p = action().then(() => reloadCurrentPage());
    toast.promise(p, {
      loading: messages.loading,
      success: messages.success,
      error: (err) => err.message || messages.error,
    });
    try { await p; } catch { /* surfaced via toast */ }
  };

  const handleTrash = (order) => runRowAction(() => trashOrder(order._id), {
    loading: "Moving order to trash...",
    success: `Order #${order.orderNumber} moved to the Trash.`,
    error: "Failed to move order to trash.",
  });

  const handleRestore = (order) => runRowAction(() => restoreOrder(order._id), {
    loading: "Restoring order...",
    success: `Order #${order.orderNumber} restored.`,
    error: "Failed to restore order.",
  });

  const handleDeletePermanently = async (order) => {
    const ok = await showConfirm(
      `Order #${order.orderNumber} will be deleted permanently. This cannot be undone.`,
      "Delete permanently?",
      { confirmText: "Delete Permanently", danger: true }
    );
    if (!ok) return;
    runRowAction(() => deleteOrderPermanently(order._id), {
      loading: "Deleting order...",
      success: "Order deleted permanently.",
      error: "Failed to delete order.",
    });
  };

  const handleDuplicate = (order) => runRowAction(() => duplicateOrder(order), {
    loading: "Duplicating order...",
    success: `Order #${order.orderNumber} duplicated as a Pending draft.`,
    error: "Failed to duplicate order.",
  });

  // --- bulk actions ---
  const BULK_LABELS = {
    Duplicate: { verb: "duplicated", run: (id) => duplicateOrder(orders.find(o => o._id === id)) },
    "Move to Trash": { verb: "moved to the Trash", run: trashOrder },
    Restore: { verb: "restored", run: restoreOrder },
    "Delete Permanently": { verb: "deleted permanently", run: deleteOrderPermanently },
  };

  const handleBulkAction = async () => {
    const def = BULK_LABELS[bulkAction];
    if (!def || selectedIds.length === 0) return;

    const n = selectedIds.length;
    const ok = bulkAction === "Delete Permanently"
      ? await showConfirm(
          `${n} order${n === 1 ? "" : "s"} will be deleted permanently. This cannot be undone.`,
          "Delete permanently?",
          { confirmText: "Delete Permanently", danger: true }
        )
      : await showConfirm(`Apply "${bulkAction}" to ${n} order${n === 1 ? "" : "s"}?`);
    if (!ok) return;

    let succeeded = 0;
    const failures = [];
    for (const id of selectedIds) {
      const order = orders.find(o => o._id === id);
      try {
        if (!order) throw new Error("Order is no longer in the list.");
        await def.run(id);
        succeeded++;
      } catch (err) {
        failures.push(`#${order?.orderNumber || id}: ${err.message}`);
      }
    }

    setSelectedIds([]);
    setBulkAction("Bulk actions");
    fetchOrders(pagination.currentPage);

    if (succeeded > 0) toast.success(`${succeeded} order${succeeded === 1 ? "" : "s"} ${def.verb}.`);
    if (failures.length > 0) {
      toast.error(`${failures.length} failed — ${failures.slice(0, 5).join("; ")}${failures.length > 5 ? "; …" : ""}`, { duration: 8000 });
    }
  };

  const toggleSelect = (id) => {
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
     if (selectedIds.length === displayedOrders.length) setSelectedIds([]);
     else setSelectedIds(displayedOrders.map(o => o._id));
  };

  // Referral filtering happens server-side so the item count and pagination stay correct.
  const displayedOrders = orders;

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
              onClick={() => { setStatusFilter(tab.value); setBulkAction("Bulk actions"); }}
            >
              {tab.label}{" "}
              <span className="wp-count">({counts ? (counts[tab.value] ?? 0) : "-"})</span>
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
          {isTrash ? (
            <option>Restore</option>
          ) : (
            <>
              <option>Duplicate</option>
              <option>Move to Trash</option>
            </>
          )}
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
        <form className="wp-search" role="search" onSubmit={runSearchNow}>
          <label htmlFor="orders-search" className="sr-only">Search orders</label>
          <input
            id="orders-search"
            type="search"
            className="wp-input"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="wp-btn">
            Search Orders
          </button>
        </form>
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
                        {isTrash ? (
                          <>
                            <button type="button" onClick={() => handleRestore(order)}>Restore</button>
                            <button type="button" className="is-danger" onClick={() => handleDeletePermanently(order)}>Delete Permanently</button>
                          </>
                        ) : (
                          <>
                            <Link href={`/admin/orders/${order._id}`}>View</Link>
                            <button type="button" onClick={() => handleDuplicate(order)}>Duplicate</button>
                            <button type="button" className="is-danger" onClick={() => handleTrash(order)}>Trash</button>
                          </>
                        )}
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
