"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { ChevronLeft, ChevronRight, Mail, Phone, MapPin, Clock } from "lucide-react";
import { toast } from "react-hot-toast";
import { Page, PageHeader, Notice, Skeleton, formatMoney } from "@/components/admin/ui";
import { usePopup } from "@/context/PopupContext";
import RequirePermission from "@/components/admin/RequirePermission";

// Read-mostly screen: the records are written by the storefront checkout. The admin can
// view them and move them to the Trash (no Add new / Duplicate — they are shopper data).
const VIEWS = [
  { value: "active", label: "Not Yet Completed" },
  { value: "recovered", label: "Completed (Recovered)" },
  { value: "all", label: "All" },
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

const cartName = (item) =>
  item.shippingAddress?.fullName ||
  `${item.contact?.firstName || ""} ${item.contact?.lastName || ""}`.trim() ||
  item.contact?.email ||
  "Unknown";

const fmtDateTime = (v) => (v ? new Date(v).toLocaleString() : "—");

export default function AbandonedCartsPage() {
  const { showConfirm } = usePopup();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("active");
  const [counts, setCounts] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, currentPage: 1 });
  const [expanded, setExpanded] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("Bulk actions");
  const searchTimer = useRef(null);

  const isTrash = view === "trash";

  const fetchItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), status: view, search });
      const res = await fetch(`/api/admin/abandoned-carts?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to load abandoned carts.");
      setItems(data.items || []);
      setCounts(data.counts || null);
      setPagination(data.pagination);
      setSelectedIds([]);
      setLoadError("");
    } catch (e) {
      console.error(e);
      setLoadError(e.message || "Failed to load abandoned carts.");
    } finally {
      setLoading(false);
    }
  }, [search, view]);

  // Live search (debounced); submitting the search form runs it immediately.
  useEffect(() => {
    searchTimer.current = setTimeout(() => fetchItems(1), 400);
    return () => clearTimeout(searchTimer.current);
  }, [fetchItems]);

  const runSearchNow = (e) => {
    e?.preventDefault();
    clearTimeout(searchTimer.current);
    fetchItems(1);
  };

  const pageAfterRemoving = (n) =>
    n >= items.length && pagination.currentPage > 1 ? pagination.currentPage - 1 : pagination.currentPage;

  // --- single-record requests (throw on failure) ---
  const trashCart = async (id) => {
    const res = await fetch(`/api/admin/abandoned-carts?id=${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await readError(res, "Failed to move to trash."));
  };
  const restoreCart = async (id) => {
    const res = await fetch("/api/admin/abandoned-carts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isDeleted: false }),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to restore."));
  };
  const deleteCartPermanently = async (id) => {
    const res = await fetch(`/api/admin/abandoned-carts?id=${id}&permanent=true`, { method: "DELETE" });
    if (!res.ok) throw new Error(await readError(res, "Failed to delete."));
  };

  const runRowAction = async (action, messages) => {
    const p = action().then(() => fetchItems(pageAfterRemoving(1)));
    toast.promise(p, {
      loading: messages.loading,
      success: messages.success,
      error: (err) => err.message || messages.error,
    });
    try { await p; } catch { /* surfaced via toast */ }
  };

  const handleTrash = (item) => runRowAction(() => trashCart(item._id), {
    loading: "Moving to trash...",
    success: "Moved to the Trash.",
    error: "Failed to move to trash.",
  });

  const handleRestore = (item) => runRowAction(() => restoreCart(item._id), {
    loading: "Restoring...",
    success: "Restored.",
    error: "Failed to restore.",
  });

  const handleDeletePermanently = async (item) => {
    const ok = await showConfirm(
      `The abandoned cart of ${cartName(item)} will be deleted permanently. This cannot be undone.`,
      "Delete permanently?",
      { confirmText: "Delete Permanently", danger: true }
    );
    if (!ok) return;
    runRowAction(() => deleteCartPermanently(item._id), {
      loading: "Deleting...",
      success: "Deleted permanently.",
      error: "Failed to delete.",
    });
  };

  const BULK = {
    "Move to Trash": { verb: "moved to the Trash", run: trashCart },
    Restore: { verb: "restored", run: restoreCart },
    "Delete Permanently": { verb: "deleted permanently", run: deleteCartPermanently },
  };

  const handleBulkAction = async () => {
    const def = BULK[bulkAction];
    if (!def) {
      toast.error("Choose a bulk action first.");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Select at least one record.");
      return;
    }
    const n = selectedIds.length;
    const ok = bulkAction === "Delete Permanently"
      ? await showConfirm(
          `${n} record${n === 1 ? "" : "s"} will be deleted permanently. This cannot be undone.`,
          "Delete permanently?",
          { confirmText: "Delete Permanently", danger: true }
        )
      : await showConfirm(`Apply "${bulkAction}" to ${n} record${n === 1 ? "" : "s"}?`);
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
    fetchItems(pageAfterRemoving(done));
    if (failed === 0) toast.success(`${done} record${done === 1 ? "" : "s"} ${def.verb}.`);
    else toast.error(`${bulkAction}: ${done} done, ${failed} failed.`);
  };

  const toggleSelect = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const someSelected = selectedIds.length > 0;
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : items.map((i) => i._id));

  const changeView = (v) => {
    setView(v);
    setBulkAction("Bulk actions");
    setExpanded(null);
  };

  const headerRow = (
    <tr>
      <th scope="col" className="wp-check-col">
        <input
          type="checkbox"
          aria-label="Select all"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={toggleSelectAll}
        />
      </th>
      <th scope="col">Customer</th>
      <th scope="col" className="wp-hide-sm">Location</th>
      <th scope="col" className="wp-hide-sm wp-num" style={{ textAlign: "right" }}>Cart</th>
      <th scope="col">Status</th>
      <th scope="col" className="wp-hide-sm">Last activity</th>
    </tr>
  );

  const pager = (
    <div className="wp-pages">
      <span>{pagination.total} {pagination.total === 1 ? "item" : "items"}</span>
      <button
        type="button"
        className="wp-pager"
        aria-label="Previous page"
        disabled={loading || pagination.currentPage <= 1}
        onClick={() => fetchItems(pagination.currentPage - 1)}
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>
      <span>{pagination.currentPage} of {pagination.pages}</span>
      <button
        type="button"
        className="wp-pager"
        aria-label="Next page"
        disabled={loading || pagination.currentPage >= pagination.pages}
        onClick={() => fetchItems(pagination.currentPage + 1)}
      >
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <RequirePermission permission="orders.view">
      <Page>
        <PageHeader title="Abandoned Carts" />
        <p className="wp-desc" style={{ margin: "0 0 8px" }}>
          Checkout sessions where a shopper started entering their details. Completed ones turned into an order.
        </p>

        <nav className="wp-subsub" aria-label="Filter abandoned carts by status">
          {VIEWS.map((tab, i) => (
            <Fragment key={tab.value}>
              {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
              <button
                type="button"
                className={view === tab.value ? "is-current" : undefined}
                aria-current={view === tab.value ? "page" : undefined}
                onClick={() => changeView(tab.value)}
              >
                {tab.label} <span className="wp-count">({counts ? (counts[tab.value] ?? 0) : "-"})</span>
              </button>
            </Fragment>
          ))}
        </nav>

        <div className="wp-toolbar">
          <label htmlFor="abandoned-carts-bulk" className="sr-only">Bulk actions</label>
          <select
            id="abandoned-carts-bulk"
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
              <option>Move to Trash</option>
            )}
          </select>
          <button type="button" className="wp-btn" onClick={handleBulkAction}>Apply</button>
          <span className="wp-spacer" />
          <form className="wp-search" role="search" onSubmit={runSearchNow}>
            <label htmlFor="abandoned-carts-search" className="sr-only">Search abandoned carts</label>
            <input
              id="abandoned-carts-search"
              type="search"
              placeholder="Search carts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="wp-input"
            />
            <button type="submit" className="wp-btn">Search</button>
          </form>
        </div>

        <div className="wp-toolbar">
          <span className="wp-spacer" />
          {pager}
        </div>

        {loadError && (
          <Notice type="error" onDismiss={() => setLoadError("")}>
            {loadError}{" "}
            <button type="button" className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => fetchItems(pagination.currentPage)}>
              Try again
            </button>
          </Notice>
        )}

        <div className="wp-table-box">
          <table className="wp-list-table">
            <thead>{headerRow}</thead>
            <tbody>
              {loading && items.length === 0 ? (
                [0, 1, 2, 3].map((i) => (
                  <tr key={`sk-${i}`} aria-hidden="true">
                    <td className="wp-check-col"><Skeleton height={16} width={16} /></td>
                    <td><Skeleton height={16} width="60%" /><Skeleton height={12} width="45%" style={{ marginTop: 8 }} /></td>
                    <td className="wp-hide-sm"><Skeleton height={14} width="70%" /></td>
                    <td className="wp-hide-sm"><Skeleton height={14} width={60} style={{ marginLeft: "auto" }} /></td>
                    <td><Skeleton height={22} width={84} /></td>
                    <td className="wp-hide-sm"><Skeleton height={14} width="70%" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="wp-muted">
                    {search
                      ? <>No abandoned carts match &ldquo;{search}&rdquo;.</>
                      : isTrash ? "No abandoned carts in the Trash." : "No abandoned carts found."}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const name = cartName(item);
                  const isOpen = expanded === item._id;
                  const toggleOpen = () => setExpanded(isOpen ? null : item._id);
                  const count = (item.items || []).reduce((n, it) => n + (Number(it.quantity) || 1), 0);
                  const amount = formatMoney(item.cartTotal || item.cartSubtotal || 0);
                  const selected = selectedIds.includes(item._id);
                  return (
                    <Fragment key={item._id}>
                      <tr className={selected || isOpen ? "is-selected" : undefined}>
                        <td className="wp-check-col">
                          <input
                            type="checkbox"
                            aria-label={`Select ${name}`}
                            checked={selected}
                            onChange={() => toggleSelect(item._id)}
                          />
                        </td>
                        <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                          <button
                            type="button"
                            className="wp-row-title"
                            aria-expanded={isOpen}
                            style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}
                            onClick={toggleOpen}
                          >
                            {name}
                          </button>
                          {item.contact?.email && (
                            <div className="wp-small" style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, wordBreak: "break-all" }}>
                              <Mail className="w-3 h-3 shrink-0" aria-hidden="true" />{item.contact.email}
                            </div>
                          )}
                          {item.contact?.phone && (
                            <div className="wp-small wp-muted" style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                              <Phone className="w-3 h-3 shrink-0" aria-hidden="true" />{item.contact.phone}
                            </div>
                          )}
                          <div className="wp-mobile-meta">
                            {count} item{count === 1 ? "" : "s"} · <span className="wp-strong">{amount}</span> · {fmtDateTime(item.updatedAt)}
                          </div>
                          <div className="wp-row-actions">
                            {isTrash ? (
                              <>
                                <span><button type="button" onClick={() => handleRestore(item)}>Restore</button></span>
                                <span><button type="button" className="is-danger" onClick={() => handleDeletePermanently(item)}>Delete Permanently</button></span>
                              </>
                            ) : (
                              <>
                                <span><button type="button" onClick={toggleOpen}>{isOpen ? "Hide details" : "View details"}</button></span>
                                <span><button type="button" className="is-danger" onClick={() => handleTrash(item)}>Trash</button></span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="wp-hide-sm wp-muted">
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                            {[item.shippingAddress?.city, item.shippingAddress?.state, item.shippingAddress?.country].filter(Boolean).join(", ") || "—"}
                          </div>
                          <div className="wp-small" style={{ marginTop: 2 }}>IP: {item.ipAddress || "—"}</div>
                        </td>
                        <td className="wp-hide-sm wp-num" style={{ whiteSpace: "nowrap" }}>
                          <div className="wp-strong">{amount}</div>
                          <div className="wp-muted wp-small">{count} item{count === 1 ? "" : "s"}</div>
                        </td>
                        <td>
                          <span className={`wp-pill wp-pill-sm ${item.status === "recovered" ? "wp-st-delivered" : "wp-st-confirmed"}`}>
                            {item.status === "recovered" ? "Completed" : "In Progress"}
                          </span>
                          {item.recoveryEmail?.sent && (
                            <div className="wp-muted wp-small" style={{ marginTop: 4 }}>Recovery email sent</div>
                          )}
                        </td>
                        <td className="wp-hide-sm wp-muted">
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />{fmtDateTime(item.updatedAt)}
                          </div>
                          <div className="wp-small" style={{ marginTop: 2 }}>Started: {fmtDateTime(item.createdAt)}</div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="is-selected">
                          <td colSpan={6}>
                            <div className="wp-order-cols" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", padding: "4px 0" }}>
                              <div style={{ minWidth: 0 }}>
                                <h3>Shipping address entered</h3>
                                <address className="wp-addr" style={{ wordBreak: "break-word" }}>
                                  {item.shippingAddress?.fullName || "—"}<br />
                                  {item.shippingAddress?.street || "—"}<br />
                                  {[item.shippingAddress?.city, item.shippingAddress?.state, item.shippingAddress?.zip].filter(Boolean).join(", ") || "—"}<br />
                                  {item.shippingAddress?.country || "—"}<br />
                                  {item.shippingAddress?.phone || "—"}
                                </address>
                                <p className="wp-muted wp-small" style={{ margin: "8px 0 0", wordBreak: "break-all" }}>IP: {item.ipAddress || "—"}</p>
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <h3>Cart items</h3>
                                {(item.items || []).length === 0 ? <p className="wp-muted" style={{ margin: 0 }}>No items</p> : (
                                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                                    {item.items.map((it, idx) => (
                                      <li key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        {it.image && (
                                          <span className="wp-thumb" style={{ width: 32, height: 32 }}>
                                            <img src={it.image} alt="" />
                                          </span>
                                        )}
                                        <span style={{ minWidth: 0, wordBreak: "break-word" }}>
                                          {it.name} × {it.quantity} — <span className="wp-strong">{formatMoney((it.price || 0) * (it.quantity || 1))}</span>
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {item.recoveryEmail?.sent && (
                                  <p className="wp-muted wp-small" style={{ margin: "10px 0 0" }}>
                                    Recovery email sent {fmtDateTime(item.recoveryEmail.sentAt)}
                                    {item.recoveryEmail.voucherCode && <> · voucher <span className="font-mono">{item.recoveryEmail.voucherCode}</span></>}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
