"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import RequirePermission from "@/components/admin/RequirePermission";
import { Page, PageHeader, Postbox, Notice, Skeleton, formatMoney } from "@/components/admin/ui";
import {
  BarChart3,
  FileText,
  ShoppingBag,
  Users,
  Radio,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  MousePointer,
  Eye,
  Layers,
  Activity,
  Search,
  Clock,
  User,
  Globe,
  AlertCircle,
  History,
  X
} from "lucide-react";

const TAB_GROUPS = [
  {
    id: "overview",
    label: "Overview",
    icon: BarChart3,
    tabs: [
      { key: "overview", label: "Dashboard Overview" },
    ],
  },
  {
    id: "content",
    label: "Pages & Content",
    icon: FileText,
    tabs: [
      { key: "pages", label: "Pages" },
      { key: "sections", label: "Page Sections" },
      { key: "clicks", label: "Button & Link Clicks" },
      { key: "search", label: "Search & Forms" },
    ],
  },
  {
    id: "ecommerce",
    label: "E-Commerce",
    icon: ShoppingBag,
    tabs: [
      { key: "products", label: "Products" },
      { key: "categories", label: "Categories" },
      { key: "prices", label: "Price Ranges" },
      { key: "variants", label: "Sizes & Colours" },
      { key: "checkout", label: "Checkout Funnel" },
    ],
  },
  {
    id: "audience",
    label: "Audience & Traffic",
    icon: Users,
    tabs: [
      { key: "audience", label: "Audience & Devices" },
      { key: "users", label: "Visitors & Journeys" },
      { key: "retention", label: "Repeat Buyers" },
    ],
  },
  {
    id: "health",
    label: "UX Health",
    icon: AlertCircle,
    tabs: [
      { key: "friction", label: "Friction & Rage Clicks" },
      { key: "errors", label: "Errors" },
    ],
  },
  // Page Speed / Core Web Vitals tab — disabled for now, not removed.
  // {
  //   id: "performance",
  //   label: "Performance",
  //   icon: Activity,
  //   tabs: [
  //     { key: "speed", label: "Page Speed" },
  //   ],
  // },
  {
    id: "live",
    label: "Live Traffic",
    icon: Radio,
    tabs: [
      { key: "live", label: "Realtime Active" },
    ],
  },
];

const TABS = TAB_GROUPS.flatMap((g) => g.tabs);

const FUNNEL_LABELS = {
  view_item: "Viewed product",
  add_to_cart: "Added to cart",
  begin_checkout: "Started checkout",
  add_payment_info: "Entered payment",
  purchase: "Purchased",
};

const TRACKING_CATEGORIES = [
  {
    id: "audience",
    title: "Audience & Traffic Intelligence",
    description: "Real-time visitor counts, traffic sources, devices, and user demographics.",
    icon: Users,
    items: [
      { name: "Live Visitors", desc: "Real-time active visitors currently browsing within the last 5 minutes." },
      { name: "Traffic & Sessions", desc: "Total sessions, unique visitors, returning shoppers, bounce rate, and average session time." },
      { name: "Audience Breakdown", desc: "Device types (desktop, mobile, tablet), browser, OS, and country of origin." },
      { name: "Campaigns & Referrers", desc: "Traffic acquisition source, UTM campaign tags, mediums, and external referring domains." },
      { name: "User Journeys", desc: "Step-by-step chronological action timeline for logged-in and guest customer sessions." },
    ],
  },
  {
    id: "content",
    title: "Pages & UX Interaction",
    description: "Every page view, scroll depth, and interaction with UI elements.",
    icon: FileText,
    items: [
      { name: "Page Views & Dwell Time", desc: "Every URL tracked with classification (home, product, shop, cart, checkout, blog) and dwell time." },
      { name: "Scroll Depth Tracking", desc: "Tracks how far shoppers scroll down each page before leaving or navigating." },
      { name: "Section Visibility", desc: "Auto-detects hero banners, product carousels, and testimonials to measure on-screen exposure time." },
      { name: "Button & Link Clicks", desc: "Captures every button and call-to-action click with destination URL and parent section." },
      { name: "Site Search & Queries", desc: "Tracks internal search keywords, search volume, and searches returning zero results." },
    ],
  },
  {
    id: "ecommerce",
    title: "E-Commerce & Funnel Tracking",
    description: "Complete merchandise tracking from product impressions to completed purchases.",
    icon: ShoppingBag,
    items: [
      { name: "Product Performance", desc: "Catalog views, list impressions, cart adds, quantity sold, and revenue generated per product." },
      { name: "Category Rollups", desc: "Sales, revenue, and page views grouped by merchandise category." },
      { name: "Conversion Funnel", desc: "5-step funnel (View Product -> Add to Cart -> Begin Checkout -> Payment -> Purchase) with drop-off rates." },
      { name: "Size & Variant Choices", desc: "Tracks which size and color variants shoppers select, helping identify inventory demand." },
      { name: "Repeat Buyers", desc: "Customer retention metrics, purchase intervals, and acquisition channels for returning buyers." },
    ],
  },
  {
    id: "health",
    title: "UX Health & Friction",
    description: "Rage clicks, dead clicks, and error diagnostics across the storefront.",
    icon: AlertCircle,
    items: [
      { name: "Rage Clicks", desc: "Flags rapid, repeated clicks on unresponsive elements indicating user frustration." },
      { name: "Dead Clicks", desc: "Detects clicks on non-interactive elements that visitors expected to be clickable." },
      { name: "Errors & Form Friction", desc: "Monitors JavaScript runtime errors, failed API calls, and abandoned checkout form fields." },
    ],
  },
  // Page Speed / Core Web Vitals feature index entry — disabled for now, not removed.
  // {
  //   id: "performance",
  //   title: "Page Speed & Core Web Vitals",
  //   description: "Real-user load performance captured on every page view.",
  //   icon: Activity,
  //   items: [
  //     { name: "Largest Contentful Paint", desc: "Time for the biggest visible element to render — the main loading-speed signal." },
  //     { name: "Cumulative Layout Shift", desc: "Measures unexpected layout movement that frustrates shoppers while a page loads." },
  //     { name: "First Input Delay", desc: "How long the page takes to respond to a shopper's first click or tap." },
  //     { name: "Time To First Byte", desc: "Server response speed, broken down by page and device." },
  //   ],
  // },
];

const DEVICES = ["desktop", "mobile", "tablet"];
const DATE_PRESETS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
  { value: "custom", label: "Custom dates" },
];

