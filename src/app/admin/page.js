"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { PenLine, Gift, Star, HelpCircle, Link2, Ruler, Package, ShoppingCart, Users, FileText, Layers, RefreshCw } from "lucide-react";
import { DASHBOARD_RANGES, getRangeWindow, bucketKeys, bucketLabel, percentChange } from "@/lib/admin-dashboard";
import { Page, PageHeader, Postbox, Notice, StatusPill, ORDER_STATUSES, formatMoney, formatDate, timeAgo, Skeleton } from "@/components/admin/ui";

const RANGE_KEY = "admin_dashboard_range";
const subscribeToNothing = () => () => {};

const ACTIVITY_ICONS = {
  "custom-inquiry": PenLine,
  "gifting-inquiry": Gift,
  review: Star,
  question: HelpCircle,
  affiliate: Link2,
  "size-reply": Ruler,
};

function readSavedRange() {
  try {
    const saved = localStorage.getItem(RANGE_KEY);
    return DASHBOARD_RANGES[saved] ? saved : "7d";
  } catch {
    return "7d";
  }
}

function Delta({ current, previous, money, currency, label }) {
  const pct = percentChange(current, previous);
  if (pct === null) return <div className="wp-stat-delta">No data for the {label}</div>;
  const dir = pct > 0 ? "wp-up" : pct < 0 ? "wp-down" : "";
  const sign = pct > 0 ? "+" : "";
  const was = money ? formatMoney(previous, currency) : previous.toLocaleString();
  return (
    <div className={`wp-stat-delta ${dir}`}>
      {sign}{pct.toFixed(1)}% <span className="wp-muted" style={{ fontWeight: 400 }}>vs {was} the {label}</span>
    </div>
  );
}

function SalesChart({ rangeWindow, buckets, currency }) {
  const keys = bucketKeys(rangeWindow);
  const bars = keys.map((k) => ({ key: k, gross: buckets?.[k]?.gross || 0, orders: buckets?.[k]?.orders || 0 }));
  const max = Math.max(0, ...bars.map((b) => b.gross));
  const total = bars.reduce((s, b) => s + b.gross, 0);
  // Keep axis labels readable: at most ~12 visible labels whatever the bucket count.
  const every = Math.ceil(bars.length / 12);

  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="wp-sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        Sales chart, total {formatMoney(total, currency)}
      </figcaption>
      <div className="wp-chart">
        {bars.map((b) => {
          const label = bucketLabel(b.key, rangeWindow.unit);
          const tip = `${label}: ${formatMoney(b.gross, currency)} · ${b.orders} order${b.orders === 1 ? "" : "s"}`;
          return (
            <div key={b.key} className="wp-bar-col" tabIndex={0} aria-label={tip}>
              <span className="wp-bar-tip">{tip}</span>
              <div
                className={`wp-bar ${b.gross ? "" : "is-empty"}`}
                style={{ height: max ? `${Math.max(1, (b.gross / max) * 100)}%` : "2px" }}
              />
            </div>
          );
        })}
      </div>
      <div className="wp-chart-x" aria-hidden="true">
        {bars.map((b, i) => (
          <span key={b.key}>{i % every === 0 ? bucketLabel(b.key, rangeWindow.unit) : ""}</span>
        ))}
      </div>
    </figure>
  );
}

function SectionError({ message, onRetry }) {
  return (
    <div className="wp-empty" role="alert">
      {message}{" "}
      <button type="button" className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function LoadingRows({ rows = 4 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0" }}>
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} height={18} />)}
    </div>
  );
}

