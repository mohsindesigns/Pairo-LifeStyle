"use client";

import { Fragment, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Page, PageHeader, Notice, Skeleton, StatusPill, formatMoney, formatDate } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";
import ThemedSelect from "@/components/ui/ThemedSelect";

// Custom orders are ordinary orders (payment method "Custom Order" / "Custom Inquiry"),
// so every action here goes through the Orders API: Duplicate, Trash (orders soft
// delete), Restore and Delete permanently. They are created from Custom Inquiries
// and the storefront "Customize this product" flow, so there is no Add new here.

const PAYMENT_STATUS_COLORS = {
  Paid: "wp-st-paid",
  Pending: "wp-st-unpaid",
  Failed: "wp-st-failed",
  Refunded: "wp-st-refunded",
  "Partially Refunded": "wp-st-refunded",
};

const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded", "Partially Refunded"];
const TABS = [["all", "All"], ...PAYMENT_STATUSES.map((s) => [s, s]), ["trash", "Trash"]];

async function readError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export default function CustomJacketOrdersPage() {
  const { showConfirm } = usePopup();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [counts, setCounts] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  const searchTimer = useRef(null);

  const isTrash = tab === "trash";

  const fetchOrders = useCallback(async (p) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (search) params.set("search", search);
      if (tab === "trash") params.set("trash", "true");
      else if (tab !== "all") params.set("paymentStatus", tab);

      const res = await fetch(`/api/admin/custom-jacket-orders?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to load custom orders.");
      setOrders(data.items || []);
      setPagination(data.pagination || { total: 0, pages: 1 });
      setCounts(data.counts || null);
      setSelectedIds([]);
      setLoadError("");
    } catch (err) {
      setLoadError(err.message || "Failed to load custom orders.");
    } finally {
      setLoading(false);
    }
  }, [search, tab]);

  // Page changes load immediately; typing in the search box is debounced.
  useEffect(() => {
    searchTimer.current = setTimeout(() => fetchOrders(page), 400);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchOrders]);

  const goToPage = (p) => {
    setPage(p);
    clearTimeout(searchTimer.current);
    fetchOrders(p);
  };

  const runSearchNow = (e) => {
    e?.preventDefault();
    clearTimeout(searchTimer.current);
    setPage(1);
    fetchOrders(1);
  };

  const reloadAfterRemoving = (n) => {
    const p = n >= orders.length && page > 1 ? page - 1 : page;
    goToPage(p);
  };

  // --- single-order requests via the Orders API (throw on failure) ---
  const trashOrder = async (id) => {
    const res = await fetch(`/api/admin/orders?id=${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await readError(res, "Failed to move order to trash."));
  };
  const restoreOrder = async (id) => {
    const res = await fetch("/api/admin/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isDeleted: false }),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to restore order."));
  };
  const deleteOrderPermanently = async (id) => {
    const res = await fetch(`/api/admin/orders?id=${id}&permanent=true`, { method: "DELETE" });
    if (!res.ok) throw new Error(await readError(res, "Failed to delete order."));
  };
  const duplicateOrder = async (id) => {
    const res = await fetch(`/api/admin/orders/${id}/duplicate`, { method: "POST" });
    if (!res.ok) throw new Error(await readError(res, "Failed to duplicate order."));
  };

  const runRowAction = async (action, removesRow, messages) => {
    const p = action().then(() => (removesRow ? reloadAfterRemoving(1) : goToPage(page)));
    toast.promise(p, {
      loading: messages.loading,
      success: messages.success,
      error: (err) => err.message || messages.error,
    });
    try { await p; } catch { /* surfaced via toast */ }
  };

  const handleTrash = (o) => runRowAction(() => trashOrder(o._id), true, {
    loading: "Moving order to trash...",
    success: `Order #${o.orderNumber} moved to the Trash.`,
    error: "Failed to move order to trash.",
  });
  const handleRestore = (o) => runRowAction(() => restoreOrder(o._id), true, {
    loading: "Restoring order...",
    success: `Order #${o.orderNumber} restored.`,
    error: "Failed to restore order.",
  });
  const handleDuplicate = (o) => runRowAction(() => duplicateOrder(o._id), false, {
    loading: "Duplicating order...",
    success: `Order #${o.orderNumber} duplicated as a Pending draft.`,
    error: "Failed to duplicate order.",
  });
  const handleDeletePermanently = async (o) => {
    const ok = await showConfirm(
      `Order #${o.orderNumber} will be deleted permanently. This cannot be undone.`,
      "Delete permanently?",
      { confirmText: "Delete Permanently", danger: true }
    );
    if (!ok) return;
    runRowAction(() => deleteOrderPermanently(o._id), true, {
      loading: "Deleting order...",
      success: "Order deleted permanently.",
      error: "Failed to delete order.",
    });
  };

  const BULK = {
    Duplicate: { verb: "duplicated", run: duplicateOrder, removes: false },
    "Move to Trash": { verb: "moved to the Trash", run: trashOrder, removes: true },
    Restore: { verb: "restored", run: restoreOrder, removes: true },
    "Delete Permanently": { verb: "deleted permanently", run: deleteOrderPermanently, removes: true },
  };

  const handleBulkAction = async () => {
    const def = BULK[bulkAction];
    if (!def) {
      toast.error("Choose a bulk action first.");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Select at least one order.");
      return;
    }
    const n = selectedIds.length;
    const ok = bulkAction === "Delete Permanently"
      ? await showConfirm(
          `${n} order${n === 1 ? "" : "s"} will be deleted permanently. This cannot be undone.`,
          "Delete permanently?",
          { confirmText: "Delete Permanently", danger: true }
        )
      : await showConfirm(`Apply "${bulkAction}" to ${n} order${n === 1 ? "" : "s"}?`);
    if (!ok) return;

    let done = 0;
    let failed = 0;
    for (const id of selectedIds) {
      try {
        await def.run(id);
        done++;
      } catch {
        failed++;
      }
    }
    setBulkAction("Bulk actions");
    if (def.removes) reloadAfterRemoving(done);
    else goToPage(page);
    if (failed === 0) toast.success(`${done} order${done === 1 ? "" : "s"} ${def.verb}.`);
    else toast.error(`${bulkAction}: ${done} done, ${failed} failed.`);
  };

  const toggleSelect = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  const allSelected = orders.length > 0 && selectedIds.length === orders.length;
  const someSelected = selectedIds.length > 0;
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : orders.map((o) => o._id));

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input
          type="checkbox"
          aria-label="Select all orders"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={toggleSelectAll}
        />
      </th>
      <th scope="col">Order</th>
      <th scope="col" className="wp-hide-sm">Item</th>
      <th scope="col" className="wp-hide-sm">Source</th>
      <th scope="col">Payment</th>
      <th scope="col" className="wp-hide-sm">Order status</th>
      <th scope="col" className="wp-hide-sm">Date</th>
      <th scope="col" className="wp-hide-sm wp-num" style={{ textAlign: "right" }}>Amount</th>
    </tr>
  );

  const pager = (
    <div className="wp-pages">
      <span>{pagination.total || 0} {pagination.total === 1 ? "item" : "items"}</span>
      <button
        type="button"
        className="wp-pager"
        aria-label="Previous page"
        onClick={() => goToPage(Math.max(1, page - 1))}
        disabled={loading || page <= 1}
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>
      <span>{page} of {pagination.pages || 1}</span>
      <button
        type="button"
        className="wp-pager"
        aria-label="Next page"
        onClick={() => goToPage(Math.min(pagination.pages || 1, page + 1))}
        disabled={loading || page >= (pagination.pages || 1)}
      >
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <RequirePermission permission="orders.view">
      <Page>
        <PageHeader title="Custom Orders" />
        <p className="wp-desc" style={{ margin: "0 0 8px" }}>
          Orders created from custom jacket inquiries and product customizations. They also appear under{" "}
          <Link href="/admin/orders" className="wp-link">Orders</Link>.
        </p>

        <nav className="wp-subsub" aria-label="Filter custom orders by payment status">
          {TABS.map(([val, label], i) => (
            <Fragment key={val}>
              {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
              <button
                type="button"
                aria-current={tab === val ? "page" : undefined}
                onClick={() => { setTab(val); setPage(1); setBulkAction("Bulk actions"); }}
                className={tab === val ? "is-current" : undefined}
              >
                {label} <span className="wp-count">({counts ? (counts[val] ?? 0) : "-"})</span>
              </button>
            </Fragment>
          ))}
        </nav>

        <div className="wp-toolbar">
          <label htmlFor="custom-orders-bulk" className="sr-only">Bulk actions</label>
          <ThemedSelect
            id="custom-orders-bulk"
            className="wp-select"
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
          >
            <option>Bulk actions</option>
            {isTrash ? (
              <>
                <option>Restore</option>
                <option>Delete Permanently</option>
              </>
            ) : (
              <>
                <option>Duplicate</option>
                <option>Move to Trash</option>
              </>
            )}
          </ThemedSelect>
          <button type="button" className="wp-btn" onClick={handleBulkAction}>Apply</button>
          <span className="wp-spacer" />
          <form className="wp-search" role="search" onSubmit={runSearchNow}>
            <label htmlFor="custom-orders-search" className="sr-only">Search custom orders</label>
            <input
              id="custom-orders-search"
              type="search"
              placeholder="Search custom orders..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="wp-input"
            />
            <button type="submit" className="wp-btn">Search orders</button>
          </form>
        </div>

        <div className="wp-toolbar">
          <span className="wp-spacer" />
          {pager}
        </div>

        {loadError && (
          <Notice type="error" onDismiss={() => setLoadError("")}>
            {loadError}{" "}
            <button type="button" className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => goToPage(page)}>
              Try again
            </button>
          </Notice>
        )}

        <div className="wp-table-box">
          <table className="wp-list-table">
            <thead>{headerRow}</thead>
            <tbody>
              {loading && orders.length === 0 ? (
                [0, 1, 2, 3].map((i) => (
                  <tr key={`sk-${i}`} aria-hidden="true">
                    <td className="wp-check-col"><Skeleton height={16} width={16} /></td>
                    <td><Skeleton height={16} width="70%" /><Skeleton height={12} width="45%" style={{ marginTop: 8 }} /></td>
                    <td className="wp-hide-sm"><Skeleton height={14} width="70%" /></td>
                    <td className="wp-hide-sm"><Skeleton height={22} width={110} /></td>
                    <td><Skeleton height={22} width={70} /></td>
                    <td className="wp-hide-sm"><Skeleton height={22} width={84} /></td>
                    <td className="wp-hide-sm"><Skeleton height={14} width={80} /></td>
                    <td className="wp-hide-sm"><Skeleton height={14} width={64} style={{ marginLeft: "auto" }} /></td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="wp-muted">
                    {search
                      ? <>No custom orders match &ldquo;{search}&rdquo;.</>
                      : isTrash ? "No custom orders in the Trash." : "No custom orders yet."}
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const currency = order.financials?.currency || "USD";
                  const amount = formatMoney(order.financials?.total, currency);
                  const itemName = order.customJacketSnapshot?.jacketType || order.items?.[0]?.name || "—";
                  const selected = selectedIds.includes(order._id);
                  return (
                    <tr key={order._id} className={selected ? "is-selected" : undefined}>
                      <td className="wp-check-col">
                        <input
                          type="checkbox"
                          aria-label={`Select order #${order.orderNumber}`}
                          checked={selected}
                          onChange={() => toggleSelect(order._id)}
                        />
                      </td>
                      <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                        <Link href={`/admin/orders/${order._id}`} className="wp-row-title">
                          #{order.orderNumber} {order.shippingAddress?.fullName || ""}
                        </Link>
                        <div className="wp-muted wp-small" style={{ wordBreak: "break-all" }}>{order.customer?.email || "—"}</div>
                        <div className="wp-mobile-meta">
                          {itemName} · <span className="wp-strong">{amount}</span> · {formatDate(order.createdAt)}
                          <div style={{ marginTop: 4 }}><StatusPill status={order.status} small /></div>
                        </div>
                        <div className="wp-row-actions">
                          {isTrash ? (
                            <>
                              <span><button type="button" onClick={() => handleRestore(order)}>Restore</button></span>
                              <span><button type="button" className="is-danger" onClick={() => handleDeletePermanently(order)}>Delete Permanently</button></span>
                            </>
                          ) : (
                            <>
                              <span><Link href={`/admin/orders/${order._id}`}>Edit</Link></span>
                              <span><button type="button" onClick={() => handleDuplicate(order)}>Duplicate</button></span>
                              <span><button type="button" className="is-danger" onClick={() => handleTrash(order)}>Trash</button></span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="wp-hide-sm" style={{ wordBreak: "break-word" }}>{itemName}</td>
                      <td className="wp-hide-sm">
                        {order.payment?.method === "Custom Order" ? (
                          <span className="wp-pill wp-pill-sm wp-st-out">Jacket inquiry</span>
                        ) : (
                          <span className="wp-pill wp-pill-sm wp-st-packed">Product customization</span>
                        )}
                      </td>
                      <td>
                        <span className={`wp-pill wp-pill-sm ${PAYMENT_STATUS_COLORS[order.payment?.status] || "wp-st-draft"}`}>
                          {order.payment?.status || "Pending"}
                        </span>
                      </td>
                      <td className="wp-hide-sm"><StatusPill status={order.status} small /></td>
                      <td className="wp-hide-sm wp-muted">
                        <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time>
                      </td>
                      <td className="wp-hide-sm wp-num wp-strong" style={{ whiteSpace: "nowrap" }}>{amount}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>{headerRow}</tfoot>
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
