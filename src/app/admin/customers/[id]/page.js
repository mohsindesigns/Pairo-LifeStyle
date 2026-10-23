"use client";

import { useEffect, useState, use } from "react";
import { ArrowLeft, Package, Calendar, Mail, MapPin, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Page, PageHeader, Postbox, Notice, StatusPill, formatMoney, formatDate } from "@/components/admin/ui";
import RequirePermission from "@/components/admin/RequirePermission";

export default function CustomerDetail({ params }) {
  const { id } = use(params);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchCustomer = async () => {
      // Non-ObjectId ids (e.g. a stray /admin/customers/foo) can't exist: show "not found".
      if (!/^[a-f0-9]{24}$/i.test(String(id || ""))) {
        setCustomer(null);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/admin/customers/${id}`);
        if (res.status === 403) {
          router.push("/admin?error=NoPermission");
          return;
        }
        if (res.status === 401) {
          router.push("/admin-login");
          return;
        }
        const data = await res.json();
        if (res.ok) setCustomer(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomer();
  }, [id, router]);

  if (loading) return (
    <Page>
      <PageHeader title="Loading Customer..." />
      <p className="wp-muted" role="status">Loading details...</p>
    </Page>
  );
  if (!customer) return (
    <Page>
      <PageHeader title="Error" actions={<Link href="/admin/customers" className="wp-btn">Back to Customers</Link>} />
      <Notice type="error">Customer not found.</Notice>
    </Page>
  );

  const orders = customer.orders || [];
  const currency = orders[0]?.currency || "USD";
  const totalSpent = orders.reduce((sum, o) => sum + (o.financials?.total ?? 0), 0);
  const lastOrder = orders[0];
  const initials = (() => {
    const parts = (customer.name || customer.email || "?").trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
  })();

  return (
    <RequirePermission permission="customers.view">
    <Page>
      <PageHeader
        title={customer.name}
        actions={
          <Link href="/admin/customers" className="wp-btn">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to Customers
          </Link>
        }
      />

      {/* Profile header */}
      <section className="wp-postbox" aria-label="Customer profile">
        <div className="wp-inside" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
          <div className="wp-avatar wp-avatar-lg" aria-hidden="true">{initials}</div>
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <h2 className="wp-strong" style={{ fontSize: 18, margin: 0, overflowWrap: "anywhere" }}>{customer.name}</h2>
            <p className="wp-muted" style={{ margin: "2px 0 0", display: "flex", alignItems: "center", gap: 6, overflowWrap: "anywhere" }}>
              <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {customer.email}
            </p>
            <p className="wp-muted wp-small" style={{ margin: "4px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> Customer since {formatDate(customer.createdAt)}
            </p>
          </div>
          <span className="wp-pill" style={{ textTransform: "capitalize" }}>{customer.role || "customer"}</span>
        </div>
      </section>

      {/* KPI strip */}
      <div className="wp-stats">
        <div className="wp-stat">
          <div className="wp-stat-label">Orders</div>
          <div className="wp-stat-value">{orders.length}</div>
        </div>
        <div className="wp-stat">
          <div className="wp-stat-label">Total spent</div>
          <div className="wp-stat-value">{formatMoney(totalSpent, currency)}</div>
        </div>
        <div className="wp-stat">
          <div className="wp-stat-label">Average order</div>
          <div className="wp-stat-value">{formatMoney(orders.length ? totalSpent / orders.length : 0, currency)}</div>
        </div>
        <div className="wp-stat">
          <div className="wp-stat-label">Last order</div>
          <div className="wp-stat-value">{lastOrder ? formatDate(lastOrder.createdAt) : "—"}</div>
        </div>
      </div>

      <div className="wp-cols">
        {/* Main column */}
        <div className="wp-col-main">
          <Postbox id="order-history" title="Order History" aside={`${customer.orders?.length || 0} total orders`} flush>
            <div style={{ overflowX: "auto" }}>
              <table className="wp-list-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th className="wp-hide-sm">Date</th>
                    <th>Status</th>
                    <th className="wp-num">Total</th>
                    <th style={{ width: 40 }}><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {!customer.orders?.length ? (
                    <tr><td colSpan={5} className="wp-muted" style={{ padding: 20, textAlign: "center" }}>No orders placed by this customer yet.</td></tr>
                  ) : (
                    customer.orders?.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/admin/orders/${order.id}`} className="wp-row-title">
                            #{order.orderNumber}
                          </Link>
                          <div className="wp-mobile-meta">{formatDate(order.createdAt)}</div>
                        </td>
                        <td className="wp-hide-sm">{formatDate(order.createdAt)}</td>
                        <td><StatusPill status={order.status} small /></td>
                        <td className="wp-num wp-strong">{formatMoney(order.financials?.total ?? 0, order.currency || currency)}</td>
                        <td>
                          <Link href={`/admin/orders/${order.id}`} className="wp-link" aria-label={`Open order #${order.orderNumber}`}>
                            <ExternalLink className="w-4 h-4" aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Postbox>

          {/* Detailed Item View */}
          {customer.orders?.length > 0 && (
            <Postbox id="item-history" title="Items Purchased">
              {customer.orders.map((order) => (
                <div key={order.id} style={{ marginBottom: 16 }}>
                  <div className="wp-strong" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Package className="w-3.5 h-3.5" aria-hidden="true" />
                    Order #{order.orderNumber} <span className="wp-muted" style={{ fontWeight: 400 }}>— {formatDate(order.createdAt)}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {order.items?.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 10, padding: 8, border: "1px solid #f0f0f1", background: "#f6f7f7", minWidth: 0 }}>
                        <div className="wp-thumb">
                          <img src={item.image} alt={item.name} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="wp-strong" style={{ overflowWrap: "anywhere" }}>{item.name}</div>
                          <div className="wp-muted wp-small">
                            Qty {item.quantity} · {item.selectedVariant?.title || 'Standard'}
                          </div>
                          <div className="wp-small wp-strong">{formatMoney((item.priceAtPurchase || 0) * (item.quantity || 0), order.currency || currency)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Postbox>
          )}

          {/* Addresses */}
          <Postbox id="saved-addresses" title="Saved Addresses">
            {!customer.addresses?.length ? (
              <p className="wp-empty">No addresses saved.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customer.addresses?.map((addr, i) => (
                  <address key={i} className="wp-addr" style={{ display: "flex", gap: 8 }}>
                    <MapPin className="w-4 h-4 shrink-0 text-[#8c8f94]" style={{ marginTop: 3 }} aria-hidden="true" />
                    <span>
                      <span className="wp-strong">{addr.fullName}</span>
                      {addr.isDefault && <span className="wp-pill wp-pill-sm" style={{ marginLeft: 6 }}>Default</span>}<br />
                      {addr.street}<br />
                      {addr.city}, {addr.state} {addr.zipCode}<br />
                      {addr.country}
                    </span>
                  </address>
                ))}
              </div>
            )}
          </Postbox>
        </div>

        {/* Side column */}
        <div className="wp-col-side">
          <Postbox id="account-details" title="Account">
            <div className="wp-kv">
              <span className="wp-kv-k wp-muted">Email</span>
              <span className="wp-kv-v" style={{ overflowWrap: "anywhere", textAlign: "right" }}>{customer.email}</span>
            </div>
            <div className="wp-kv">
              <span className="wp-kv-k wp-muted">Role</span>
              <span className="wp-kv-v" style={{ textTransform: "capitalize" }}>{customer.role || "customer"}</span>
            </div>
            <div className="wp-kv">
              <span className="wp-kv-k wp-muted">Email verified</span>
              <span className="wp-kv-v">{customer.emailVerified ? "Yes" : "No"}</span>
            </div>
            <div className="wp-kv">
              <span className="wp-kv-k wp-muted">Customer since</span>
              <span className="wp-kv-v">{formatDate(customer.createdAt)}</span>
            </div>
            <div className="wp-kv">
              <span className="wp-kv-k wp-muted">Saved addresses</span>
              <span className="wp-kv-v">{customer.addresses?.length || 0}</span>
            </div>
          </Postbox>
        </div>
      </div>
    </Page>
    </RequirePermission>
  );
}