const fmtDuration = (ms) => {
  const total = Math.round((ms || 0) / 1000);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  if (m < 60) return `${m}m ${total % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};
const fmtWhen = (value) => (value
  ? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
  : "—");
// Money is formatted in the store currency (from the API payload; USD when unknown).
const moneyFormatter = (currency) => (v) => formatMoney(Number(v) || 0, currency || "USD");
const fmtNum = (v) => (Number(v) || 0).toLocaleString();
const pctText = (v) => `${Number(v || 0)}%`;
let regionNames = null;
const countryName = (code) => {
  const c = String(code || "").trim();
  if (!c || c === "(none)" || c.toLowerCase() === "none") return "Unknown";
  if (!regionNames && typeof Intl !== "undefined" && Intl.DisplayNames) {
    try { regionNames = new Intl.DisplayNames(["en"], { type: "region" }); } catch { regionNames = false; }
  }
  if (regionNames) {
    try {
      const name = regionNames.of(c.toUpperCase());
      if (name && name !== c.toUpperCase()) return name;
    } catch {}
  }
  return c;
};
const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

function downloadCsv(filename, columns = [], rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeColumns = Array.isArray(columns) ? columns : [];
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = safeColumns.map((c) => esc(c.label)).join(",");
  const lines = safeRows.map((r) => safeColumns.map((c) => esc(c.csv ? c.csv(r) : r[c.key])).join(","));
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slugId = (title) => `sa-${String(title || "").replace(/\W+/g, "-").replace(/^-|-$/g, "").toLowerCase()}`;

function KpiStrip({ count, children }) {
  // wp-stats is a 4-up strip (2-up on phones). Lines between tiles are drawn with a 1px grid gap so
  // strips that wrap onto several rows still get row dividers.
  const cols = count === 3 ? "min-[783px]:grid-cols-3!" : count === 5 ? "min-[783px]:grid-cols-5!" : "";
  return (
    <div
      className={`wp-stats ${cols} max-[782px]:[&>*:last-child:nth-child(odd)]:col-span-2`}
      style={{ gap: 1, background: "#dcdcde" }}
    >
      {children}
    </div>
  );
}

function Kpi({ label, value, hint }) {
  return (
    <div className="wp-stat" style={{ background: "#fff", borderRight: 0, borderBottom: 0 }}>
      <div className="wp-stat-label">{label}</div>
      <div className="wp-stat-value" style={{ overflowWrap: "anywhere" }}>{value ?? "0"}</div>
      {hint && <div className="wp-muted wp-small">{hint}</div>}
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <Postbox id={slugId(title)} title={title} aside={action} flush>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </Postbox>
  );
}

function DataTable({ title, columns = [], rows = [], empty = "No data for these filters.", onRowClick, rowHint }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeColumns = Array.isArray(columns) ? columns : [];
  return (
    <Panel
      title={title}
      action={
        <button
          type="button"
          onClick={() => downloadCsv(`${title.replace(/\W+/g, "-").toLowerCase()}.csv`, safeColumns, safeRows)}
          disabled={safeRows.length === 0}
          className="wp-link"
          style={{ background: "none", border: 0, padding: 0, cursor: safeRows.length === 0 ? "default" : "pointer", color: safeRows.length === 0 ? "#a7aaad" : undefined, fontSize: 13 }}
        >
          Export CSV
        </button>
      }
    >
      <table className="wp-list-table">
        <thead>
          <tr>{safeColumns.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {safeRows.length === 0 && (
            <tr><td colSpan={safeColumns.length || 1} className="wp-muted" style={{ padding: "16px 10px" }}>{empty}</td></tr>
          )}
          {safeRows.map((row, i) => (
            <tr
              key={i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              title={rowHint}
              className={onRowClick ? "cursor-pointer hover:bg-[#f0f6fc]!" : ""}
            >
              {safeColumns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function BarRows({ rows = [], valueKey, labelKey, format = (v) => v }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const max = Math.max(1, ...safeRows.map((r) => Number(r[valueKey]) || 0));
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: "4px 12px" }}>
      {safeRows.length === 0 && <li className="wp-empty">No data.</li>}
      {safeRows.map((r) => (
        <li key={String(r[labelKey])} style={{ padding: "8px 0", borderBottom: "1px solid #f0f0f1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
            <span className="wp-strong" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r[labelKey] || "(none)"}</span>
            <span className="wp-muted" style={{ whiteSpace: "nowrap" }}>{format(r[valueKey])}</span>
          </div>
          <div aria-hidden="true" style={{ height: 4, background: "#f0f0f1", borderRadius: 2 }}>
            <div style={{ height: 4, background: "#2271b1", borderRadius: 2, width: `${((Number(r[valueKey]) || 0) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function describeEvent(e, currency) {
  if (e.name === "click") {
    return {
      type: "click",
      icon: MousePointer,
      color: "text-[#135e96] bg-[#f0f6fc] border-[#c5d9ed]",
      title: `Clicked "${e.label || "Element"}"`,
      detail: e.href ? `Destination: ${e.href}` : e.section ? `In section: ${e.section}` : null,
    };
  }
  if (e.name === "section_view") {
    return {
      type: "section",
      icon: Eye,
      color: "text-[#3c434a] bg-[#f6f7f7] border-[#dcdcde]",
      title: `Viewed section "${e.label || "Section"}"`,
      detail: `On screen for ${fmtDuration(e.durationMs)}`,
    };
  }
  if (e.name === "field_interaction") {
    return {
      type: "field",
      icon: AlertCircle,
      color: "text-[#3c434a] bg-[#f6f7f7] border-[#dcdcde]",
      title: `Form field "${e.fieldName}"`,
      detail: e.filled ? "Filled in" : "Left empty / unfocused",
    };
  }
  if (e.name === "search") {
    return {
      type: "search",
      icon: Search,
      color: "text-[#7a5300] bg-[#fcf9e8] border-[#f0c33c]",
      title: `Searched for "${e.search_term}"`,
      detail: null,
    };
  }
  if (e.name === "add_to_cart" || e.name === "purchase" || e.name === "begin_checkout") {
    const names = (e.items || []).map((i) => i.item_name).filter(Boolean).join(", ");
    const val = e.value ? ` · ${formatMoney(Number(e.value), e.currency || currency || "USD")}` : "";
    return {
      type: "ecommerce",
      icon: ShoppingBag,
      color: "text-[#1f3d08] bg-[#edfaef] border-[#68de7c] font-semibold",
      title: `${e.name.replace(/_/g, " ").toUpperCase()}${val}`,
      detail: names || null,
    };
  }
  return {
    type: "event",
    icon: Activity,
    color: "text-[#3c434a] bg-[#f6f7f7] border-[#dcdcde]",
    title: e.name.replace(/_/g, " "),
    detail: null,
  };
}

function JourneyPanel({ visitorId, onClose, currency }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/site-analytics/visitor?visitorId=${encodeURIComponent(visitorId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          if (d.success) {
            setData(d);
            // Default: Only expand the latest session (first item), older sessions start collapsed
            if (d.sessions && d.sessions.length > 0) {
              setExpandedSessions({ [d.sessions[0].session.sessionId]: true });
            }
          } else {
            setData(null);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visitorId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const toggleSession = (sessionId) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  const expandAllSessions = () => {
    if (!data?.sessions) return;
    const all = {};
    data.sessions.forEach((s) => {
      all[s.session.sessionId] = true;
    });
    setExpandedSessions(all);
  };

  const collapseOlderSessions = () => {
    if (!data?.sessions || data.sessions.length === 0) return;
    setExpandedSessions({
      [data.sessions[0].session.sessionId]: true,
    });
  };

  const totalSessions = data?.sessions?.length || 0;
  const totalViews = data?.sessions?.reduce((acc, s) => acc + (s.pageViews?.length || 0), 0) || 0;
  const totalActiveMs = data?.sessions?.reduce((acc, s) => acc + (s.session?.activeMs || 0), 0) || 0;
  const hasConverted = data?.sessions?.some((s) => s.session?.conversionCount > 0);

  const pill = "inline-flex items-center gap-1 rounded-[3px] px-2 py-0.5 text-[12px] whitespace-nowrap shrink-0";

  return (
    <div className="fixed inset-0 z-[99999] overflow-hidden bg-black/50 flex justify-end">
      {/* Background click overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-over drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="journey-title"
        className="relative w-full max-w-full sm:max-w-xl md:max-w-2xl h-[100dvh] max-h-[100dvh] bg-white flex flex-col z-10 box-border overflow-hidden border-l border-[#c3c4c7] text-[13px] text-[#3c434a]"
      >
        {/* Drawer header */}
        <div className="px-4 py-3 border-b border-[#dcdcde] flex items-center justify-between gap-3 shrink-0 min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="wp-avatar" aria-hidden="true">
              {data?.user?.name ? data.user.name.slice(0, 2).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h2 id="journey-title" className="text-[16px] font-semibold text-[#1d2327] truncate m-0">
                  {data?.user ? data.user.name : "Guest Visitor"}
                </h2>
                {hasConverted && (
                  <span className={`${pill} bg-[#c6e1c6] text-[#1f3d08]`}>
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    Converted
                  </span>
                )}
              </div>
              <p className="wp-muted wp-small mt-0.5 truncate min-w-0 m-0">
                {data?.user?.email ? (
                  <span>{data.user.email} · <span className="font-mono">ID: {visitorId.slice(0, 10)}…</span></span>
                ) : (
                  <span>Visitor ID: <span className="font-mono">{visitorId}</span></span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="wp-notice-dismiss shrink-0"
            aria-label="Close visitor journey"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 border-b border-[#dcdcde] divide-x divide-[#dcdcde] shrink-0">
          {[
            ["Sessions", totalSessions],
            ["Page views", totalViews],
            ["Time on site", fmtDuration(totalActiveMs)],
          ].map(([label, value]) => (
            <div key={label} className="px-4 py-2.5 min-w-0">
              <div className="wp-muted">{label}</div>
              <div className="text-[18px] text-[#1d2327] leading-tight">{value}</div>
            </div>
          ))}
        </div>

        {/* Scrollable content: sessions and journey steps */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 bg-[#f0f0f1] min-w-0">
          {loading && (
            <div className="bg-white border border-[#c3c4c7] p-4 space-y-3" aria-busy="true">
              <span className="sr-only">Loading visitor journey…</span>
              <Skeleton height={18} />
              <Skeleton height={18} width="80%" />
              <Skeleton height={18} width="60%" />
            </div>
          )}

          {!loading && !data && (
            <Notice type="error">Could not load visitor journey details.</Notice>
          )}

          {!loading && data && data.sessions?.length === 0 && (
            <div className="wp-empty bg-white border border-[#c3c4c7] px-3">No sessions found for this visitor.</div>
          )}

          {/* Multiple sessions toolbar */}
          {!loading && totalSessions > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 wp-strong">
                <History className="w-4 h-4 text-[#646970]" aria-hidden="true" />
                <span>{totalSessions} Visits Recorded</span>
              </div>
              <div className="wp-subsub" style={{ margin: 0 }}>
                <button
                  type="button"
                  onClick={collapseOlderSessions}
                  title="Keep only the latest session open and collapse earlier visits"
                >
                  Latest only
                </button>
                <span className="wp-sep">|</span>
                <button
                  type="button"
                  onClick={expandAllSessions}
                  title="Expand all visits in full"
                >
                  Expand all
                </button>
              </div>
            </div>
          )}

          {!loading &&
            data?.sessions?.map(({ session, pageViews, unassigned }, sIdx) => {
              const isLatest = sIdx === 0;
              const isExpanded = !!expandedSessions[session.sessionId];
              const isConvertedSession = session.conversionCount > 0;
              const sessionNum = data.sessions.length - sIdx;

              return (
                <div
                  key={session.sessionId}
                  className={`bg-white border overflow-hidden ${isLatest ? "border-[#2271b1]" : "border-[#c3c4c7]"}`}
                >
                  {/* Session header / toggle */}
                  <button
                    type="button"
                    onClick={() => toggleSession(session.sessionId)}
                    className="w-full text-left px-3 py-2.5 cursor-pointer select-none flex flex-col gap-2 min-w-0 bg-white hover:bg-[#f6f7f7]"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center justify-between gap-2 w-full min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[#646970] shrink-0" aria-hidden="true">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>

                        {isLatest ? (
                          <span className={`${pill} bg-[#2271b1] text-white`}>Latest visit</span>
                        ) : (
                          <span className={`${pill} bg-[#dcdcde] text-[#2c3338]`}>Visit #{sessionNum}</span>
                        )}

                        <span className="wp-strong truncate flex items-center gap-1.5 min-w-0">
                          <Clock className="w-3.5 h-3.5 text-[#646970] shrink-0" aria-hidden="true" />
                          <span className="truncate">{fmtWhen(session.startedAt)}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isConvertedSession && (
                          <span className={`${pill} bg-[#c6e1c6] text-[#1f3d08]`}>
                            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                            Converted
                          </span>
                        )}
                        {session.bounced && (
                          <span className={`${pill} bg-[#f8dda7] text-[#5c3f05]`}>Bounced</span>
                        )}
                        <span className="wp-muted wp-small hidden sm:inline-block">
                          {pageViews.length} {pageViews.length === 1 ? "page" : "pages"} · {fmtDuration(session.activeMs)}
                        </span>
                      </div>
                    </div>

                    {/* Metadata line */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 wp-muted wp-small pl-6 min-w-0">
                      <span className="flex items-center gap-1 truncate max-w-full">
                        <Globe className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          Source: {session.source || "Direct"}{session.medium ? ` / ${session.medium}` : ""}
                        </span>
                      </span>

                      <span className="capitalize truncate">
                        {session.device || "Desktop"} · {session.browser || "Browser"}
                      </span>

                      {session.country && <span className="shrink-0">{session.country}</span>}

                      <span className="sm:hidden">
                        {pageViews.length} pages · {fmtDuration(session.activeMs)}
                      </span>

                      {!isExpanded && (
                        <span className="ml-auto text-[#2271b1] flex items-center gap-0.5 shrink-0">
                          <span>View steps</span>
                          <ChevronDown className="w-3 h-3" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded step-by-step journey */}
                  {isExpanded && (
                    <div className="border-t border-[#dcdcde] p-3 space-y-3">
                      {pageViews.length === 0 ? (
                        <p className="wp-muted m-0">No page navigation captured for this session.</p>
                      ) : (
                        <ol className="relative border-l-2 border-[#dcdcde] ml-2 space-y-3 py-1 list-none p-0 m-0">
                          {pageViews.map((pv, pIdx) => (
                            <li key={pv._id} className="relative pl-5">
                              {/* Step node */}
                              <div className="absolute -left-[7px] top-3 w-3 h-3 rounded-full bg-white border-2 border-[#2271b1]" aria-hidden="true" />

                              <div className="border border-[#dcdcde] p-3 space-y-2">
                                <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                                    <span className="wp-muted shrink-0">Step {pIdx + 1}</span>
                                    <span className={`${pill} bg-[#f0f0f1] text-[#3c434a] capitalize`}>
                                      {pv.pageType || "Page"}
                                    </span>
                                    <a
                                      href={pv.path}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="wp-link font-mono break-all inline-flex items-center gap-1 min-w-0"
                                    >
                                      <span>{pv.path}</span>
                                      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                                    </a>
                                  </div>

                                  <span className="wp-muted wp-small shrink-0">{fmtWhen(pv.enteredAt)}</span>
                                </div>

                                {/* Engagement details */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 wp-small wp-muted">
                                  <span>
                                    Time on page: <strong className="wp-strong">{fmtDuration(pv.engagedMs)}</strong>
                                  </span>
                                  <span>
                                    Scroll depth: <strong className="wp-strong">{Math.round(pv.maxScrollPct || 0)}%</strong>
                                  </span>
                                  {pv.referrer && (
                                    <span className="truncate max-w-full" title={pv.referrer}>
                                      From: {pv.referrer}
                                    </span>
                                  )}
                                </div>

                                {/* Actions on the page */}
                                {pv.activity?.length > 0 && (
                                  <div className="pt-2 border-t border-[#f0f0f1] space-y-1.5">
                                    <div className="wp-muted wp-small">
                                      Actions on this page ({pv.activity.length})
                                    </div>
                                    <div className="space-y-1.5">
                                      {pv.activity.map((act, aIdx) => {
                                        const parsed = describeEvent(act, currency);
                                        const ActIcon = parsed.icon;
                                        return (
                                          <div
                                            key={aIdx}
                                            className={`flex items-start gap-2 px-2 py-1.5 rounded-[2px] border text-[12px] ${parsed.color}`}
                                          >
                                            <ActIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                                            <div className="flex-1 min-w-0">
                                              <div className="break-words">{parsed.title}</div>
                                              {parsed.detail && (
                                                <div className="mt-0.5 break-words opacity-90">{parsed.detail}</div>
                                              )}
                                            </div>
                                            <span className="shrink-0 font-mono opacity-80">
                                              {fmtWhen(act.createdAt).slice(-8)}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}

                      {/* Unassigned session actions */}
                      {unassigned?.length > 0 && (
                        <div className="p-3 bg-[#f6f7f7] border border-[#dcdcde] space-y-1.5">
                          <div className="wp-muted wp-small">Other session events ({unassigned.length})</div>
                          <div className="space-y-1">
                            {unassigned.map((e, idx) => {
                              const parsed = describeEvent(e, currency);
                              const ActIcon = parsed.icon;
                              return (
                                <div key={idx} className="flex items-center gap-2 text-[#1d2327] wp-small min-w-0">
                                  <ActIcon className="w-3 h-3 text-[#646970] shrink-0" aria-hidden="true" />
                                  <span className="truncate">{parsed.title}</span>
                                  <span className="wp-muted ml-auto shrink-0 font-mono">{fmtWhen(e.createdAt)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Drawer footer */}
        <div className="wp-box-foot shrink-0">
          <span className="wp-muted truncate">Visitor journey</span>
          <span className="wp-spacer" />
          <button type="button" onClick={onClose} className="wp-btn wp-btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const FILTER_LABELS = {
  range: "Date Range",
  from: "From",
  to: "To",
  device: "Device",
  segment: "Shopper",
  source: "Source",
  medium: "Medium",
  campaign: "Campaign",
  country: "Country",
  browser: "Browser",
  os: "OS",
  pageType: "Page Type",
  category: "Category",
  priceBand: "Price Range",
  productId: "Product",
};

function FilterSelect({ label, paramKey, value, onChange, options = [] }) {
  return (
    <label className="flex flex-col min-w-0">
      <span className="wp-label">{label}</span>
      <select
        value={value || "all"}
        onChange={(e) => onChange(paramKey, e.target.value)}
        className="wp-select wp-full"
      >
        <option value="all">All</option>
        {(options || []).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

const LIVE_POLL_MS = 15000;

// Path form /admin/site-analytics/<tab> (the [tab] route) → tab key.
const tabFromPath = (pathname) => {
  const m = /^\/admin\/site-analytics\/([^/?#]+)/.exec(pathname || "");
  return m ? decodeURIComponent(m[1]) : null;
};

// URL → params with defaults (tab from the query, else the path segment, else overview; range 30).
function paramsFromLocation(pathTab, search) {
  const p = new URLSearchParams(search || "");
  if (pathTab && !p.get("tab")) p.set("tab", pathTab);
  if (!p.get("range") && !(p.get("from") && p.get("to"))) p.set("range", "30");
  if (!p.get("tab")) p.set("tab", "overview");
  return p;
}

function SiteAnalyticsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();

  // Unified client-side params state (initializes from URL, updates instantaneously with zero reload)
  const [paramsState, setParamsState] = useState(() => paramsFromLocation(params?.tab, searchParams.toString()));

  const tab = paramsState.get("tab") || "overview";
  const hasCustom = Boolean(paramsState.get("from") && paramsState.get("to"));
  const query = paramsState.toString();

  // Browser Back/Forward: restore tab + filters from the URL (query form, or the /site-analytics/[tab] path form).
  useEffect(() => {
    const onPopState = () => {
      setParamsState(paramsFromLocation(tabFromPath(window.location.pathname), window.location.search));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Responses are cached by their full query (tab + every filter + dates). Only an exact match is
  // ever shown; anything else shows the loading state until its own response arrives.
  const [cache, setCache] = useState({});
  const [settledRequest, setSettledRequest] = useState(null); // `${query}|${refreshKey}` of the last finished request
  const [fetchError, setFetchError] = useState(null); // { key: query, message }
  const [options, setOptions] = useState(null);
  const [journeyId, setJourneyId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  useEffect(() => {
    fetch("/api/admin/site-analytics?tab=options")
      .then((r) => r.json())
      .then((j) => { if (j.success) setOptions(j.data); })
      .catch(() => {});
  }, []);

  // Fetch (or silently revalidate) the current query. Errors are always recorded against the query.
  useEffect(() => {
    let cancelled = false;
    const requestKey = `${query}|${refreshKey}`;
    fetch(`/api/admin/site-analytics?${query}`)
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        if (!j.success) throw new Error(j.error || "Request failed");
        const payload = { ...j.data, _tab: j.tab, _currency: j.currency };
        setCache((c) => ({ ...c, [query]: payload }));
        setFetchError((e) => (e && e.key === query ? null : e));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Site analytics fetch error:", err);
        setFetchError({ key: query, message: err?.message || "Request failed" });
      })
      .finally(() => {
        if (!cancelled) setSettledRequest(requestKey);
      });

    return () => { cancelled = true; };
  }, [query, refreshKey]);

  const isFetching = settledRequest !== `${query}|${refreshKey}`;

  // Live tab: poll every 15 seconds while the tab is active and the page is visible.
  useEffect(() => {
    if (tab !== "live") return undefined;
    let timer = null;
    const start = () => {
      if (!timer) timer = setInterval(() => setRefreshKey((k) => k + 1), LIVE_POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        setRefreshKey((k) => k + 1);
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tab]);

  // Update parameters with zero page reload. A tab change pushes a history entry (so Back returns
  // to the previous tab); filter changes replace the current one. URL form matches the sidebar link.
  const setParams = useCallback((updates) => {
    const next = new URLSearchParams(paramsState.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === undefined || v === "" || v === "all") {
        next.delete(k);
      } else {
        next.set(k, v);
      }
    }
    if (!next.get("tab")) next.set("tab", "overview");
    if (next.toString() === paramsState.toString()) return;
    if (typeof window !== "undefined") {
      const newUrl = `/admin/site-analytics?${next.toString()}`;
      if (next.get("tab") !== paramsState.get("tab")) {
        window.history.pushState(null, "", newUrl);
      } else {
        window.history.replaceState(null, "", newUrl);
      }
    }
    setParamsState(next);
  }, [paramsState]);

  const onFilter = (key, value) => setParams({ [key]: value });
  const rangeValue = hasCustom ? "custom" : (paramsState.get("range") || "30");

  const onRangeChange = (value) => {
    if (value === "custom") {
      setParams({
        range: null,
        from: paramsState.get("from") || daysAgoIso(30),
        to: paramsState.get("to") || todayIso(),
      });
    } else {
      setParams({ range: value, from: null, to: null });
    }
  };

  const activeFilters = [
    "device",
    "segment",
    "browser",
    "os",
    "source",
    "medium",
    "campaign",
    "country",
    "pageType",
    "category",
    "priceBand",
    "productId",
  ].filter((k) => paramsState.get(k));

  const secondaryKeys = [
    "source",
    "medium",
    "campaign",
    "country",
    "browser",
    "os",
    "pageType",
    "category",
    "priceBand",
    "productId",
  ];
  const secondaryActiveCount = secondaryKeys.filter((k) => paramsState.get(k)).length;

  const openJourney = (visitorId) => setJourneyId(visitorId);
  const pinProduct = (row) => setParams({ productId: row.productId });
  const pinCategory = (row) => setParams({ category: row.category });
  const pinPriceBand = (row) => setParams({ priceBand: row.key });

  const data = cache[query] || null;
  const isReady = Boolean(data && data._tab === tab);
  const queryError = fetchError && fetchError.key === query ? fetchError : null;
  const currency = data?._currency || options?.currency || "USD";
  const fmtMoney = moneyFormatter(currency);
  const retry = () => setRefreshKey((k) => k + 1);

  return (
    <>
      <PageHeader
        title="Visitor analytics"
        actions={<Link href="/admin/analytics" className="wp-btn">Sales analytics</Link>}
        aside={
          <div className="wp-seg" role="group" aria-label="Date range">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={rangeValue === p.value}
                onClick={() => { if (rangeValue !== p.value) onRangeChange(p.value); }}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Filters */}
      <div className="wp-toolbar" role="group" aria-label="Filters">
        {/* Custom dates inline */}
        {hasCustom && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5">
              <span>From</span>
              <input
                type="date"
                value={paramsState.get("from") || ""}
                onChange={(e) => setParams({ from: e.target.value })}
                className="wp-input"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span>To</span>
              <input
                type="date"
                value={paramsState.get("to") || ""}
                onChange={(e) => setParams({ to: e.target.value })}
                className="wp-input"
              />
            </label>
          </div>
        )}

        {/* Shopper type */}
        <select
          aria-label="Shopper type"
          value={paramsState.get("segment") || "all"}
          onChange={(e) => onFilter("segment", e.target.value)}
          className="wp-select"
        >
          <option value="all">All Shoppers</option>
          <option value="customer">Logged-in Customers</option>
          <option value="guest">Guests</option>
        </select>

        {/* Device */}
        <select
          aria-label="Device"
          value={paramsState.get("device") || "all"}
          onChange={(e) => onFilter("device", e.target.value)}
          className="wp-select capitalize"
        >
          <option value="all">All Devices</option>
          {DEVICES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        {/* Toggle more filters */}
        <button
          type="button"
          onClick={() => setShowMoreFilters(!showMoreFilters)}
          className="wp-btn"
          aria-expanded={showMoreFilters}
          aria-controls="sa-more-filters"
        >
          <Filter className="w-3.5 h-3.5" aria-hidden="true" />
          <span>More filters{secondaryActiveCount > 0 ? ` (${secondaryActiveCount})` : ""}</span>
          {showMoreFilters ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
        </button>

        <span className="wp-spacer" />

        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="wp-btn"
          title="Refresh data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
          <span>Refresh</span>
        </button>
        {(activeFilters.length > 0 || hasCustom || (rangeValue !== "30" && !hasCustom)) && (
          <button
            type="button"
            onClick={() => {
              setParams({
                range: "30",
                from: null,
                to: null,
                device: null,
                segment: null,
                source: null,
                medium: null,
                campaign: null,
                country: null,
                browser: null,
                os: null,
                pageType: null,
                category: null,
                priceBand: null,
                productId: null,
              });
            }}
            className="wp-btn"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Expandable secondary filters */}
      {showMoreFilters && (
        <div id="sa-more-filters" className="wp-postbox">
          <div className="wp-inside grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-3">
            <FilterSelect
              label="Traffic Source"
              paramKey="source"
              value={paramsState.get("source")}
              onChange={onFilter}
              options={(options?.sources || []).map((v) => ({ value: v, label: v }))}
            />
            <FilterSelect
              label="UTM Medium"
              paramKey="medium"
              value={paramsState.get("medium")}
              onChange={onFilter}
              options={(options?.mediums || []).map((v) => ({ value: v, label: v }))}
            />
            <FilterSelect
              label="Campaign"
              paramKey="campaign"
              value={paramsState.get("campaign")}
              onChange={onFilter}
              options={(options?.campaigns || []).map((v) => ({ value: v, label: v }))}
            />
            <FilterSelect
              label="Country"
              paramKey="country"
              value={paramsState.get("country")}
              onChange={onFilter}
              options={(options?.countries || []).map((v) => ({ value: v, label: v }))}
            />
            <FilterSelect
              label="Page Type"
              paramKey="pageType"
              value={paramsState.get("pageType")}
              onChange={onFilter}
              options={(options?.pageTypes || []).map((v) => ({ value: v, label: v }))}
            />
            <FilterSelect
              label="Browser"
              paramKey="browser"
              value={paramsState.get("browser")}
              onChange={onFilter}
              options={(options?.browsers || []).map((v) => ({ value: v, label: v }))}
            />
            <FilterSelect
              label="Operating System"
              paramKey="os"
              value={paramsState.get("os")}
              onChange={onFilter}
              options={(options?.oses || []).map((v) => ({ value: v, label: v }))}
            />
            <FilterSelect
              label="Product Category"
              paramKey="category"
              value={paramsState.get("category")}
              onChange={onFilter}
              options={(options?.categories || []).map((v) => ({ value: v, label: v }))}
            />
            <FilterSelect
              label="Price Range"
              paramKey="priceBand"
              value={paramsState.get("priceBand")}
              onChange={onFilter}
              options={(options?.priceBands || []).map((b) => ({ value: b.key, label: b.label }))}
            />
            <FilterSelect
              label="Specific Product"
              paramKey="productId"
              value={paramsState.get("productId")}
              onChange={onFilter}
              options={(options?.products || []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="wp-muted mr-1">Filtered by:</span>
          {activeFilters.map((k) => (
            <span key={k} className="wp-chip min-w-0 max-w-full">
              <span className="wp-muted shrink-0">{FILTER_LABELS[k] || k}:</span>
              <span className="wp-strong truncate">{paramsState.get(k)}</span>
              <button
                type="button"
                onClick={() => setParams({ [k]: null })}
                aria-label={`Remove ${FILTER_LABELS[k] || k} filter`}
                title="Remove filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              const clearObj = Object.fromEntries(activeFilters.map((k) => [k, null]));
              setParams(clearObj);
            }}
            className="wp-link ml-1"
            style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Report groups */}
      <div className="wp-tabs" role="tablist" aria-label="Report groups" style={{ marginBottom: 0 }}>
        {TAB_GROUPS.map((group) => {
          const isGroupActive = group.tabs.some((t) => t.key === tab);
          return (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={isGroupActive}
              onClick={() => setParams({ tab: group.tabs[0].key })}
              className="wp-tab inline-flex items-center gap-1.5"
            >
              <group.icon className="w-4 h-4 hidden sm:inline" aria-hidden="true" />
              <span>{group.label}</span>
            </button>
          );
        })}
      </div>

      {/* Reports within the group */}
      {(() => {
        const currentGroup = TAB_GROUPS.find((g) => g.tabs.some((t) => t.key === tab)) || TAB_GROUPS[0];
        if (currentGroup.tabs.length <= 1) return null;
        return (
          <div className="wp-subsub" role="tablist" aria-label={`${currentGroup.label} reports`} style={{ margin: "10px 0 0" }}>
            {currentGroup.tabs.map((t, i) => {
              const isSubActive = tab === t.key;
              return (
                <span key={t.key} className="inline-flex items-center">
                  {i > 0 && <span className="wp-sep" aria-hidden="true">|</span>}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isSubActive}
                    onClick={() => setParams({ tab: t.key })}
                    className={isSubActive ? "is-current" : undefined}
                  >
                    {t.label}
                  </button>
                </span>
              );
            })}
          </div>
        );
      })()}

      {/* Thin progress bar during background revalidation */}
      <div className="h-0.5 mt-3 mb-3 overflow-hidden" aria-hidden="true">
        {isFetching && (
          <div className="h-full bg-[#2271b1] motion-safe:animate-pulse w-full" />
        )}
      </div>

      {/* No data for this exact query yet: loading, then data or an error */}
      {!isReady && (!queryError || isFetching) && (
        <LoadingBlock />
      )}
      {!isReady && queryError && !isFetching && (
        <Notice type="error">
          Failed to load this view.{" "}
          <button type="button" className="wp-btn" onClick={retry}>Retry</button>
        </Notice>
      )}
      {isReady && queryError && (
        <Notice type="warning">
          Couldn&apos;t refresh this view, so the data shown may be out of date.{" "}
          <button type="button" className="wp-btn" onClick={retry} disabled={isFetching}>Retry</button>
        </Notice>
      )}

      {/* Keep active tab rendered and smooth during background updates */}
      {isReady && tab === "overview" && <OverviewTab data={data} currency={currency} />}
      {isReady && tab === "pages" && (
        <div>
          <DataTable
            title="Pages"
            rows={data.pages || []}
            columns={[
              { key: "path", label: "Path", render: (r) => <span className="font-mono break-all wp-small">{r.path}</span> },
              { key: "pageType", label: "Type" },
              { key: "title", label: "Title" },
              { key: "views", label: "Views" },
              { key: "uniqueVisitors", label: "Unique visitors" },
              { key: "avgTimeMs", label: "Avg time", render: (r) => fmtDuration(r.avgTimeMs) },
              { key: "avgScroll", label: "Avg scroll", render: (r) => `${r.avgScroll}%` },
              { key: "exits", label: "Exits" },
              { key: "exitRate", label: "Exit rate", render: (r) => pctText(r.exitRate) },
            ]}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5">
            <DataTable
              title="Entry pages (bounce)"
              rows={data.entries || []}
              columns={[
                { key: "path", label: "Landing page", render: (r) => <span className="font-mono break-all wp-small">{r.path}</span> },
                { key: "sessions", label: "Sessions" },
                { key: "bounceRate", label: "Bounce", render: (r) => pctText(r.bounceRate) },
                { key: "conversionRate", label: "Converted", render: (r) => pctText(r.conversionRate) },
                { key: "avgSessionMs", label: "Avg time", render: (r) => fmtDuration(r.avgSessionMs) },
              ]}
            />
            <DataTable
              title="Page types"
              rows={data.pageTypes || []}
              columns={[
                { key: "pageType", label: "Type" },
                { key: "views", label: "Views" },
                { key: "uniqueVisitors", label: "Unique visitors" },
                { key: "avgTimeMs", label: "Avg time", render: (r) => fmtDuration(r.avgTimeMs) },
              ]}
            />
          </div>
        </div>
      )}
      {isReady && tab === "sections" && (
        <DataTable
          title="Sections"
          rows={data.sections || []}
          empty="No section views yet. Sections appear once visitors scroll them into view for at least a second."
          columns={[
            { key: "section", label: "Section" },
            { key: "path", label: "Page", render: (r) => <span className="font-mono break-all wp-small">{r.path}</span> },
            { key: "impressions", label: "Views" },
            { key: "uniqueSessions", label: "Unique sessions" },
            { key: "avgMs", label: "Avg time in view", render: (r) => fmtDuration(r.avgMs) },
            { key: "totalMs", label: "Total time in view", render: (r) => fmtDuration(r.totalMs) },
          ]}
        />
      )}
      {isReady && tab === "clicks" && (
        <div>
          <DataTable
            title="Clicks"
            rows={data.labels || []}
            empty="No clicks recorded yet."
            columns={[
              { key: "label", label: "Clicked" },
              { key: "path", label: "On page", render: (r) => <span className="font-mono break-all wp-small">{r.path}</span> },
              { key: "clicks", label: "Clicks" },
              { key: "uniqueSessions", label: "Unique sessions" },
              { key: "sections", label: "Sections", render: (r) => (r.sections || []).filter(Boolean).join(", ") || "—", csv: (r) => (r.sections || []).filter(Boolean).join(" | ") },
            ]}
          />
          <DataTable
            title="Links followed"
            rows={data.links || []}
            columns={[
              { key: "href", label: "Destination", render: (r) => <span className="font-mono break-all wp-small">{r.href}</span> },
              { key: "clicks", label: "Clicks" },
              { key: "uniqueSessions", label: "Unique sessions" },
            ]}
          />
        </div>
      )}
      {isReady && tab === "products" && (
        <DataTable
          title="Products"
          rows={data.products || []}
          onRowClick={pinProduct}
          rowHint="Click to filter the whole dashboard to this product"
          columns={[
            { key: "name", label: "Product" },
            { key: "category", label: "Category" },
            { key: "views", label: "Views" },
            { key: "listImpressions", label: "List impressions" },
            { key: "addToCart", label: "Added to cart" },
            { key: "cartRate", label: "Cart rate", render: (r) => pctText(r.cartRate) },
            { key: "unitsSold", label: "Units sold" },
            { key: "revenue", label: "Revenue", render: (r) => fmtMoney(r.revenue) },
            { key: "avgPrice", label: "Avg price", render: (r) => fmtMoney(r.avgPrice) },
            { key: "uniqueVisitors", label: "Unique visitors" },
          ]}
        />
      )}
      {isReady && tab === "categories" && (
        <div>
          <DataTable
            title="Categories"
            rows={data.categories || []}
            onRowClick={pinCategory}
            rowHint="Click to filter the whole dashboard to this category"
            columns={[
              { key: "category", label: "Category" },
              { key: "productCount", label: "Products" },
              { key: "views", label: "Views" },
              { key: "listImpressions", label: "List impressions" },
              { key: "addToCart", label: "Added to cart" },
              { key: "cartRate", label: "Cart rate", render: (r) => pctText(r.cartRate) },
              { key: "unitsSold", label: "Units sold" },
              { key: "revenue", label: "Revenue", render: (r) => fmtMoney(r.revenue) },
              { key: "uniqueVisitors", label: "Unique visitors" },
            ]}
          />
          <DataTable
            title="Category pages"
            rows={data.categoryPages || []}
            columns={[
              { key: "categorySlug", label: "Category page", render: (r) => <span className="font-mono wp-small">/{r.categorySlug}</span> },
              { key: "views", label: "Views" },
              { key: "uniqueVisitors", label: "Unique visitors" },
            ]}
          />
        </div>
      )}
      {isReady && tab === "prices" && (
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5">
            <Panel title="Product views by price range"><BarRows rows={data.bands || []} valueKey="views" labelKey="label" /></Panel>
            <Panel title="Revenue by price range"><BarRows rows={data.bands || []} valueKey="revenue" labelKey="label" format={fmtMoney} /></Panel>
          </div>
          <DataTable
            title="Price ranges"
            rows={data.bands || []}
            onRowClick={pinPriceBand}
            rowHint="Click to filter the whole dashboard to this price range"
            columns={[
              { key: "label", label: "Price range" },
              { key: "views", label: "Views" },
              { key: "listImpressions", label: "List impressions" },
              { key: "addToCart", label: "Added to cart" },
              { key: "cartRate", label: "Cart rate", render: (r) => pctText(r.cartRate) },
              { key: "unitsSold", label: "Units sold" },
              { key: "revenue", label: "Revenue", render: (r) => fmtMoney(r.revenue) },
              { key: "uniqueVisitors", label: "Unique visitors" },
            ]}
          />
        </div>
      )}
      {isReady && tab === "search" && (
        <div>
          <DataTable
            title="Zero-result searches"
            rows={data.zeroSearches || []}
            empty="No searches with zero results."
            columns={[
              { key: "term", label: "Search" },
              { key: "searches", label: "Searches" },
              { key: "zeroResults", label: "Zero results" },
              { key: "zeroRate", label: "Zero-result rate", render: (r) => pctText(r.zeroRate) },
              { key: "avgResults", label: "Avg results" },
            ]}
          />
          <DataTable
            title="Search terms"
            rows={data.searches || []}
            columns={[
              { key: "term", label: "Search" },
              { key: "searches", label: "Searches" },
              { key: "uniqueSessions", label: "Unique sessions" },
            ]}
          />
          <DataTable
            title="Form fields"
            rows={data.fields || []}
            empty="No form interactions yet. Fields are recorded when a visitor leaves them."
            columns={[
              { key: "field", label: "Field" },
              { key: "path", label: "Page", render: (r) => <span className="font-mono break-all wp-small">{r.path}</span> },
              { key: "interactions", label: "Interactions" },
              { key: "filled", label: "Filled in" },
              { key: "fillRate", label: "Fill rate", render: (r) => pctText(r.fillRate) },
              { key: "uniqueSessions", label: "Unique sessions" },
            ]}
          />
        </div>
      )}
      {isReady && tab === "audience" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
          {[
            ["segment", "Shopper type"], ["device", "Device"], ["browser", "Browser"], ["os", "Operating system"],
            ["source", "Traffic source"], ["medium", "UTM medium"], ["campaign", "Campaign"], ["country", "Country"],
          ].map(([key, title]) => (
            <DataTable
              key={key}
              title={title}
              rows={(data.breakdowns && data.breakdowns[key]) || []}
              columns={[
                key === "country"
                  ? { key: "value", label: title, render: (r) => countryName(r.value), csv: (r) => countryName(r.value) }
                  : { key: "value", label: title },
                { key: "sessions", label: "Sessions" },
                { key: "conversionRate", label: "Converted", render: (r) => pctText(r.conversionRate) },
                { key: "bounceRate", label: "Bounce", render: (r) => pctText(r.bounceRate) },
                { key: "avgSessionMs", label: "Avg time", render: (r) => fmtDuration(r.avgSessionMs) },
              ]}
            />
          ))}
        </div>
      )}
      {isReady && tab === "users" && (
        <div>
          <DataTable
            title="Logged-in customers"
            rows={data.customers || []}
            columns={[
              { key: "name", label: "Customer", render: (r) => <div><div className="wp-strong">{r.name || "—"}</div><div className="wp-muted wp-small">{r.email}</div></div> },
              { key: "sessions", label: "Sessions" },
              { key: "pageViews", label: "Page views" },
              { key: "avgSessionMs", label: "Avg session", render: (r) => fmtDuration(r.avgSessionMs) },
              { key: "conversions", label: "Conversions" },
              { key: "orders", label: "Orders" },
              { key: "revenue", label: "Revenue", render: (r) => fmtMoney(r.revenue) },
              { key: "lastSeen", label: "Last seen", render: (r) => fmtWhen(r.lastSeen) },
              { key: "journey", label: "", csv: () => "", render: (r) => <button type="button" onClick={() => openJourney(r.visitorId)} className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>Journey</button> },
            ]}
          />
          <DataTable
            title="Recent visitors"
            rows={data.recent || []}
            columns={[
              { key: "visitorId", label: "Visitor", render: (r) => <span className="font-mono wp-small">{r.visitorId.slice(0, 8)}…</span> },
              { key: "who", label: "Who", render: (r) => r.userEmail || <span className="wp-muted">Guest</span>, csv: (r) => r.userEmail || "Guest" },
              { key: "device", label: "Device", render: (r) => `${r.device}${r.browser ? ` · ${r.browser}` : ""}${r.os ? ` · ${r.os}` : ""}`, csv: (r) => `${r.device} ${r.browser} ${r.os}` },
              { key: "source", label: "Source", render: (r) => `${r.source}${r.medium ? ` / ${r.medium}` : ""}` },
              { key: "landed", label: "Landed → left", render: (r) => <span className="font-mono wp-small break-all">{r.entryPath} → {r.exitPath}</span>, csv: (r) => `${r.entryPath} -> ${r.exitPath}` },
              { key: "pageViews", label: "Pages", render: (r) => <span>{r.pageViews}{r.bounced && <span className="wp-pill wp-pill-sm wp-st-confirmed" style={{ marginLeft: 6 }}>Bounced</span>}</span> },
              { key: "clickCount", label: "Clicks" },
              { key: "activeMs", label: "Time", render: (r) => fmtDuration(r.activeMs) },
              { key: "lastSeenAt", label: "Last seen", render: (r) => fmtWhen(r.lastSeenAt) },
              { key: "journey", label: "", csv: () => "", render: (r) => <button type="button" onClick={() => openJourney(r.visitorId)} className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>Journey</button> },
            ]}
          />
        </div>
      )}
      {isReady && tab === "variants" && (
        <div>
          <KpiStrip count={3}>
            <Kpi label="Visitors who viewed a product" value={fmtNum(data.viewerSessions)} />
            <Kpi label="Visitors who chose a size or colour" value={fmtNum(data.pickerSessions)} />
            <Kpi label="Choice rate" value={pctText(data.pickRate)} hint="Of product viewers" />
          </KpiStrip>
          <DataTable
            title="Size & colour choices"
            rows={data.options || []}
            empty="No choices yet. A choice is recorded when a shopper picks a size or colour on a product page."
            columns={[
              { key: "path", label: "Product page", render: (r) => <span className="font-mono break-all wp-small">{r.path}</span> },
              { key: "group", label: "Option" },
              { key: "value", label: "Choice" },
              { key: "selections", label: "Selections" },
              { key: "uniqueSessions", label: "Unique sessions" },
            ]}
          />
        </div>
      )}
      {isReady && tab === "errors" && (
        <div>
          <KpiStrip count={3}>
            <Kpi label="Sessions that hit an error" value={fmtNum(data.errorSessions)} />
            <Kpi label="Conversion: sessions with an error" value={pctText(data.errorConversionRate)} />
            <Kpi label="Conversion: all sessions" value={pctText(data.overallConversionRate)} />
          </KpiStrip>
          <DataTable
            title="API errors"
            rows={data.api || []}
            empty="No failed requests. Tracked: server errors and 400, 409, 422 and 429 responses."
            columns={[
              { key: "message", label: "Request" },
              { key: "statuses", label: "Status", render: (r) => (r.statuses || []).join(", ") },
              { key: "count", label: "Count" },
              { key: "uniqueSessions", label: "Unique sessions" },
            ]}
          />
          <DataTable
            title="Form validation messages"
            rows={data.form || []}
            empty="No form validation messages shown."
            columns={[
              { key: "message", label: "Message" },
              { key: "count", label: "Count" },
              { key: "uniqueSessions", label: "Unique sessions" },
            ]}
          />
          <DataTable
            title="Script errors"
            rows={data.js || []}
            empty="No script errors."
            columns={[
              { key: "message", label: "Error" },
              { key: "count", label: "Count" },
              { key: "uniqueSessions", label: "Unique sessions" },
              { key: "paths", label: "Pages", render: (r) => (r.paths || []).join(", ") },
            ]}
          />
        </div>
      )}
      {isReady && tab === "checkout" && (
        <div>
          <KpiStrip count={5}>
            <Kpi label="Started checkout" value={fmtNum(data.kpis?.started)} />
            <Kpi label="Purchased" value={fmtNum(data.kpis?.purchased)} />
            <Kpi label="Checkout conversion" value={pctText(data.kpis?.conversionRate)} />
            <Kpi label="Abandoned" value={fmtNum(data.kpis?.abandoned)} hint={`${pctText(data.kpis?.abandonRate)} of checkouts`} />
            <Kpi label="Saw an error" value={fmtNum(data.kpis?.errorSessions)} />
          </KpiStrip>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5">
            <DataTable
              title="Checkout funnel"
              rows={data.steps || []}
              columns={[
                { key: "step", label: "Step" },
                { key: "sessions", label: "Sessions" },
                { key: "dropFromPrevious", label: "Drop from previous step", render: (r) => pctText(r.dropFromPrevious) },
              ]}
            />
            <DataTable
              title="Why shoppers left"
              rows={data.reasons || []}
              empty="No abandoned checkouts for these filters."
              columns={[
                { key: "reason", label: "Likely reason" },
                { key: "sessions", label: "Sessions" },
                { key: "share", label: "Share", render: (r) => pctText(r.share) },
              ]}
            />
          </div>
          <DataTable
            title="Last field touched before leaving"
            rows={data.leftAt || []}
            empty="No abandoned checkouts with field activity."
            columns={[
              { key: "field", label: "Field" },
              { key: "sessions", label: "Sessions" },
              { key: "share", label: "Share", render: (r) => pctText(r.share) },
            ]}
          />
          <DataTable
            title="Checkout errors"
            rows={data.errors || []}
            empty="No checkout errors."
            columns={[
              { key: "type", label: "Type", render: (r) => (r.type === "api_error" ? "Request" : "Form") },
              { key: "message", label: "Message" },
              { key: "status", label: "Status" },
              { key: "count", label: "Count" },
              { key: "uniqueSessions", label: "Unique sessions" },
            ]}
          />
          <p className="wp-muted" style={{ margin: "-8px 0 20px" }}>Reasons are inferred from what a shopper did just before leaving, so they show likely causes, not confirmed ones.</p>
        </div>
      )}
      {isReady && tab === "retention" && (
        <div>
          <KpiStrip count={8}>
            <Kpi label="Customers (first order in range)" value={fmtNum(data.kpis?.cohortCustomers)} />
            <Kpi label="Bought again" value={pctText(data.kpis?.repeatRate)} hint="Ever, to date" />
            <Kpi label="Bought again within 30 days" value={pctText(data.kpis?.repeat30Rate)} />
            <Kpi label="Bought again within 90 days" value={pctText(data.kpis?.repeat90Rate)} />
            <Kpi label="Median days to second order" value={data.kpis?.medianDaysToSecondOrder ?? "—"} />
            <Kpi label="Avg orders per customer" value={data.kpis?.avgOrders ?? "0"} />
            <Kpi label="Avg lifetime revenue" value={fmtMoney(data.kpis?.avgRevenue)} />
            <Kpi label="Accounts created → purchased" value={`${data.kpis?.accountsCreated || 0} → ${data.kpis?.accountsPurchased || 0}`} />
          </KpiStrip>
          <DataTable
            title="Monthly cohorts"
            rows={data.cohorts || []}
            columns={[
              { key: "month", label: "First order month" },
              { key: "customers", label: "Customers" },
              { key: "repeatRate", label: "Bought again", render: (r) => pctText(r.repeatRate) },
              { key: "repeat30Rate", label: "Within 30 days", render: (r) => pctText(r.repeat30Rate) },
              { key: "avgRevenue", label: "Avg revenue", render: (r) => fmtMoney(r.avgRevenue) },
            ]}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5">
            <DataTable
              title="First visit: where customers came from"
              rows={data.firstTouch || []}
              columns={[
                { key: "source", label: "Source" },
                { key: "customers", label: "Customers" },
                { key: "repeaters", label: "Bought again" },
                { key: "repeatRate", label: "Repeat rate", render: (r) => pctText(r.repeatRate) },
              ]}
            />
            <DataTable
              title="Last visit before the repeat order"
              rows={data.lastTouch || []}
              empty="No repeat orders yet."
              columns={[
                { key: "source", label: "Source" },
                { key: "repeaters", label: "Repeat orders" },
              ]}
            />
          </div>
          <p className="wp-muted" style={{ margin: "-8px 0 20px" }}>Only the date range applies on this tab. Customers count when their first order falls in the range. Guest orders aren&apos;t linked to an account, and visit sources only exist for visits made while logged in.</p>
        </div>
      )}
      {isReady && tab === "friction" && (
        <div>
          <KpiStrip count={3}>
            <Kpi label="Dead clicks" value={fmtNum(data.kpis?.deadClicks)} hint="Clicks that got no response" />
            <Kpi label="Rage-click bursts" value={fmtNum(data.kpis?.rageBursts)} hint="Three or more rapid clicks on one element" />
            <Kpi label="Sessions with friction" value={pctText(data.kpis?.sessionsHitPct)} hint={(data.kpis?.sessionsHit || 0) + " sessions"} />
          </KpiStrip>
          <DataTable
            title="Friction points"
            rows={data.rows || []}
            empty="No dead or rage clicks recorded for these filters."
            columns={[
              { key: "type", label: "Type", render: (r) => (r.type === "rage_click" ? "Rage click" : "Dead click") },
              { key: "label", label: "Element" },
              { key: "path", label: "Page", render: (r) => <span className="font-mono break-all wp-small">{r.path}</span> },
              { key: "count", label: "Count" },
              { key: "uniqueSessions", label: "Unique sessions" },
            ]}
          />
          <p className="wp-muted" style={{ margin: "-8px 0 20px" }}>A dead click is a click on a button or link that gave no visible response within 1.5 seconds. A rage click is three or more rapid clicks on the same element.</p>
        </div>
      )}
      {/* Page Speed tab — disabled for now, not removed. {isReady && tab === "speed" && <SpeedTab data={data} />} */}
      {isReady && tab === "live" && (
        <DataTable
          title={`Live now (${fmtNum(data.count)} active in the last 5 minutes)`}
          rows={data.sessions || []}
          empty="No visitors are active right now. This list refreshes every 15 seconds."
          columns={[
            { key: "visitorId", label: "Visitor", render: (r) => <span className="font-mono wp-small">{r.visitorId.slice(0, 8)}…</span> },
            { key: "who", label: "Who", render: (r) => r.userEmail || <span className="wp-muted">Guest</span>, csv: (r) => r.userEmail || "Guest" },
            { key: "device", label: "Device", render: (r) => `${r.device}${r.browser ? ` · ${r.browser}` : ""}` },
            { key: "source", label: "Source" },
            { key: "exitPath", label: "Current page", render: (r) => <span className="font-mono break-all wp-small">{r.exitPath}</span> },
            { key: "pageViews", label: "Pages" },
            { key: "activeMs", label: "Time", render: (r) => fmtDuration(r.activeMs) },
            { key: "lastSeenAt", label: "Last activity", render: (r) => fmtWhen(r.lastSeenAt) },
            { key: "journey", label: "", csv: () => "", render: (r) => <button type="button" onClick={() => openJourney(r.visitorId)} className="wp-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>Journey</button> },
          ]}
        />
      )}

      {journeyId && <JourneyPanel visitorId={journeyId} onClose={() => setJourneyId(null)} currency={currency} />}
    </>
  );
}

// Page Speed / Core Web Vitals tab UI — disabled for now, not removed.
/*
const VITALS_THRESHOLDS = {
  avgLcp: { good: 2500, ok: 4000 },
  avgCls: { good: 0.1, ok: 0.25 },
  avgFid: { good: 100, ok: 300 },
  avgTtfb: { good: 800, ok: 1800 },
};

function vitalsRating(key, value) {
  if (value === null || value === undefined) return null;
  const t = VITALS_THRESHOLDS[key];
  if (!t) return null;
  if (value <= t.good) return "good";
  if (value <= t.ok) return "needs-improvement";
  return "poor";
}

const VITALS_RATING_STYLE = {
  good: "text-emerald-700",
  "needs-improvement": "text-amber-600",
  poor: "text-red-600",
};

function VitalKpi({ label, value, unit, hint, ratingKey }) {
  const rating = ratingKey ? vitalsRating(ratingKey, value) : null;
  const display = value === null || value === undefined ? "—" : `${value}${unit || ""}`;
  return (
    <Kpi
      label={label}
      value={<span className={rating ? VITALS_RATING_STYLE[rating] : undefined}>{display}</span>}
      hint={hint}
    />
  );
}

function SpeedTab({ data }) {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <VitalKpi label="Largest Contentful Paint" value={data.kpis?.avgLcp} unit="ms" ratingKey="avgLcp" hint={`${fmtNum(data.kpis?.sampleSize)} samples`} />
        <VitalKpi label="Cumulative Layout Shift" value={data.kpis?.avgCls} unit="" ratingKey="avgCls" hint="Lower is better" />
        <VitalKpi label="First Input Delay" value={data.kpis?.avgFid} unit="ms" ratingKey="avgFid" hint="Lower is better" />
        <VitalKpi label="Time To First Byte" value={data.kpis?.avgTtfb} unit="ms" ratingKey="avgTtfb" hint="Server response time" />
      </div>
      <DataTable
        title="Page speed by page & device"
        rows={data.rows || []}
        empty="No Core Web Vitals recorded for these filters yet."
        columns={[
          { key: "path", label: "Page", render: (r) => <span className="font-mono break-all wp-small">{r.path}</span> },
          { key: "device", label: "Device" },
          { key: "sessions", label: "Sessions" },
          { key: "samples", label: "Samples" },
          { key: "avgLcp", label: "LCP", render: (r) => <span className={r.avgLcp !== null ? VITALS_RATING_STYLE[vitalsRating("avgLcp", r.avgLcp)] : ""}>{r.avgLcp ?? "—"}ms</span> },
          { key: "avgCls", label: "CLS", render: (r) => <span className={r.avgCls !== null ? VITALS_RATING_STYLE[vitalsRating("avgCls", r.avgCls)] : ""}>{r.avgCls ?? "—"}</span> },
          { key: "avgFid", label: "FID", render: (r) => <span className={r.avgFid !== null ? VITALS_RATING_STYLE[vitalsRating("avgFid", r.avgFid)] : ""}>{r.avgFid ?? "—"}ms</span> },
          { key: "avgTtfb", label: "TTFB", render: (r) => <span className={r.avgTtfb !== null ? VITALS_RATING_STYLE[vitalsRating("avgTtfb", r.avgTtfb)] : ""}>{r.avgTtfb ?? "—"}ms</span> },
        ]}
      />
      <p className="wp-muted" style={{ margin: "-8px 0 20px" }}>Core Web Vitals are captured directly from real shoppers&apos; browsers. Green is good, amber needs improvement, red is poor, per Google&apos;s standard thresholds.</p>
    </div>
  );
}
*/

function TrackingFeaturesMatrix() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = useMemo(() => {
    return TRACKING_CATEGORIES.map((cat) => {
      if (activeCategory !== "all" && cat.id !== activeCategory) {
        return null;
      }
      const matchingItems = cat.items.filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
      });
      if (matchingItems.length === 0) return null;
      return { ...cat, items: matchingItems };
    }).filter(Boolean);
  }, [activeCategory, searchQuery]);

  const totalTrackedCount = TRACKING_CATEGORIES.reduce((acc, cat) => acc + cat.items.length, 0);

  return (
    <Postbox id="sa-tracking" title="What is being tracked" aside={`${totalTrackedCount} metrics`} flush>
      {/* Filter controls */}
      <div className="wp-toolbar" style={{ margin: 0, padding: "10px 12px", borderBottom: "1px solid #f0f0f1" }}>
        <div className="wp-subsub" role="group" aria-label="Tracking category" style={{ margin: 0 }}>
          <button
            type="button"
            aria-pressed={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
            className={activeCategory === "all" ? "is-current" : undefined}
          >
            All <span className="wp-count">({totalTrackedCount})</span>
          </button>
          {TRACKING_CATEGORIES.map((cat) => (
            <span key={cat.id} className="inline-flex items-center">
              <span className="wp-sep" aria-hidden="true">|</span>
              <button
                type="button"
                aria-pressed={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={activeCategory === cat.id ? "is-current" : undefined}
              >
                {cat.title.split(" ")[0]} <span className="wp-count">({cat.items.length})</span>
              </button>
            </span>
          ))}
        </div>
        <span className="wp-spacer" />
        <div className="wp-search relative">
          <input
            type="search"
            aria-label="Filter tracked features"
            placeholder="Filter features (e.g. friction, cart)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="wp-input"
            style={{ paddingRight: searchQuery ? 28 : undefined }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear filter"
              className="wp-notice-dismiss absolute right-1 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Feature groups */}
      <div className="wp-inside">
        {filteredCategories.length === 0 ? (
          <div className="wp-empty">
            No tracking features match your search &quot;{searchQuery}&quot;.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.id} className="border border-[#dcdcde] p-3 min-w-0">
                  <div className="flex items-start gap-2 pb-2 border-b border-[#f0f0f1]">
                    <Icon className="w-4 h-4 text-[#646970] shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <h3 className="wp-strong" style={{ fontSize: 14, margin: 0 }}>{cat.title}</h3>
                      <p className="wp-muted" style={{ margin: "2px 0 0" }}>{cat.description}</p>
                    </div>
                    <span className="wp-pill wp-pill-sm wp-st-published">Active</span>
                  </div>

                  <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                    {cat.items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2" style={{ padding: "5px 0" }}>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00a32a] shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="min-w-0">
                          <span className="wp-strong">{item.name}:</span>{" "}
                          <span>{item.desc}</span>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="wp-muted wp-small" style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #f0f0f1" }}>
                    {cat.items.length} monitored metrics
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Postbox>
  );
}

function OverviewTab({ data, currency }) {
  const fmtMoney = moneyFormatter(currency);
  const k = data.kpis;
  const maxSessions = Math.max(1, ...data.daily.map((d) => d.sessions));
  const funnelBase = data.funnel[0]?.sessions || 0;
  // Presentation only: totals for the chart's text summary, and tighter bar spacing for long ranges.
  const dailyTotals = data.daily.reduce((t, d) => ({ sessions: t.sessions + (d.sessions || 0), converted: t.converted + (d.converted || 0) }), { sessions: 0, converted: 0 });
  const barGap = data.daily.length > 90 ? 0 : data.daily.length > 31 ? 1 : undefined;
  return (
    <div>
      <KpiStrip count={12}>
        <Kpi label="Sessions" value={k.sessions.toLocaleString()} hint={`${k.liveNow} live now`} />
        <Kpi label="Unique visitors" value={k.visitors.toLocaleString()} hint={`${k.returningPct}% returning`} />
        <Kpi label="Page views" value={k.pageViews.toLocaleString()} hint={`${k.pagesPerSession} pages / session`} />
        <Kpi label="Bounce rate" value={pctText(k.bounceRate)} hint="One page, no conversion, under 10s" />
        <Kpi label="Avg session time" value={fmtDuration(k.avgSessionMs)} />
        <Kpi label="Avg time on page" value={fmtDuration(k.avgTimeOnPageMs)} />
        <Kpi label="Conversion rate" value={pctText(k.conversionRate)} hint="Sessions with a cart, checkout or purchase" />
        <Kpi label="Add-to-cart rate" value={pctText(k.addToCartRate)} hint="Of sessions that viewed a product" />
        <Kpi label="Revenue" value={fmtMoney(k.revenue)} hint={`${k.orders} orders · ${k.units} units`} />
        <Kpi label="Avg order value" value={fmtMoney(k.aov)} />
        <Kpi label="Clicks tracked" value={k.clicks.toLocaleString()} />
        <Kpi label="Logged-in sessions" value={pctText(k.identifiedPct)} />
      </KpiStrip>

      <Postbox
        id="sa-daily"
        title="Daily sessions and sales"
        aside={
          <span className="inline-flex items-center gap-3" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5">
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#2271b1", display: "inline-block" }} /> Sessions
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#dba617", display: "inline-block" }} /> Converted
            </span>
          </span>
        }
      >
        {data.daily.length === 0 ? (
          <div className="wp-empty">No sessions for these filters.</div>
        ) : (
          <figure style={{ margin: 0 }} aria-label={`Daily sessions chart, ${data.daily.length} days: ${dailyTotals.sessions.toLocaleString()} sessions, ${dailyTotals.converted.toLocaleString()} converted`}>
            <div className="wp-chart" style={barGap !== undefined ? { gap: barGap } : undefined}>
              {data.daily.map((d) => {
                const sessionHeight = maxSessions > 0 ? (d.sessions / maxSessions) * 100 : 0;
                const convHeight = maxSessions > 0 ? (d.converted / maxSessions) * 100 : 0;
                const tip = `${d.day}: ${d.sessions} sessions · ${d.converted} converted · ${fmtMoney(d.revenue)}`;
                return (
                  <div key={d.day} className="wp-bar-col" tabIndex={0} aria-label={tip}>
                    <span className="wp-bar-tip">{tip}</span>
                    <div style={{ width: "100%", maxWidth: 44, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 1 }}>
                      {/* Sessions bar */}
                      <div
                        className={`wp-bar ${d.sessions > 0 ? "" : "is-empty"}`}
                        style={{ height: `${Math.max(sessionHeight, d.sessions > 0 ? 4 : 0)}%`, flex: 1, minWidth: 0 }}
                      />
                      {/* Converted bar */}
                      {d.converted > 0 && (
                        <div
                          style={{ height: `${Math.max(convHeight, 4)}%`, width: "35%", maxWidth: 8, minWidth: 1, minHeight: 4, background: "#dba617", borderRadius: "2px 2px 0 0" }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="wp-chart-x" aria-hidden="true" style={{ overflow: "hidden", ...(barGap !== undefined ? { gap: barGap } : {}) }}>
              {data.daily.map((d, idx) => {
                const showLabel = data.daily.length <= 14 || idx % Math.ceil(data.daily.length / 10) === 0 || idx === data.daily.length - 1;
                const dateShort = d.day ? d.day.slice(5) : "";
                return <span key={d.day} style={data.daily.length > 14 ? { overflow: "visible" } : undefined}>{showLabel ? dateShort : ""}</span>;
              })}
            </div>
          </figure>
        )}
      </Postbox>

      {/* Conversion funnel */}
      <Panel title="Conversion funnel">
        <table className="wp-list-table">
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col" className="wp-num">Sessions</th>
              <th scope="col" className="wp-num wp-hide-sm">Events</th>
              <th scope="col">Of product viewers</th>
            </tr>
          </thead>
          <tbody>
            {data.funnel.map((f) => (
              <tr key={f.name}>
                <td className="wp-strong">{FUNNEL_LABELS[f.name]}</td>
                <td className="wp-num">{f.sessions}</td>
                <td className="wp-num wp-hide-sm">{f.events}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div aria-hidden="true" style={{ flex: "1 1 120px", maxWidth: 160, height: 4, background: "#f0f0f1", borderRadius: 2 }}>
                      <div style={{ height: 4, borderRadius: 2, background: "#2271b1", width: `${funnelBase ? (f.sessions / funnelBase) * 100 : 0}%`, minWidth: 2 }} />
                    </div>
                    <span className="wp-muted" style={{ whiteSpace: "nowrap" }}>
                      {funnelBase ? Math.round((f.sessions / funnelBase) * 100) : 0}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Tracking engine & feature matrix */}
      <TrackingFeaturesMatrix />
    </div>
  );
}

function LoadingBlock() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Loading visitor analytics…</span>
      <div className="wp-stats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="wp-stat">
            <Skeleton height={14} width="50%" />
            <Skeleton height={28} width="70%" style={{ margin: "8px 0 2px" }} />
          </div>
        ))}
      </div>
      <Postbox>
        <Skeleton height={220} />
      </Postbox>
    </div>
  );
}

export default function SiteAnalyticsPage() {
  return (
    <RequirePermission permission="analytics.view">
      <Page>
        <Suspense
          fallback={
            <>
              <PageHeader title="Visitor analytics" />
              <LoadingBlock />
            </>
          }
        >
          <SiteAnalyticsView />
        </Suspense>
      </Page>
    </RequirePermission>
  );
}
