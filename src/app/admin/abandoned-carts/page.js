"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { ChevronLeft, ChevronRight, Mail, Phone, MapPin, Clock } from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import { toast } from "react-hot-toast";
import { useSession } from "next-auth/react";
import { usePopup } from "@/context/PopupContext";
import { can } from "@/lib/rbac";

export default function AbandonedCartsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { showConfirm } = usePopup();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [pagination, setPagination] = useState({ total: 0, pages: 1, currentPage: 1 });
  const [expanded, setExpanded] = useState(null);

  const fetchItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/abandoned-carts?page=${page}&status=${statusFilter}&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
        setPagination(data.pagination);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => fetchItems(1), 400);
    return () => clearTimeout(t);
  }, [fetchItems]);

  const handleDelete = async (id) => {
    const ok = await showConfirm("Delete this abandoned cart record permanently?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/abandoned-carts?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Deleted");
        fetchItems(pagination.currentPage);
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const headerRow = (
    <tr>
      <th scope="col">Customer</th>
      <th scope="col" className="wp-hide-sm">Location</th>
      <th scope="col" className="wp-hide-sm">Cart</th>
      <th scope="col">Status</th>
      <th scope="col" className="wp-hide-sm">Last activity</th>
    </tr>
  );

  const pager = (
    <div className="wp-pages">
      <span>{pagination.total} items</span>
      <button
        type="button"
        className="wp-pager"
        aria-label="Previous page"
        disabled={pagination.currentPage === 1}
        onClick={() => fetchItems(pagination.currentPage - 1)}
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>
      <span>{pagination.currentPage} of {pagination.pages}</span>
      <button
        type="button"
        className="wp-pager"
        aria-label="Next page"
        disabled={pagination.currentPage === pagination.pages}
        onClick={() => fetchItems(pagination.currentPage + 1)}
      >
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );

  if (sessionStatus === "loading") return null;

  if (!can(session?.user, "orders.view")) {
    return (
      <AdminPageLayout title="Abandoned Carts" breadcrumbs={[{ label: "Commerce", href: "/admin/orders" }, { label: "Abandoned Carts" }]}>
        <div className="wp-notice wp-notice-error" role="alert">
          <p>You don&apos;t have permission to view this page.</p>
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Abandoned Carts"
      breadcrumbs={[{ label: "Commerce", href: "/admin/orders" }, { label: "Abandoned Carts" }]}
      subtitle="Checkout sessions where a shopper started entering their details but hasn't completed (or has completed) an order."
    >
      <div className="wp-subsub" role="tablist" aria-label="Filter abandoned carts by status">
        {[
          ["active", "Not Yet Completed"],
          ["recovered", "Completed (Recovered)"],
          ["all", "All"],
        ].map(([value, label], i) => (
          <Fragment key={value}>
            {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === value}
              className={statusFilter === value ? "is-current" : undefined}
              onClick={() => setStatusFilter(value)}
            >
              {label}
              {statusFilter === value && <span className="wp-count"> ({pagination.total})</span>}
            </button>
          </Fragment>
        ))}
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        <div className="wp-search" role="search">
          <label htmlFor="abandoned-carts-search" className="sr-only">Search abandoned carts</label>
          <input
            id="abandoned-carts-search"
            type="search"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="wp-input"
          />
        </div>
      </div>

      <div className="wp-toolbar">
        <span className="wp-spacer" />
        {pager}
      </div>

      <div className="wp-table-box">
        <table className="wp-list-table">
          <thead>{headerRow}</thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="wp-muted">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="wp-muted">No abandoned carts found.</td></tr>
            ) : (
              items.map((item) => {
                const name = item.shippingAddress?.fullName || `${item.contact?.firstName || ""} ${item.contact?.lastName || ""}`.trim() || "Unknown";
                const isOpen = expanded === item._id;
                return (
                <Fragment key={item._id}>
                  <tr
                    className={isOpen ? "is-selected" : undefined}
                    style={{ cursor: "pointer" }}
                    onClick={() => setExpanded(expanded === item._id ? null : item._id)}
                  >
                    <td style={{ minWidth: 0, wordBreak: "break-word" }}>
                      <button
                        type="button"
                        className="wp-row-title"
                        aria-expanded={isOpen}
                        style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}
                        onClick={(e) => { e.stopPropagation(); setExpanded(expanded === item._id ? null : item._id); }}
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
                        {item.items?.length || 0} item(s) · ${(item.cartTotal || item.cartSubtotal || 0).toLocaleString()}
                        <br />
                        {new Date(item.updatedAt).toLocaleString()}
                      </div>
                      <div className="wp-row-actions">
                        <span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded(expanded === item._id ? null : item._id); }}>
                            {isOpen ? "Hide details" : "View details"}
                          </button>
                        </span>
                        <span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }}
                            className="is-danger"
                          >
                            Delete permanently
                          </button>
                        </span>
                      </div>
                    </td>
                    <td className="wp-hide-sm wp-muted">
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                        {[item.shippingAddress?.city, item.shippingAddress?.state, item.shippingAddress?.country].filter(Boolean).join(", ") || "—"}
                      </div>
                      <div className="wp-small" style={{ marginTop: 2 }}>IP: {item.ipAddress || "—"}</div>
                    </td>
                    <td className="wp-hide-sm">
                      <div className="wp-strong">{item.items?.length || 0} item(s)</div>
                      <div className="wp-muted wp-small">${(item.cartTotal || item.cartSubtotal || 0).toLocaleString()}</div>
                    </td>
                    <td>
                      <span className={`wp-pill ${item.status === "recovered" ? "wp-st-delivered" : "wp-st-confirmed"}`}>
                        {item.status === "recovered" ? "Completed" : "In Progress"}
                      </span>
                    </td>
                    <td className="wp-hide-sm wp-muted">
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />{new Date(item.updatedAt).toLocaleString()}
                      </div>
                      <div className="wp-small" style={{ marginTop: 2 }}>Started: {new Date(item.createdAt).toLocaleString()}</div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="is-selected">
                      <td colSpan={5}>
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
                            <p className="wp-muted wp-small" style={{ margin: "8px 0 0" }}>IP: {item.ipAddress || "—"}</p>
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
                                    <span style={{ minWidth: 0, wordBreak: "break-word" }}>{it.name} × {it.quantity} — <span className="wp-strong">${((it.price || 0) * (it.quantity || 1)).toLocaleString()}</span></span>
                                  </li>
                                ))}
                              </ul>
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
    </AdminPageLayout>
  );
}