export default function AdminDashboard() {
  // The saved range only exists in the browser; the server render and hydration use the default.
  const savedRange = useSyncExternalStore(subscribeToNothing, readSavedRange, () => null);
  const [pickedRange, setPickedRange] = useState(null);
  const range = pickedRange || savedRange || "7d";
  const [reloadKey, setReloadKey] = useState(0);
  const [welcomeHidden, setWelcomeHidden] = useState(false);
  // Last finished request. `loading` is derived: true until a response for the current key lands.
  const [state, setState] = useState({ key: null, error: null, data: null, errors: {}, permissions: null, win: null });

  const rangeWindow = useMemo(() => getRangeWindow(range), [range]);
  const requestKey = `${range}|${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      from: rangeWindow.from.toISOString(),
      to: rangeWindow.to.toISOString(),
      unit: rangeWindow.unit,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });
    fetch(`/api/admin/dashboard?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) throw new Error(json?.error || `Request failed (${res.status})`);
        setState({ key: requestKey, error: null, data: json.data, errors: json.errors || {}, permissions: json.permissions, win: rangeWindow });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setState((s) => ({ ...s, key: requestKey, error: err.message || "Could not load the dashboard." }));
      });
    return () => controller.abort();
  }, [rangeWindow, requestKey]);

  const pickRange = (key) => {
    setPickedRange(key);
    try { localStorage.setItem(RANGE_KEY, key); } catch {}
  };
  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const { error, data, errors, permissions } = state;
  const loading = state.key !== requestKey;
  const sales = data?.sales;
  const orders = data?.orders;
  const stock = data?.stock;
  const glance = data?.glance || {};
  const activity = data?.activity || [];
  const currency = orders?.recent?.[0]?.currency || "USD";
  const firstLoad = loading && !data;
  const periodLabel = { today: "previous day", "7d": "previous 7 days", "30d": "previous 30 days", year: "same period before" }[range];

  const pendingCount = orders?.statusCounts?.Pending || 0;
  const lowCount = stock?.lowStockTotal || 0;
  const showSales = permissions ? permissions.sales : true;
  const showOrders = permissions ? permissions.orders : true;
  const showProducts = permissions ? permissions.products : true;
  const nothingVisible = permissions && !permissions.sales && !permissions.orders && !permissions.products && activity.length === 0 && Object.keys(glance).length === 0;

  const avg = (t) => (t?.orders ? t.gross / t.orders : 0);

  return (
    <Page>
      <PageHeader
        title="Dashboard"
        aside={showSales && (
          <div className="wp-seg" role="group" aria-label="Date range">
            {Object.entries(DASHBOARD_RANGES).map(([key, def]) => (
              <button key={key} type="button" aria-pressed={range === key} onClick={() => pickRange(key)}>
                {def.label}
              </button>
            ))}
          </div>
        )}
      />

      {error && !loading && (
        <Notice type="error">
          The dashboard could not be loaded: {error}.{" "}
          <button type="button" className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={retry}>
            <RefreshCw className="w-3 h-3 inline" /> Try again
          </button>
        </Notice>
      )}

      {!welcomeHidden && !firstLoad && !error && (pendingCount > 0 || lowCount > 0) && (
        <Notice type="info" onDismiss={() => setWelcomeHidden(true)}>
          You have{" "}
          {pendingCount > 0 && <Link className="wp-link" href="/admin/orders">{pendingCount} order{pendingCount === 1 ? "" : "s"} waiting to be confirmed</Link>}
          {pendingCount > 0 && lowCount > 0 && " and "}
          {lowCount > 0 && <Link className="wp-link" href="/admin/products">{lowCount} product{lowCount === 1 ? "" : "s"} running low on stock</Link>}.
        </Notice>
      )}

      {nothingVisible && (
        <Notice type="info">Your role doesn’t include any dashboard reports. Use the menu on the left to get to the sections you work in.</Notice>
      )}

      {showSales && (
        <div className="wp-stats" aria-busy={loading}>
          {[
            { label: "Gross sales", value: sales && formatMoney(sales.current.gross, currency), delta: sales && <Delta current={sales.current.gross} previous={sales.previous.gross} money currency={currency} label={periodLabel} /> },
            { label: "Orders", value: sales && sales.current.orders.toLocaleString(), delta: sales && <Delta current={sales.current.orders} previous={sales.previous.orders} label={periodLabel} /> },
            { label: "Average order", value: sales && formatMoney(avg(sales.current), currency), delta: sales && <Delta current={avg(sales.current)} previous={avg(sales.previous)} money currency={currency} label={periodLabel} /> },
            { label: "New customers", value: sales && sales.current.newCustomers.toLocaleString(), delta: sales && <Delta current={sales.current.newCustomers} previous={sales.previous.newCustomers} label={periodLabel} /> },
          ].map((s) => (
            <div key={s.label} className="wp-stat">
              <div className="wp-stat-label">{s.label}</div>
              {s.value != null ? (
                <>
                  <div className="wp-stat-value">{s.value}</div>
                  {s.delta}
                </>
              ) : errors.sales ? (
                <div className="wp-stat-value wp-muted">—</div>
              ) : (
                <Skeleton height={28} width="70%" style={{ margin: "6px 0" }} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="wp-cols">
        <div className="wp-col-main">
          {showSales && (
            <Postbox
              id="sales"
              title="Sales"
              aside={DASHBOARD_RANGES[range].label}
              footer={sales && (
                <>
                  <span>Total <strong className="wp-strong">{formatMoney(sales.current.gross, currency)}</strong> from {sales.current.orders} order{sales.current.orders === 1 ? "" : "s"}</span>
                  <span className="wp-spacer" />
                  <span className="wp-muted wp-small">Cancelled and refunded orders are not counted.</span>
                </>
              )}
            >
              {errors.sales ? <SectionError message={errors.sales} onRetry={retry} /> : sales ? (
                <SalesChart rangeWindow={state.win || rangeWindow} buckets={sales.buckets} currency={currency} />
              ) : <Skeleton height={220} />}
            </Postbox>
          )}

          {showOrders && (
            <Postbox id="recent" title="Recent orders" aside={<Link className="wp-link" href="/admin/orders">View all orders</Link>} flush>
              {errors.orders ? <div className="wp-inside"><SectionError message={errors.orders} onRetry={retry} /></div>
                : !orders ? <div className="wp-inside"><LoadingRows rows={5} /></div>
                : orders.recent.length === 0 ? <div className="wp-inside wp-empty">No orders yet.</div>
                : (
                  <div role="table" aria-label="Recent orders">
                    <div role="row" className="wp-row is-head" style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1.6fr) minmax(0,1fr) auto minmax(80px,auto)" }}>
                      <span role="columnheader">Order</span>
                      <span role="columnheader" className="wp-hide-sm">Customer</span>
                      <span role="columnheader" className="wp-hide-sm">Date</span>
                      <span role="columnheader">Status</span>
                      <span role="columnheader" className="wp-num">Total</span>
                    </div>
                    {orders.recent.map((o, i) => (
                      <div role="row" key={o._id} className={`wp-row ${i % 2 ? "is-alt" : ""}`} style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1.6fr) minmax(0,1fr) auto minmax(80px,auto)" }}>
                        <span role="cell" style={{ minWidth: 0 }}>
                          <Link className="wp-row-title" href={`/admin/orders/${o._id}`}>#{o.orderNumber}</Link>
                          <span className="wp-mobile-meta">{o.customer} · {formatDate(o.createdAt)}</span>
                        </span>
                        <span role="cell" className="wp-hide-sm" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.customer}</span>
                        <span role="cell" className="wp-hide-sm wp-muted">{formatDate(o.createdAt)}</span>
                        <span role="cell"><StatusPill status={o.status} small /></span>
                        <span role="cell" className="wp-num wp-strong">{formatMoney(o.total, o.currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
            </Postbox>
          )}

          {showSales && (
            <Postbox id="top" title="Top sellers" aside={DASHBOARD_RANGES[range].label} flush>
              {errors.sales ? <div className="wp-inside"><SectionError message={errors.sales} onRetry={retry} /></div>
                : !sales ? <div className="wp-inside"><LoadingRows /></div>
                : sales.topSellers.length === 0 ? <div className="wp-inside wp-empty">No sales in this period.</div>
                : sales.topSellers.map((t, i) => (
                  <div key={`${t.productId}-${t.name}`} className={`wp-row ${i % 2 ? "is-alt" : ""}`} style={{ gridTemplateColumns: "40px minmax(0,1fr) auto minmax(90px,auto)" }}>
                    <span className="wp-thumb" aria-hidden="true">
                      {t.image ? <img src={t.image} alt="" /> : (t.name || "?").slice(0, 2).toUpperCase()}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      {t.productId ? <Link className="wp-row-title" href={`/admin/products/${t.productId}`}>{t.name}</Link> : <span className="wp-strong">{t.name}</span>}
                    </span>
                    <span className="wp-num wp-muted">{t.units} sold</span>
                    <span className="wp-num wp-strong">{formatMoney(t.revenue, currency)}</span>
                  </div>
                ))}
            </Postbox>
          )}
        </div>

        <div className="wp-col-side">
          {showOrders && (
            <Postbox id="status" title="Orders by status">
              {errors.orders ? <SectionError message={errors.orders} onRetry={retry} />
                : !orders ? <LoadingRows rows={6} />
                : ORDER_STATUSES.filter((s) => orders.statusCounts[s]).length === 0 ? <div className="wp-empty">No orders yet.</div>
                : ORDER_STATUSES.filter((s) => orders.statusCounts[s]).map((s) => (
                  <div key={s} className="wp-kv">
                    <span className="wp-kv-k"><StatusPill status={s} small /></span>
                    <Link className="wp-kv-v wp-link" href="/admin/orders">{orders.statusCounts[s]}</Link>
                  </div>
                ))}
            </Postbox>
          )}

          {showProducts && (
            <Postbox id="stock" title="Low stock" aside={stock?.lowStockTotal > stock?.lowStock?.length ? `${stock.lowStockTotal} in total` : null}>
              {errors.stock ? <SectionError message={errors.stock} onRetry={retry} />
                : !stock ? <LoadingRows rows={3} />
                : stock.lowStock.length === 0 ? <div className="wp-empty">Everything is above its low-stock threshold.</div>
                : stock.lowStock.map((p, i) => (
                  <div key={`${p.productId}-${p.variant || i}`} className="wp-kv">
                    <span className="wp-kv-k">
                      <Link className="wp-link" href={`/admin/products/${p.productId}?focus=stock`}>{p.name}</Link>
                      {p.variant && <span className="wp-muted wp-small" style={{ display: "block" }}>{p.variant}</span>}
                    </span>
                    <span className={p.stock <= 0 ? "wp-down wp-strong" : "wp-strong"} style={p.stock > 0 ? { color: "var(--wp-warn)" } : undefined}>
                      {p.stock <= 0 ? "Out of stock" : `${p.stock} left`}
                    </span>
                  </div>
                ))}
            </Postbox>
          )}

          {(firstLoad || activity.length > 0 || errors.activity) && (
            <Postbox id="activity" title="Needs your attention">
              {errors.activity ? <SectionError message={errors.activity} onRetry={retry} />
                : firstLoad ? <LoadingRows />
                : activity.map((a, i) => {
                  const Icon = ACTIVITY_ICONS[a.kind] || HelpCircle;
                  return (
                    <div key={`${a.kind}-${i}`} className="wp-activity">
                      <span className="wp-activity-ico" aria-hidden="true"><Icon className="w-4 h-4" /></span>
                      <div style={{ minWidth: 0 }}>
                        <div><strong className="wp-strong">{a.title}</strong> {a.text}</div>
                        <div className="wp-muted wp-small">{timeAgo(a.at)} · <Link className="wp-link" href={a.href}>{a.action}</Link></div>
                      </div>
                    </div>
                  );
                })}
            </Postbox>
          )}

          {Object.keys(glance).length > 0 && (
            <Postbox id="glance" title="At a glance">
              {[
                { key: "publishedProducts", label: "published products", href: "/admin/products", icon: Package },
                { key: "draftProducts", label: "draft products", href: "/admin/products", icon: Package },
                { key: "orders", label: "orders", href: "/admin/orders", icon: ShoppingCart },
                { key: "customers", label: "customers", href: "/admin/customers", icon: Users },
                { key: "posts", label: "blog posts", href: "/admin/blogs", icon: FileText },
                { key: "pages", label: "pages", href: "/admin/pages", icon: Layers },
              ].filter((g) => glance[g.key] != null).map((g) => (
                <div key={g.key} className="wp-kv">
                  <g.icon className="w-4 h-4" style={{ color: "#8c8f94" }} aria-hidden="true" />
                  <Link className="wp-kv-k wp-link" href={g.href}>{glance[g.key].toLocaleString()} {g.label}</Link>
                </div>
              ))}
            </Postbox>
          )}
        </div>
      </div>
    </Page>
  );
}
