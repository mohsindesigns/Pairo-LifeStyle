"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import RequirePermission from "@/components/admin/RequirePermission";
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
const fmtMoney = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (v) => (Number(v) || 0).toLocaleString();
const pctText = (v) => `${Number(v || 0)}%`;
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

function Kpi({ label, value, hint }) {
  return (
    <div className="bg-white border border-[#ccd0d4] p-4 shadow-sm rounded-[2px]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#646970]">{label}</p>
      <p className="text-[22px] font-bold text-[#1d2327] mt-1">{value ?? "0"}</p>
      {hint && <p className="text-[11px] text-[#8c8f94] mt-1">{hint}</p>}
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="bg-white border border-[#ccd0d4] shadow-sm rounded-[2px] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#ccd0d4] bg-[#f6f7f7] flex items-center justify-between gap-3">
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#1d2327]">{title}</h3>
        {action}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
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
          className="text-[11px] font-bold uppercase text-[#2271b1] hover:underline disabled:text-gray-300"
        >
          Export CSV
        </button>
      }
    >
      <table className="w-full text-[12px] text-left">
        <thead className="text-[11px] uppercase text-[#646970] bg-[#fbfbfb]">
          <tr>{safeColumns.map((c) => <th key={c.key} className="px-3 py-2 font-bold whitespace-nowrap">{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-[#f0f0f1]">
          {safeRows.length === 0 && (
            <tr><td colSpan={safeColumns.length || 1} className="px-3 py-6 text-center italic text-[#8c8f94]">{empty}</td></tr>
          )}
          {safeRows.map((row, i) => (
            <tr
              key={i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              title={rowHint}
              className={onRowClick ? "cursor-pointer hover:bg-[#f0f6fb]" : ""}
            >
              {safeColumns.map((c) => (
                <td key={c.key} className="px-3 py-2 align-top">{c.render ? c.render(row) : row[c.key]}</td>
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
    <ul className="p-4 space-y-2">
      {safeRows.length === 0 && <li className="text-center italic text-[12px] text-[#8c8f94]">No data.</li>}
      {safeRows.map((r) => (
        <li key={String(r[labelKey])} className="text-[12px]">
          <div className="flex justify-between mb-0.5">
            <span className="text-[#1d2327] truncate pr-2">{r[labelKey] || "(none)"}</span>
            <span className="text-[#646970] whitespace-nowrap">{format(r[valueKey])}</span>
          </div>
          <div className="h-2 bg-[#f0f0f1] rounded-[2px]">
            <div className="h-2 bg-[#2271b1] rounded-[2px]" style={{ width: `${((Number(r[valueKey]) || 0) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function describeEvent(e) {
  if (e.name === "click") {
    return {
      type: "click",
      icon: MousePointer,
      color: "text-blue-600 bg-blue-50 border-blue-200",
      title: `Clicked "${e.label || "Element"}"`,
      detail: e.href ? `Destination: ${e.href}` : e.section ? `In section: ${e.section}` : null,
    };
  }
  if (e.name === "section_view") {
    return {
      type: "section",
      icon: Eye,
      color: "text-purple-600 bg-purple-50 border-purple-200",
      title: `Viewed section "${e.label || "Section"}"`,
      detail: `On screen for ${fmtDuration(e.durationMs)}`,
    };
  }
  if (e.name === "field_interaction") {
    return {
      type: "field",
      icon: AlertCircle,
      color: "text-slate-600 bg-slate-50 border-slate-200",
      title: `Form field "${e.fieldName}"`,
      detail: e.filled ? "Filled in" : "Left empty / unfocused",
    };
  }
  if (e.name === "search") {
    return {
      type: "search",
      icon: Search,
      color: "text-amber-600 bg-amber-50 border-amber-200",
      title: `Searched for "${e.search_term}"`,
      detail: null,
    };
  }
  if (e.name === "add_to_cart" || e.name === "purchase" || e.name === "begin_checkout") {
    const names = (e.items || []).map((i) => i.item_name).filter(Boolean).join(", ");
    const val = e.value ? ` · ${e.currency || "$"}${Number(e.value).toFixed(2)}` : "";
    return {
      type: "ecommerce",
      icon: ShoppingBag,
      color: "text-emerald-700 bg-emerald-50 border-emerald-300 font-bold",
      title: `${e.name.replace(/_/g, " ").toUpperCase()}${val}`,
      detail: names || null,
    };
  }
  return {
    type: "event",
    icon: Activity,
    color: "text-gray-600 bg-gray-50 border-gray-200",
    title: e.name.replace(/_/g, " "),
    detail: null,
  };
}

function JourneyPanel({ visitorId, onClose }) {
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

  return (
    <div className="fixed inset-0 z-[99999] overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      {/* Background click overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-over Drawer Panel - Fixed Viewport Bounds */}
      <div className="relative w-full max-w-full sm:max-w-xl md:max-w-2xl h-screen max-h-screen bg-white shadow-2xl flex flex-col z-10 box-border overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#c3c4c7] bg-[#f6f7f7] flex items-center justify-between gap-3 shrink-0 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-full bg-[#2271b1] text-white flex items-center justify-center font-bold text-[13px] shadow-xs shrink-0">
              {data?.user?.name ? data.user.name.slice(0, 2).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h3 className="text-[14px] font-bold text-[#1d2327] truncate">
                  {data?.user ? data.user.name : "Guest Visitor"}
                </h3>
                {hasConverted && (
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Converted
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#646970] mt-0.5 font-mono truncate min-w-0">
                {data?.user?.email ? (
                  <span>{data.user.email} · <span className="opacity-70">ID: {visitorId.slice(0, 10)}…</span></span>
                ) : (
                  <span>Visitor ID: {visitorId}</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-[3px] transition-colors cursor-pointer shrink-0"
            title="Close Drawer (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Highlights Summary Strip */}
        <div className="grid grid-cols-3 border-b border-[#e5e5e5] bg-white divide-x divide-[#e5e5e5] text-center py-2.5 shrink-0 text-[#1d2327]">
          <div className="px-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#646970]">Sessions</div>
            <div className="text-[15px] font-bold text-[#1d2327] mt-0.5">{totalSessions}</div>
          </div>
          <div className="px-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#646970]">Pageviews</div>
            <div className="text-[15px] font-bold text-[#1d2327] mt-0.5">{totalViews}</div>
          </div>
          <div className="px-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#646970]">Total Dwell</div>
            <div className="text-[15px] font-bold text-[#1d2327] mt-0.5">{fmtDuration(totalActiveMs)}</div>
          </div>
        </div>

        {/* Scrollable Content: Sessions & Journey Steps */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-4 space-y-4 bg-[#f8f9fa] min-w-0">
          {loading && (
            <div className="p-12 text-center text-[13px] text-[#646970] italic">
              Loading visitor chronological timeline…
            </div>
          )}

          {!loading && !data && (
            <div className="p-6 text-center bg-red-50 text-red-700 border border-red-200 rounded text-[13px]">
              Could not load visitor journey details.
            </div>
          )}

          {!loading && data && data.sessions?.length === 0 && (
            <div className="p-6 text-center text-gray-500 italic text-[13px]">
              No sessions found for this visitor.
            </div>
          )}

          {/* Multiple Sessions Toolbar */}
          {!loading && totalSessions > 1 && (
            <div className="flex items-center justify-between gap-2 px-1 text-[12px] bg-white border border-[#e5e5e5] rounded-[4px] p-2.5 shadow-2xs">
              <div className="flex items-center gap-1.5 font-semibold text-[#1d2327]">
                <History className="w-3.5 h-3.5 text-[#2271b1]" />
                <span>{totalSessions} Visits Recorded</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={collapseOlderSessions}
                  className="text-[#50575e] hover:text-[#1d2327] hover:underline font-medium cursor-pointer"
                  title="Keep only the latest session open and collapse earlier visits"
                >
                  Latest Only
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={expandAllSessions}
                  className="text-[#2271b1] hover:underline font-semibold cursor-pointer"
                  title="Expand all visits in full"
                >
                  Expand All
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
                  className={`bg-white border rounded-[4px] shadow-xs overflow-hidden transition-all ${
                    isLatest
                      ? "border-[#2271b1]/50 ring-1 ring-[#2271b1]/20"
                      : "border-[#dcdcde]"
                  }`}
                >
                  {/* Session Card Header / Toggle Button */}
                  <button
                    type="button"
                    onClick={() => toggleSession(session.sessionId)}
                    className={`w-full text-left p-3 sm:p-3.5 transition-colors cursor-pointer select-none flex flex-col gap-2 min-w-0 ${
                      isLatest ? "bg-white hover:bg-slate-50/80" : "bg-[#fbfbfb] hover:bg-[#f3f4f6]"
                    }`}
                    aria-expanded={isExpanded}
                  >
                    {/* Top Row: Chevron, Session Badge, Time, and Status Badges */}
                    <div className="flex items-center justify-between gap-2 w-full min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[#8c8f94] shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#2271b1]" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </span>

                        {isLatest ? (
                          <span className="bg-[#2271b1] text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                            Latest Visit
                          </span>
                        ) : (
                          <span className="bg-[#e0e2e5] text-[#2c3338] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                            Visit #{sessionNum}
                          </span>
                        )}

                        <span className="text-[12px] font-bold text-[#1d2327] truncate flex items-center gap-1.5 min-w-0">
                          <Clock className="w-3.5 h-3.5 text-[#8c8f94] shrink-0" />
                          <span className="truncate">{fmtWhen(session.startedAt)}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isConvertedSession && (
                          <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Converted
                          </span>
                        )}
                        {session.bounced && (
                          <span className="bg-amber-100 text-amber-800 border border-amber-300 font-semibold px-1.5 py-0.5 rounded text-[10px]">
                            Bounced
                          </span>
                        )}
                        <span className="text-[11px] text-[#646970] font-medium hidden sm:inline-block">
                          {pageViews.length} {pageViews.length === 1 ? "page" : "pages"} · {fmtDuration(session.activeMs)}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Summary Line */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#50575e] pl-6 min-w-0">
                      <span className="bg-white border border-[#dcdcde] px-2 py-0.5 rounded-[2px] font-medium flex items-center gap-1 truncate max-w-full">
                        <Globe className="w-3 h-3 text-[#2271b1] shrink-0" />
                        <span className="truncate">
                          Source: {session.source || "Direct"}{session.medium ? ` / ${session.medium}` : ""}
                        </span>
                      </span>

                      <span className="bg-white border border-[#dcdcde] px-2 py-0.5 rounded-[2px] capitalize truncate">
                        {session.device || "Desktop"} · {session.browser || "Browser"}
                      </span>

                      {session.country && (
                        <span className="bg-white border border-[#dcdcde] px-2 py-0.5 rounded-[2px] shrink-0">
                          {session.country}
                        </span>
                      )}

                      <span className="text-[11px] text-[#646970] sm:hidden">
                        {pageViews.length} pages · {fmtDuration(session.activeMs)}
                      </span>

                      {!isExpanded && (
                        <span className="ml-auto text-[11px] text-[#2271b1] font-semibold flex items-center gap-0.5 shrink-0">
                          <span>View steps</span>
                          <ChevronDown className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded Step-by-Step Chronological Journey Timeline */}
                  {isExpanded && (
                    <div className="border-t border-[#e5e5e5] p-3 sm:p-4 bg-white space-y-4">
                      {pageViews.length === 0 ? (
                        <p className="text-[12px] text-gray-400 italic pl-2">No page navigation captured for this session.</p>
                      ) : (
                        <div className="relative border-l-2 border-[#2271b1]/30 ml-3.5 space-y-4 py-1">
                          {pageViews.map((pv, pIdx) => (
                            <div key={pv._id} className="relative pl-5 sm:pl-6">
                              {/* Step Node Dot */}
                              <div className="absolute -left-[7px] top-2 w-3 h-3 rounded-full bg-white border-2 border-[#2271b1] shadow-xs" />

                              {/* Page View Card */}
                              <div className="bg-[#fcfcfc] border border-[#e5e5e5] rounded-[4px] p-3 text-[12px] space-y-2.5 shadow-2xs hover:border-[#ccd0d4] transition-colors">
                                {/* Page Header */}
                                <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="bg-[#1d2327] text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                                      Step {pIdx + 1}
                                    </span>
                                    <span className="bg-[#f0f6fb] text-[#135e96] border border-[#c5d9e8] text-[10px] font-bold px-1.5 py-0.2 rounded uppercase shrink-0">
                                      {pv.pageType || "Page"}
                                    </span>
                                    <a
                                      href={pv.path}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-mono font-bold text-[#1d2327] hover:text-[#2271b1] hover:underline break-all inline-flex items-center gap-1"
                                    >
                                      <span>{pv.path}</span>
                                      <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                                    </a>
                                  </div>

                                  <span className="text-[11px] text-[#8c8f94] shrink-0 font-medium">
                                    {fmtWhen(pv.enteredAt)}
                                  </span>
                                </div>

                                {/* Engagement details */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#50575e] bg-white p-2 rounded border border-[#f0f0f1]">
                                  <span className="flex items-center gap-1 font-medium">
                                    <Clock className="w-3 h-3 text-[#2271b1]" />
                                    Time on page: <strong className="text-[#1d2327]">{fmtDuration(pv.engagedMs)}</strong>
                                  </span>
                                  <span>·</span>
                                  <span className="flex items-center gap-1 font-medium">
                                    Scroll depth: <strong className="text-[#1d2327]">{Math.round(pv.maxScrollPct || 0)}%</strong>
                                  </span>
                                  {pv.referrer && (
                                    <>
                                      <span>·</span>
                                      <span className="text-[#8c8f94] truncate max-w-xs" title={pv.referrer}>
                                        From: {pv.referrer}
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* On-Page Child Actions / Events */}
                                {pv.activity?.length > 0 && (
                                  <div className="pt-2 border-t border-[#f0f0f1] space-y-1.5">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#8c8f94] flex items-center justify-between">
                                      <span>Actions Captured on Page ({pv.activity.length})</span>
                                    </div>
                                    <div className="space-y-1.5">
                                      {pv.activity.map((act, aIdx) => {
                                        const parsed = describeEvent(act);
                                        const ActIcon = parsed.icon;
                                        return (
                                          <div
                                            key={aIdx}
                                            className={`flex items-start gap-2 p-2 rounded-[3px] border text-[11px] ${parsed.color}`}
                                          >
                                            <ActIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <div className="font-semibold break-words">{parsed.title}</div>
                                              {parsed.detail && (
                                                <div className="text-[10px] opacity-85 mt-0.5 break-words">
                                                  {parsed.detail}
                                                </div>
                                              )}
                                            </div>
                                            <span className="text-[10px] opacity-75 shrink-0 font-mono">
                                              {fmtWhen(act.createdAt).slice(-8)}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Unassigned Session Actions */}
                      {unassigned?.length > 0 && (
                        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-[3px] text-[11px] space-y-1.5">
                          <div className="font-bold text-[#646970] text-[10px] uppercase tracking-wider">
                            Other Session Events ({unassigned.length})
                          </div>
                          <div className="space-y-1">
                            {unassigned.map((e, idx) => {
                              const parsed = describeEvent(e);
                              const ActIcon = parsed.icon;
                              return (
                                <div key={idx} className="flex items-center gap-2 text-[#1d2327]">
                                  <ActIcon className="w-3 h-3 text-[#8c8f94] shrink-0" />
                                  <span className="truncate">{parsed.title}</span>
                                  <span className="text-[10px] text-[#8c8f94] ml-auto shrink-0 font-mono">
                                    {fmtWhen(e.createdAt)}
                                  </span>
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

        {/* Drawer Footer */}
        <div className="p-3 sm:p-3.5 bg-[#f6f7f7] border-t border-[#c3c4c7] flex items-center justify-between text-[11px] text-[#646970] shrink-0">
          <span className="truncate">Visitor Journey Telemetry</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-[#2271b1] text-white font-semibold rounded-[3px] hover:bg-[#135e96] transition-colors cursor-pointer shrink-0"
          >
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
    <label className="flex flex-col gap-1 min-w-[130px] flex-1">
      <span className="text-[11px] font-bold text-[#646970]">{label}</span>
      <select
        value={value || "all"}
        onChange={(e) => onChange(paramKey, e.target.value)}
        className="border border-[#8c8f94] hover:border-[#2271b1] focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] rounded-[3px] px-2 py-1.5 text-[12px] bg-white text-[#2c3338] outline-none truncate"
      >
        <option value="all">All</option>
        {(options || []).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function SiteAnalyticsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();

  // Unified client-side params state (initializes from URL, updates instantaneously with zero reload)
  const [paramsState, setParamsState] = useState(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (params?.tab && !p.get("tab")) {
      p.set("tab", params.tab);
    }
    if (!p.get("range") && !(p.get("from") && p.get("to"))) {
      p.set("range", "30");
    }
    if (!p.get("tab")) {
      p.set("tab", "overview");
    }
    return p;
  });

  const tab = paramsState.get("tab") || "overview";
  const hasCustom = Boolean(paramsState.get("from") && paramsState.get("to"));
  const query = (() => {
    const q = new URLSearchParams(paramsState.toString());
    return q.toString();
  })();

  // Listen to browser Back/Forward navigation
  useEffect(() => {
    const onPopState = () => {
      const p = new URLSearchParams(window.location.search);
      if (!p.get("tab")) p.set("tab", "overview");
      if (!p.get("range") && !(p.get("from") && p.get("to"))) p.set("range", "30");
      setParamsState(p);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const [data, setData] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(false);
  const [options, setOptions] = useState(null);
  const [journeyId, setJourneyId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const cacheRef = useRef({});

  useEffect(() => {
    fetch("/api/admin/site-analytics?tab=options")
      .then((r) => r.json())
      .then((j) => { if (j.success) setOptions(j.data); })
      .catch(() => {});
  }, []);

  // Fetch data with in-memory caching and silent background revalidation (Stale-While-Revalidate)
  useEffect(() => {
    let cancelled = false;

    // 1. If already in memory cache, display IMMEDIATELY (0ms delay, ZERO flicker)
    if (cacheRef.current[query]) {
      setData(cacheRef.current[query]);
      setError(false);
    } else {
      // If switching tabs, check if we have data for this tab from any query
      const match = Object.values(cacheRef.current).find((d) => d._tab === tab);
      if (match) {
        setData(match);
      }
    }

    setIsFetching(true);
    fetch(`/api/admin/site-analytics?${query}`)
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        if (j.success) {
          const payload = { ...j.data, _tab: j.tab };
          cacheRef.current[query] = payload;
          setData(payload);
          setError(false);
        } else {
          setError(true);
        }
      })
      .catch((err) => {
        console.error("Site analytics fetch error:", err);
        if (!cancelled && !cacheRef.current[query]) setError(true);
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });

    return () => { cancelled = true; };
  }, [query, refreshKey, tab]);


  // Update parameters seamlessly with zero page reload
  const setParams = useCallback((updates) => {
    setParamsState((prev) => {
      const next = new URLSearchParams(prev.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === undefined || v === "" || v === "all") {
          next.delete(k);
        } else {
          next.set(k, v);
        }
      }
      if (typeof window !== "undefined") {
        const queryStr = next.toString();
        const newUrl = queryStr ? `/admin/site-analytics?${queryStr}` : `/admin/site-analytics`;
        window.history.replaceState(null, "", newUrl);
      }
      return next;
    });
  }, []);

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

  const isReady = Boolean(data && data._tab === tab);

  return (
    <div className="space-y-5">
      {/* WordPress Tablenav Filter Bar */}
      <div className="bg-white border border-[#c3c4c7] shadow-sm rounded-[3px] p-3 text-[13px] text-[#2c3338] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Primary Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date Preset */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase text-[#646970] hidden sm:inline">Dates:</span>
              <select
                value={rangeValue}
                onChange={(e) => onRangeChange(e.target.value)}
                className="border border-[#8c8f94] hover:border-[#2271b1] focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] rounded-[3px] px-2.5 py-1.5 text-[12px] font-medium bg-white text-[#2c3338] outline-none"
              >
                {DATE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Dates inline */}
            {hasCustom && (
              <div className="flex items-center gap-1.5 bg-[#f6f7f7] border border-[#dcdcde] px-2 py-1 rounded-[3px]">
                <span className="text-[11px] font-bold text-[#646970]">From</span>
                <input
                  type="date"
                  value={paramsState.get("from") || ""}
                  onChange={(e) => setParams({ from: e.target.value })}
                  className="border border-[#8c8f94] rounded-[2px] px-1.5 py-0.5 text-[11px] bg-white text-[#2c3338]"
                />
                <span className="text-[11px] font-bold text-[#646970]">To</span>
                <input
                  type="date"
                  value={paramsState.get("to") || ""}
                  onChange={(e) => setParams({ to: e.target.value })}
                  className="border border-[#8c8f94] rounded-[2px] px-1.5 py-0.5 text-[11px] bg-white text-[#2c3338]"
                />
              </div>
            )}

            {/* Shopper Type */}
            <select
              value={paramsState.get("segment") || "all"}
              onChange={(e) => onFilter("segment", e.target.value)}
              className="border border-[#8c8f94] hover:border-[#2271b1] focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] rounded-[3px] px-2.5 py-1.5 text-[12px] bg-white text-[#2c3338] outline-none"
            >
              <option value="all">All Shoppers</option>
              <option value="customer">Logged-in Customers</option>
              <option value="guest">Guests</option>
            </select>

            {/* Device */}
            <select
              value={paramsState.get("device") || "all"}
              onChange={(e) => onFilter("device", e.target.value)}
              className="border border-[#8c8f94] hover:border-[#2271b1] focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] rounded-[3px] px-2.5 py-1.5 text-[12px] bg-white text-[#2c3338] outline-none capitalize"
            >
              <option value="all">All Devices</option>
              {DEVICES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* Toggle More Filters */}
            <button
              type="button"
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              className={`px-3 py-1.5 text-[12px] font-semibold border rounded-[3px] transition-colors flex items-center gap-1.5 cursor-pointer ${
                secondaryActiveCount > 0 || showMoreFilters
                  ? "bg-[#f0f6fb] border-[#2271b1] text-[#2271b1]"
                  : "bg-[#f6f7f7] border-[#c3c4c7] text-[#2c3338] hover:bg-[#f0f0f1]"
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-[#2271b1]" />
              <span>More Filters</span>
              {secondaryActiveCount > 0 && (
                <span className="bg-[#2271b1] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {secondaryActiveCount}
                </span>
              )}
              {showMoreFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="px-2.5 py-1.5 text-[12px] border border-[#c3c4c7] rounded-[3px] bg-[#f6f7f7] hover:bg-[#f0f0f1] text-[#2c3338] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Refresh data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-[#2271b1]" : ""}`} />
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
                className="px-2.5 py-1.5 text-[12px] border border-[#c3c4c7] rounded-[3px] bg-white hover:bg-[#f6f7f7] text-[#d63638] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Expandable Secondary Filters */}
        {showMoreFilters && (
          <div className="pt-3 border-t border-[#f0f0f1] bg-[#fbfbfb] -mx-3 -mb-3 p-3 rounded-b-[3px]">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
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

        {/* Active Filter Badges */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[12px]">
            <span className="text-[11px] font-bold text-[#646970] uppercase mr-1">Active:</span>
            {activeFilters.map((k) => (
              <span
                key={k}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#f0f6fb] border border-[#c5d9e8] text-[#135e96] font-medium"
              >
                <span className="text-[#646970]">{FILTER_LABELS[k] || k}:</span>
                <span className="font-semibold">{paramsState.get(k)}</span>
                <button
                  type="button"
                  onClick={() => setParams({ [k]: null })}
                  className="text-[#646970] hover:text-[#d63638] ml-0.5 font-bold cursor-pointer"
                  title="Remove filter"
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => {
                const clearObj = Object.fromEntries(activeFilters.map((k) => [k, null]));
                setParams(clearObj);
              }}
              className="text-[11px] text-[#2271b1] hover:underline ml-1 font-semibold cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* WordPress Categorized Nav-Tabs */}
      <div className="space-y-2">
        <nav className="flex flex-wrap items-center gap-1.5 border-b border-[#c3c4c7] pb-0">
          {TAB_GROUPS.map((group) => {
            const isGroupActive = group.tabs.some((t) => t.key === tab);
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setParams({ tab: group.tabs[0].key })}
                className={`px-3.5 py-2 text-[13px] font-semibold rounded-t-[4px] transition-all flex items-center gap-2 cursor-pointer -mb-[1px] ${
                  isGroupActive
                    ? "bg-white border-t-2 border-t-[#2271b1] border-l border-r border-[#c3c4c7] border-b-white text-[#1d2327] shadow-xs"
                    : "bg-[#f6f7f7] hover:bg-white text-[#50575e] hover:text-[#1d2327] border border-transparent"
                }`}
              >
                <group.icon className={`w-4 h-4 ${isGroupActive ? "text-[#2271b1]" : "text-[#646970]"}`} />
                <span>{group.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Secondary Sub-Tabs (WordPress subsubsub style) */}
        {(() => {
          const currentGroup = TAB_GROUPS.find((g) => g.tabs.some((t) => t.key === tab)) || TAB_GROUPS[0];
          if (currentGroup.tabs.length <= 1) return null;
          return (
            <div className="flex flex-wrap items-center gap-1.5 py-1 px-1 text-[12px]">
              <span className="text-[#646970] font-bold text-[11px] uppercase mr-1">Views:</span>
              {currentGroup.tabs.map((t) => {
                const isSubActive = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setParams({ tab: t.key })}
                    className={`px-2.5 py-1 rounded-[3px] font-medium transition cursor-pointer ${
                      isSubActive
                        ? "bg-[#2271b1] text-white font-bold shadow-xs"
                        : "bg-white border border-[#dcdcde] text-[#50575e] hover:text-[#1d2327] hover:border-[#c3c4c7]"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Top subtle progress bar during background revalidation */}
      <div className="h-0.5 -mt-2 mb-2 overflow-hidden rounded-[2px] bg-transparent">
        {isFetching && (
          <div className="h-full bg-[#2271b1] animate-pulse w-full transition-all duration-300" />
        )}
      </div>

      {/* Only show full loading block when there is NO data in cache yet */}
      {!isReady && !data && isFetching && !error && (
        <div className="p-16 text-center text-[13px] text-gray-500 italic bg-white border border-[#ccd0d4]">
          Loading visitor analytics…
        </div>
      )}
      {error && !data && (
        <div className="p-16 text-center text-[13px] text-red-500 font-bold bg-white border border-[#ccd0d4]">
          Failed to load this view. Please try refreshing.
        </div>
      )}

      {/* Keep active tab rendered and smooth during background updates */}
      {isReady && tab === "overview" && <OverviewTab data={data} />}
      {isReady && tab === "pages" && (
        <div className="space-y-6">
          <DataTable
            title="Pages"
            rows={data.pages || []}
            columns={[
              { key: "path", label: "Path", render: (r) => <span className="font-mono break-all">{r.path}</span> },
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DataTable
              title="Entry pages (bounce)"
              rows={data.entries || []}
              columns={[
                { key: "path", label: "Landing page", render: (r) => <span className="font-mono break-all">{r.path}</span> },
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
            { key: "path", label: "Page", render: (r) => <span className="font-mono break-all">{r.path}</span> },
            { key: "impressions", label: "Views" },
            { key: "uniqueSessions", label: "Unique sessions" },
            { key: "avgMs", label: "Avg time in view", render: (r) => fmtDuration(r.avgMs) },
            { key: "totalMs", label: "Total time in view", render: (r) => fmtDuration(r.totalMs) },
          ]}
        />
      )}
      {isReady && tab === "clicks" && (
        <div className="space-y-6">
          <DataTable
            title="Clicks"
            rows={data.labels || []}
            empty="No clicks recorded yet."
            columns={[
              { key: "label", label: "Clicked" },
              { key: "path", label: "On page", render: (r) => <span className="font-mono break-all">{r.path}</span> },
              { key: "clicks", label: "Clicks" },
              { key: "uniqueSessions", label: "Unique sessions" },
              { key: "sections", label: "Sections", render: (r) => (r.sections || []).filter(Boolean).join(", ") || "—", csv: (r) => (r.sections || []).filter(Boolean).join(" | ") },
            ]}
          />
          <DataTable
            title="Links followed"
            rows={data.links || []}
            columns={[
              { key: "href", label: "Destination", render: (r) => <span className="font-mono break-all">{r.href}</span> },
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
        <div className="space-y-6">
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
              { key: "categorySlug", label: "Category page", render: (r) => <span className="font-mono">/{r.categorySlug}</span> },
              { key: "views", label: "Views" },
              { key: "uniqueVisitors", label: "Unique visitors" },
            ]}
          />
        </div>
      )}
      {isReady && tab === "prices" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        <div className="space-y-6">
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
              { key: "path", label: "Page", render: (r) => <span className="font-mono break-all">{r.path}</span> },
              { key: "interactions", label: "Interactions" },
              { key: "filled", label: "Filled in" },
              { key: "fillRate", label: "Fill rate", render: (r) => pctText(r.fillRate) },
              { key: "uniqueSessions", label: "Unique sessions" },
            ]}
          />
        </div>
      )}
      {isReady && tab === "audience" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            ["segment", "Shopper type"], ["device", "Device"], ["browser", "Browser"], ["os", "Operating system"],
            ["source", "Traffic source"], ["medium", "UTM medium"], ["campaign", "Campaign"], ["country", "Country"],
          ].map(([key, title]) => (
            <DataTable
              key={key}
              title={title}
              rows={(data.breakdowns && data.breakdowns[key]) || []}
              columns={[
                { key: "value", label: title },
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
        <div className="space-y-6">
          <DataTable
            title="Logged-in customers"
            rows={data.customers || []}
            columns={[
              { key: "name", label: "Customer", render: (r) => <div><div className="font-bold text-[#1d2327]">{r.name || "—"}</div><div className="text-[11px] text-[#8c8f94]">{r.email}</div></div> },
              { key: "sessions", label: "Sessions" },
              { key: "pageViews", label: "Page views" },
              { key: "avgSessionMs", label: "Avg session", render: (r) => fmtDuration(r.avgSessionMs) },
              { key: "conversions", label: "Conversions" },
              { key: "orders", label: "Orders" },
              { key: "revenue", label: "Revenue", render: (r) => fmtMoney(r.revenue) },
              { key: "lastSeen", label: "Last seen", render: (r) => fmtWhen(r.lastSeen) },
              { key: "journey", label: "", csv: () => "", render: (r) => <button type="button" onClick={() => openJourney(r.visitorId)} className="text-[#2271b1] font-bold hover:underline">Journey</button> },
            ]}
          />
          <DataTable
            title="Recent visitors"
            rows={data.recent || []}
            columns={[
              { key: "visitorId", label: "Visitor", render: (r) => <span className="font-mono text-[11px]">{r.visitorId.slice(0, 8)}…</span> },
              { key: "who", label: "Who", render: (r) => r.userEmail || <span className="text-[#8c8f94]">Guest</span>, csv: (r) => r.userEmail || "Guest" },
              { key: "device", label: "Device", render: (r) => `${r.device}${r.browser ? ` · ${r.browser}` : ""}${r.os ? ` · ${r.os}` : ""}`, csv: (r) => `${r.device} ${r.browser} ${r.os}` },
              { key: "source", label: "Source", render: (r) => `${r.source}${r.medium ? ` / ${r.medium}` : ""}` },
              { key: "landed", label: "Landed → left", render: (r) => <span className="font-mono text-[11px] break-all">{r.entryPath} → {r.exitPath}</span>, csv: (r) => `${r.entryPath} -> ${r.exitPath}` },
              { key: "pageViews", label: "Pages", render: (r) => <span>{r.pageViews}{r.bounced && <span className="ml-1 text-[10px] font-bold text-orange-600">BOUNCE</span>}</span> },
              { key: "clickCount", label: "Clicks" },
              { key: "activeMs", label: "Time", render: (r) => fmtDuration(r.activeMs) },
              { key: "lastSeenAt", label: "Last seen", render: (r) => fmtWhen(r.lastSeenAt) },
              { key: "journey", label: "", csv: () => "", render: (r) => <button type="button" onClick={() => openJourney(r.visitorId)} className="text-[#2271b1] font-bold hover:underline">Journey</button> },
            ]}
          />
        </div>
      )}
      {isReady && tab === "variants" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Kpi label="Visitors who viewed a product" value={fmtNum(data.viewerSessions)} />
            <Kpi label="Visitors who chose a size or colour" value={fmtNum(data.pickerSessions)} />
            <Kpi label="Choice rate" value={pctText(data.pickRate)} hint="Of product viewers" />
          </div>
          <DataTable
            title="Size & colour choices"
            rows={data.options || []}
            empty="No choices yet. A choice is recorded when a shopper picks a size or colour on a product page."
            columns={[
              { key: "path", label: "Product page", render: (r) => <span className="font-mono break-all">{r.path}</span> },
              { key: "group", label: "Option" },
              { key: "value", label: "Choice" },
              { key: "selections", label: "Selections" },
              { key: "uniqueSessions", label: "Unique sessions" },
            ]}
          />
        </div>
      )}
      {isReady && tab === "errors" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Kpi label="Sessions that hit an error" value={fmtNum(data.errorSessions)} />
            <Kpi label="Conversion: sessions with an error" value={pctText(data.errorConversionRate)} />
            <Kpi label="Conversion: all sessions" value={pctText(data.overallConversionRate)} />
          </div>
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
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <Kpi label="Started checkout" value={fmtNum(data.kpis?.started)} />
            <Kpi label="Purchased" value={fmtNum(data.kpis?.purchased)} />
            <Kpi label="Checkout conversion" value={pctText(data.kpis?.conversionRate)} />
            <Kpi label="Abandoned" value={fmtNum(data.kpis?.abandoned)} hint={`${pctText(data.kpis?.abandonRate)} of checkouts`} />
            <Kpi label="Saw an error" value={fmtNum(data.kpis?.errorSessions)} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          <p className="text-[12px] text-[#646970]">Reasons are inferred from what a shopper did just before leaving, so they show likely causes, not confirmed ones.</p>
        </div>
      )}
      {isReady && tab === "retention" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Kpi label="Customers (first order in range)" value={fmtNum(data.kpis?.cohortCustomers)} />
            <Kpi label="Bought again" value={pctText(data.kpis?.repeatRate)} hint="Ever, to date" />
            <Kpi label="Bought again within 30 days" value={pctText(data.kpis?.repeat30Rate)} />
            <Kpi label="Bought again within 90 days" value={pctText(data.kpis?.repeat90Rate)} />
            <Kpi label="Median days to second order" value={data.kpis?.medianDaysToSecondOrder ?? "—"} />
            <Kpi label="Avg orders per customer" value={data.kpis?.avgOrders ?? "0"} />
            <Kpi label="Avg lifetime revenue" value={fmtMoney(data.kpis?.avgRevenue)} />
            <Kpi label="Accounts created → purchased" value={`${data.kpis?.accountsCreated || 0} → ${data.kpis?.accountsPurchased || 0}`} />
          </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          <p className="text-[12px] text-[#646970]">Only the date range applies on this tab. Customers count when their first order falls in the range. Guest orders aren't linked to an account, and visit sources only exist for visits made while logged in.</p>
        </div>
      )}
      {isReady && tab === "friction" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Kpi label="Dead clicks" value={fmtNum(data.kpis?.deadClicks)} hint="Clicks that got no response" />
            <Kpi label="Rage-click bursts" value={fmtNum(data.kpis?.rageBursts)} hint="Three or more rapid clicks on one element" />
            <Kpi label="Sessions with friction" value={pctText(data.kpis?.sessionsHitPct)} hint={(data.kpis?.sessionsHit || 0) + " sessions"} />
          </div>
          <DataTable
            title="Friction points"
            rows={data.rows || []}
            empty="No dead or rage clicks recorded for these filters."
            columns={[
              { key: "type", label: "Type", render: (r) => (r.type === "rage_click" ? "Rage click" : "Dead click") },
              { key: "label", label: "Element" },
              { key: "path", label: "Page", render: (r) => <span className="font-mono break-all">{r.path}</span> },
              { key: "count", label: "Count" },
              { key: "uniqueSessions", label: "Unique sessions" },
            ]}
          />
          <p className="text-[12px] text-[#646970]">A dead click is a click on a button or link that gave no visible response within 1.5 seconds. A rage click is three or more rapid clicks on the same element.</p>
        </div>
      )}
      {/* Page Speed tab — disabled for now, not removed. {isReady && tab === "speed" && <SpeedTab data={data} />} */}
      {isReady && tab === "live" && (
        <DataTable
          title={`Live now (${fmtNum(data.count)} active in the last 5 minutes)`}
          rows={data.sessions || []}
          empty="No visitors are active right now. This list refreshes every 15 seconds."
          columns={[
            { key: "visitorId", label: "Visitor", render: (r) => <span className="font-mono text-[11px]">{r.visitorId.slice(0, 8)}…</span> },
            { key: "who", label: "Who", render: (r) => r.userEmail || <span className="text-[#8c8f94]">Guest</span>, csv: (r) => r.userEmail || "Guest" },
            { key: "device", label: "Device", render: (r) => `${r.device}${r.browser ? ` · ${r.browser}` : ""}` },
            { key: "source", label: "Source" },
            { key: "exitPath", label: "Current page", render: (r) => <span className="font-mono break-all">{r.exitPath}</span> },
            { key: "pageViews", label: "Pages" },
            { key: "activeMs", label: "Time", render: (r) => fmtDuration(r.activeMs) },
            { key: "lastSeenAt", label: "Last activity", render: (r) => fmtWhen(r.lastSeenAt) },
            { key: "journey", label: "", csv: () => "", render: (r) => <button type="button" onClick={() => openJourney(r.visitorId)} className="text-[#2271b1] font-bold hover:underline">Journey</button> },
          ]}
        />
      )}

      {journeyId && <JourneyPanel visitorId={journeyId} onClose={() => setJourneyId(null)} />}
    </div>
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
    <div className="space-y-6">
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
          { key: "path", label: "Page", render: (r) => <span className="font-mono break-all">{r.path}</span> },
          { key: "device", label: "Device" },
          { key: "sessions", label: "Sessions" },
          { key: "samples", label: "Samples" },
          { key: "avgLcp", label: "LCP", render: (r) => <span className={r.avgLcp !== null ? VITALS_RATING_STYLE[vitalsRating("avgLcp", r.avgLcp)] : ""}>{r.avgLcp ?? "—"}ms</span> },
          { key: "avgCls", label: "CLS", render: (r) => <span className={r.avgCls !== null ? VITALS_RATING_STYLE[vitalsRating("avgCls", r.avgCls)] : ""}>{r.avgCls ?? "—"}</span> },
          { key: "avgFid", label: "FID", render: (r) => <span className={r.avgFid !== null ? VITALS_RATING_STYLE[vitalsRating("avgFid", r.avgFid)] : ""}>{r.avgFid ?? "—"}ms</span> },
          { key: "avgTtfb", label: "TTFB", render: (r) => <span className={r.avgTtfb !== null ? VITALS_RATING_STYLE[vitalsRating("avgTtfb", r.avgTtfb)] : ""}>{r.avgTtfb ?? "—"}ms</span> },
        ]}
      />
      <p className="text-[12px] text-[#646970]">Core Web Vitals are captured directly from real shoppers&apos; browsers. Green is good, amber needs improvement, red is poor, per Google&apos;s standard thresholds.</p>
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
    <div className="bg-white border border-[#c3c4c7] shadow-sm rounded-[3px] overflow-hidden">
      {/* WordPress-style Header with Filter controls */}
      <div className="px-4 py-3 bg-[#f6f7f7] border-b border-[#c3c4c7] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#2271b1]" />
          <h3 className="text-[13px] font-bold text-[#1d2327]">
            Active Tracking Capabilities & System Features
          </h3>
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {totalTrackedCount} Metrics Tracking Live
          </span>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8c8f94] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter features (e.g. friction, cart)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1 text-[11px] border border-[#8c8f94] rounded-[3px] bg-white text-[#2c3338] outline-none focus:border-[#2271b1] w-48 sm:w-60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="px-4 py-2 bg-white border-b border-[#f0f0f1] flex flex-wrap items-center gap-1.5 text-[11px]">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`px-2.5 py-1 rounded-[3px] font-medium transition-colors cursor-pointer ${
            activeCategory === "all"
              ? "bg-[#2271b1] text-white"
              : "text-[#50575e] bg-[#f0f0f1] hover:bg-[#e0e0e1]"
          }`}
        >
          All Capabilities ({totalTrackedCount})
        </button>
        {TRACKING_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 rounded-[3px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeCategory === cat.id
                  ? "bg-[#2271b1] text-white"
                  : "text-[#50575e] bg-[#f0f0f1] hover:bg-[#e0e0e1]"
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{cat.title.split(" ")[0]} ({cat.items.length})</span>
            </button>
          );
        })}
      </div>

      {/* Feature Cards Grid */}
      <div className="p-4 bg-[#fbfbfb]">
        {filteredCategories.length === 0 ? (
          <div className="p-8 text-center text-[#646970] text-[12px] bg-white border border-[#e5e5e5] rounded-[3px]">
            No tracking features match your search "{searchQuery}".
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.id}
                  className="bg-white border border-[#dcdcde] rounded-[3px] p-4 shadow-xs flex flex-col justify-between hover:border-[#2271b1] transition-colors"
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#f0f0f1]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-[#f0f6fb] text-[#2271b1] flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-[13px] font-bold text-[#1d2327]">
                            {cat.title}
                          </h4>
                          <p className="text-[11px] text-[#646970]">
                            {cat.description}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Active
                      </span>
                    </div>

                    {/* Features List */}
                    <div className="mt-3 space-y-2.5">
                      {cat.items.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-[12px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-[#1d2327] mr-1.5">
                              {item.name}:
                            </span>
                            <span className="text-[#50575e] leading-relaxed">
                              {item.desc}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-3.5 pt-2 border-t border-[#f0f0f1] flex items-center justify-between text-[11px] text-[#8c8f94]">
                    <span>Automated Real-Time Telemetry</span>
                    <span className="font-semibold text-[#2271b1]">{cat.items.length} monitored metrics</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ data }) {
  const k = data.kpis;
  const maxSessions = Math.max(1, ...data.daily.map((d) => d.sessions));
  const funnelBase = data.funnel[0]?.sessions || 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
      </div>

      <Panel
        title="Daily sessions and sales"
        action={
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-[#1d2327]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#2271b1]" /> Sessions
            </span>
            <span className="flex items-center gap-1.5 text-[#1d2327]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#10b981]" /> Converted
            </span>
          </div>
        }
      >
        <div className="p-4 sm:p-6">
          {data.daily.length === 0 ? (
            <p className="text-center italic text-[#8c8f94] text-[12px] py-8">No sessions for these filters.</p>
          ) : (
            <div>
              <div className="flex items-end gap-1.5 sm:gap-2 h-48 border-b border-[#e5e5e5] pb-1 px-1">
                {data.daily.map((d, idx) => {
                  const sessionHeight = maxSessions > 0 ? (d.sessions / maxSessions) * 100 : 0;
                  const convHeight = maxSessions > 0 ? (d.converted / maxSessions) * 100 : 0;
                  const showLabel = data.daily.length <= 14 || idx % Math.ceil(data.daily.length / 10) === 0 || idx === data.daily.length - 1;
                  const dateShort = d.day ? d.day.slice(5) : "";
                  return (
                    <div
                      key={d.day}
                      className="flex-1 min-w-[8px] max-w-[36px] h-full flex flex-col justify-end items-center group relative mx-auto"
                    >
                      {/* Hover Tooltip */}
                      <div className="absolute -top-12 z-30 hidden group-hover:flex flex-col items-center bg-[#1d2327] text-white text-[10px] px-2.5 py-1.5 rounded shadow-lg pointer-events-none whitespace-nowrap">
                        <span className="font-bold">{d.day}</span>
                        <span>{d.sessions} sessions · {d.converted} converted · {fmtMoney(d.revenue)}</span>
                      </div>

                      {/* Bar Container */}
                      <div className="w-full h-full flex items-end justify-center gap-0.5 bg-gray-50/80 rounded-t-[2px] p-[1px] hover:bg-gray-100 transition-colors">
                        {/* Sessions Bar */}
                        <div
                          className="w-full bg-[#2271b1] rounded-t-[2px] transition-all min-h-[2px]"
                          style={{ height: `${Math.max(sessionHeight, d.sessions > 0 ? 4 : 0)}%` }}
                        />
                        {/* Converted Bar */}
                        {d.converted > 0 && (
                          <div
                            className="w-1.5 bg-[#10b981] rounded-t-[2px] transition-all min-h-[4px]"
                            style={{ height: `${Math.max(convHeight, 4)}%` }}
                          />
                        )}
                      </div>

                      {/* X-axis Date label */}
                      <span className="absolute -bottom-5 text-[9px] text-[#8c8f94] truncate select-none">
                        {showLabel ? dateShort : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="h-5" />
            </div>
          )}
        </div>
      </Panel>

      {/* Conversion Funnel */}
      <Panel title="Conversion funnel">
        <table className="w-full text-[12px] text-left">
          <thead className="text-[11px] uppercase text-[#646970] bg-[#fbfbfb]">
            <tr>
              <th className="px-3 py-2">Step</th>
              <th className="px-3 py-2">Sessions</th>
              <th className="px-3 py-2">Events</th>
              <th className="px-3 py-2">Of product viewers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f1]">
            {data.funnel.map((f) => (
              <tr key={f.name}>
                <td className="px-3 py-2 font-bold text-[#1d2327]">{FUNNEL_LABELS[f.name]}</td>
                <td className="px-3 py-2">{f.sessions}</td>
                <td className="px-3 py-2">{f.events}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 bg-[#2271b1] rounded"
                      style={{ width: `${funnelBase ? (f.sessions / funnelBase) * 120 : 0}px`, minWidth: 2 }}
                    />
                    <span className="text-[#646970]">
                      {funnelBase ? Math.round((f.sessions / funnelBase) * 100) : 0}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Tracking Engine & Feature Matrix */}
      <TrackingFeaturesMatrix />
    </div>
  );
}

export default function SiteAnalyticsPage() {
  return (
    <RequirePermission permission="analytics.view">
      <AdminPageLayout
        title="Visitor Analytics"
        breadcrumbs={[{ label: "Analytics", href: "/admin/analytics" }, { label: "Visitors" }]}
      >
        <Suspense fallback={<div className="p-16 text-center text-[13px] text-gray-500 italic bg-white border border-[#ccd0d4]">Loading…</div>}>
          <SiteAnalyticsView />
        </Suspense>
      </AdminPageLayout>
    </RequirePermission>
  );
}
