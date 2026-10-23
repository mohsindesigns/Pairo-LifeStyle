"use client";

import { useState, useEffect } from "react";
import RequirePermission from "@/components/admin/RequirePermission";
import { Page, PageHeader, Postbox, Notice, Skeleton } from "@/components/admin/ui";

const STAT_LABELS = ["Total revenue", "Total orders", "Average order value", "Sales, last 30 days"];

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/admin/analytics");
        const data = await res.json();
        if (data.success) setStats(data.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Page>
        <PageHeader title="Store analytics" />
        <div className="wp-stats" aria-busy="true">
          {STAT_LABELS.map((label) => (
            <div key={label} className="wp-stat">
              <div className="wp-stat-label">{label}</div>
              <Skeleton height={28} width="70%" style={{ margin: "6px 0" }} />
            </div>
          ))}
        </div>
        <Postbox title="Sales, last 30 days">
          <Skeleton height={220} />
        </Postbox>
      </Page>
    );
  }

  if (!stats) {
    return (
      <Page>
        <PageHeader title="Store analytics" />
        <Notice type="error">The store analytics could not be loaded. Reload the page to try again.</Notice>
      </Page>
    );
  }

  const overall = stats.overall[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 };
  const last30 = stats.last30Days[0] || { revenue: 0, count: 0 };

  // Presentation only: scale for the share bars in the ranking lists.
  const topRevenueMax = Math.max(0, ...stats.topProducts.map((p) => Number(p.revenue) || 0));
  const variantUnitsMax = Math.max(0, ...stats.variantInsights.slice(0, 5).map((v) => Number(v.unitsSold) || 0));
  const chartTotal = stats.salesByDay.reduce((s, d) => s + (Number(d.revenue) || 0), 0);

  return (
    <RequirePermission permission="analytics.view">
    <Page>
      <PageHeader title="Store analytics" />

      <div className="wp-stats">
        {[
          { label: STAT_LABELS[0], value: `$${overall.totalRevenue.toLocaleString()}` },
          { label: STAT_LABELS[1], value: overall.totalOrders },
          { label: STAT_LABELS[2], value: `$${Math.round(overall.avgOrderValue || 0).toLocaleString()}` },
          { label: STAT_LABELS[3], value: `$${last30.revenue.toLocaleString()}` },
        ].map((item, i) => (
          <div key={i} className="wp-stat">
            <div className="wp-stat-label">{item.label}</div>
            <div className="wp-stat-value" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="wp-cols">
        <div className="wp-col-main">
          <Postbox id="sales-30" title="Sales, last 30 days" aside="Daily">
            <figure style={{ margin: 0 }} aria-label={`Daily sales for the last 30 days: ${stats.salesByDay.length} days with sales, $${chartTotal.toLocaleString()} in total`}>
              <div className="wp-chart" style={stats.salesByDay.length > 31 ? { gap: 1 } : undefined}>
                {stats.salesByDay.map((day, i) => {
                  const maxRevenue = Math.max(...stats.salesByDay.map(d => d.revenue)) || 1;
                  const height = (day.revenue / maxRevenue) * 100;
                  const tip = `${new Date(day._id).toLocaleDateString()}: $${day.revenue.toLocaleString()}`;
                  return (
                    <div key={i} className="wp-bar-col" tabIndex={0} aria-label={tip}>
                      <span className="wp-bar-tip">{tip}</span>
                      <div className="wp-bar" style={{ height: `${Math.max(height, 5)}%` }} />
                    </div>
                  );
                })}
              </div>
              <div
                aria-hidden="true"
                style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingTop: 6, color: "#646970", fontSize: 12 }}
              >
                <span>{stats.salesByDay[0]?._id || "Start"}</span>
                <span className="wp-hide-sm">Recent history</span>
                <span>{stats.salesByDay[stats.salesByDay.length - 1]?._id || "End"}</span>
              </div>
            </figure>
          </Postbox>
        </div>

        <div className="wp-col-side">
          <Postbox id="top-products" title="Top products" flush>
            {stats.topProducts.map((product, i) => (
              <div key={i} className={`wp-row ${i % 2 ? "is-alt" : ""}`} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <span style={{ minWidth: 0 }}>
                  <span className="wp-strong" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product._id}</span>
                  <span className="wp-muted wp-small">{product.unitsSold} units sold</span>
                  <span aria-hidden="true" style={{ display: "block", height: 4, marginTop: 6, background: "#f0f0f1", borderRadius: 2 }}>
                    <span style={{ display: "block", height: 4, borderRadius: 2, background: "#2271b1", width: `${topRevenueMax ? ((Number(product.revenue) || 0) / topRevenueMax) * 100 : 0}%` }} />
                  </span>
                </span>
                <span className="wp-num wp-strong">${Math.round(product.revenue).toLocaleString()}</span>
              </div>
            ))}
            {stats.topProducts.length === 0 && <div className="wp-inside wp-empty">No sales data yet.</div>}
          </Postbox>
        </div>
      </div>

      <Postbox id="variants" title="Best-selling variants" flush>
        {stats.variantInsights.length === 0 ? (
          <div className="wp-inside wp-empty">Variant data will appear as orders are fulfilled.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="wp-list-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: 48 }}>#</th>
                  <th scope="col">Product</th>
                  <th scope="col">Variant</th>
                  <th scope="col" className="wp-num">Units shipped</th>
                </tr>
              </thead>
              <tbody>
                {stats.variantInsights.slice(0, 5).map((variant, i) => (
                  <tr key={i}>
                    <td className="wp-muted">{i + 1}</td>
                    <td className="wp-strong">{variant._id.name}</td>
                    <td>{variant._id.variant}</td>
                    <td className="wp-num">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        <span aria-hidden="true" className="wp-hide-sm" style={{ display: "inline-block", width: 80, height: 4, background: "#f0f0f1", borderRadius: 2 }}>
                          <span style={{ display: "block", height: 4, borderRadius: 2, background: "#2271b1", width: `${variantUnitsMax ? ((Number(variant.unitsSold) || 0) / variantUnitsMax) * 100 : 0}%` }} />
                        </span>
                        <span className="wp-strong">{variant.unitsSold}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Postbox>
    </Page>
    </RequirePermission>
  );
}
