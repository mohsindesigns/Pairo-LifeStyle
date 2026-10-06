"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import AdminPageLayout from "@/components/admin/AdminPageLayout";
import RequirePermission from "@/components/admin/RequirePermission";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "pages", label: "Pages" },
  { key: "sections", label: "Sections" },
  { key: "clicks", label: "Clicks" },
  { key: "products", label: "Products" },
  { key: "categories", label: "Categories" },
  { key: "prices", label: "Price ranges" },
  { key: "search", label: "Search & forms" },
  { key: "audience", label: "Audience" },
  { key: "users", label: "Users & visitors" },
  { key: "live", label: "Live" },
  { key: "variants", label: "Size & colour" },
  { key: "errors", label: "Errors" },
  { key: "checkout", label: "Checkout" },
  { key: "retention", label: "Repeat buyers" },
  { key: "friction", label: "Friction" },
  { key: "heatmap", label: "Heatmap" },
];

const FUNNEL_LABELS = {
  view_item: "Viewed product",
  add_to_cart: "Added to cart",
  begin_checkout: "Started checkout",
  add_payment_info: "Entered payment",
  purchase: "Purchased",
};

const FEATURES = [
  ["Traffic", "Sessions, unique and returning visitors, bounce rate, pages per session, session time, live visitors."],
  ["Pages", "Every page view with its type (home, shop, category, product, cart, checkout, blog, account), time on page, scroll depth, entry and exit pages."],
  ["Sections", "Every section on every page (auto-detected, or marked with data-track-section): how many visitors saw it and how long it was on screen."],
  ["Clicks", "Every button, link and call-to-action click, with its label, destination and the section it was in."],
  ["Products", "Views, product-list impressions, add-to-cart, units sold, revenue and cart rate per product."],
  ["Categories", "Product performance rolled up by category, plus category page views."],
  ["Price ranges", "Views, cart adds, sales and revenue by price band."],
  ["Cart & checkout", "Funnel from product view to purchase, with the drop-off at each step."],
  ["Forms", "Which form fields visitors fill in or leave empty. Only field names and fill state are stored, never typed values."],
  ["Search", "What visitors search for, how often, and which searches return zero results."],
  ["Size & colour", "Which sizes and colours shoppers pick on each product, and what share of product viewers make a choice."],
  ["Errors", "Script errors, failed API requests and form validation messages, and how they relate to conversion."],
  ["Checkout", "Checkout funnel with the drop-off at each step, the likely reason shoppers left, and the last field they touched."],
  ["Repeat buyers", "How many customers buy again and how soon, plus where they first came from and what brought them back."],
  ["Friction", "Dead clicks (buttons or links that did nothing) and rage clicks (rapid repeated clicks on one element)."],
  ["Heatmap", "Where shoppers click on each page, shown as a grid of page width by page height."],
  ["Audience", "Device, browser, OS, country, traffic source, UTM medium and campaign, guest vs logged-in."],
  ["Users & journeys", "Logged-in customers with their revenue, and a step-by-step journey for every visitor."],
  ["Filters & export", "Date range (presets or custom), and every dimension above can be combined. Filters stay in the URL, and every table exports to CSV."],
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
  if (e.name === "click") return `Clicked "${e.label}"${e.href ? ` → ${e.href}` : ""}${e.section ? ` in "${e.section}"` : ""}`;
  if (e.name === "section_view") return `Saw section "${e.label}" for ${fmtDuration(e.durationMs)}`;
  if (e.name === "field_interaction") return `Form field "${e.fieldName}" — ${e.filled ? "filled in" : "left empty"}`;
  if (e.name === "search") return `Searched for "${e.search_term}"`;
  const names = (e.items || []).map((i) => i.item_name).filter(Boolean).join(", ");
  const value = e.value ? ` · ${e.currency || "USD"} ${Number(e.value).toFixed(2)}` : "";
  return `${e.name.replace(/_/g, " ")}${names ? `: ${names}` : ""}${value}`;
}

function JourneyPanel({ visitorId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/site-analytics/visitor?visitorId=${encodeURIComponent(visitorId)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d.success ? d : null); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visitorId]);

  return (
    <Panel
      title="Visitor journey"
      action={<button type="button" onClick={onClose} className="text-[11px] font-bold uppercase text-[#2271b1] hover:underline">Close</button>}
    >
      <div className="p-4 space-y-4">
        <div className="text-[12px] text-[#646970]">
          Visitor <span className="font-mono text-[#1d2327]">{visitorId}</span>
          {data?.user && <> · <span className="font-bold text-[#1d2327]">{data.user.name}</span> ({data.user.email})</>}
        </div>
        {loading && <p className="text-[12px] italic text-[#8c8f94]">Loading journey…</p>}
        {!loading && !data && <p className="text-[12px] text-red-600">Could not load this visitor's journey.</p>}

        {data?.sessions.map(({ session, pageViews, unassigned }) => (
          <div key={session.sessionId} className="border border-[#e5e5e5] rounded-[2px]">
            <div className="px-3 py-2 bg-[#fbfbfb] text-[12px] text-[#646970] flex flex-wrap gap-x-4 gap-y-1">
              <b className="text-[#1d2327]">{fmtWhen(session.startedAt)}</b>
              <span>{session.device}{session.browser ? ` · ${session.browser}` : ""}{session.os ? ` · ${session.os}` : ""}</span>
              <span>from {session.source}{session.medium ? ` / ${session.medium}` : ""}{session.campaign ? ` / ${session.campaign}` : ""}</span>
              {session.country && <span>{session.country}</span>}
              <span>{session.pageViews} page views</span>
              <span>{fmtDuration(session.activeMs)} active</span>
              <span>{session.clickCount || 0} clicks</span>
              {session.conversionCount > 0 && <span className="text-emerald-700 font-bold">Converted</span>}
              {session.bounced && <span className="text-orange-600 font-bold">Bounced</span>}
            </div>
            <ol className="divide-y divide-[#f0f0f1]">
              {pageViews.map((pv) => (
                <li key={pv._id} className="px-3 py-2 text-[12px]">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
                    <span className="text-[#8c8f94] w-28 shrink-0">{fmtWhen(pv.enteredAt)}</span>
                    <span className="font-bold text-[#1d2327] bg-[#f0f6fb] px-1.5 py-0.5 rounded-[2px]">{pv.pageType || "page"}</span>
                    <span className="font-mono text-[#1d2327] break-all">{pv.path}</span>
                    <span className="text-[#646970]">{fmtDuration(pv.engagedMs)} on page · {Math.round(pv.maxScrollPct || 0)}% scrolled</span>
                  </div>
                  {pv.activity?.length > 0 && (
                    <ul className="mt-2 ml-28 space-y-1 border-l-2 border-[#e5e5e5] pl-3">
                      {pv.activity.map((e, i) => (
                        <li key={i} className="text-[#1d2327]">
                          <span className="text-[#8c8f94] mr-2">{fmtWhen(e.createdAt)}</span>{describeEvent(e)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
              {unassigned?.length > 0 && (
                <li className="px-3 py-2 text-[12px]">
                  <div className="font-bold text-[#646970] mb-1">Other activity</div>
                  {unassigned.map((e, i) => (
                    <div key={i} className="text-[#1d2327]"><span className="text-[#8c8f94] mr-2">{fmtWhen(e.createdAt)}</span>{describeEvent(e)}</div>
                  ))}
                </li>
              )}
              {pageViews.length === 0 && !unassigned?.length && (
                <li className="px-3 py-2 text-[12px] italic text-[#8c8f94]">No activity recorded.</li>
              )}
            </ol>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function FilterSelect({ label, paramKey, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1 min-w-[140px]">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#646970]">{label}</span>
      <select
        value={value || "all"}
        onChange={(e) => onChange(paramKey, e.target.value)}
        className="border border-[#8c8f94] rounded-[3px] px-2 py-1.5 text-[12px] bg-white"
      >
        <option value="all">All</option>
        {options.map((o) => (
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

  const rawTab = params?.tab || searchParams.get("tab") || "overview";
  const tab = typeof rawTab === "string" ? rawTab : "overview";
  const hasCustom = Boolean(searchParams.get("from") && searchParams.get("to"));
  const query = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (!p.get("range") && !hasCustom) p.set("range", "30");
    p.set("tab", tab);
    return p.toString();
  }, [searchParams, tab, hasCustom]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [options, setOptions] = useState(null);
  const [journeyId, setJourneyId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/admin/site-analytics?tab=options")
      .then((r) => r.json())
      .then((j) => { if (j.success) setOptions(j.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/admin/site-analytics?${query}`)
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        if (j.success) setData({ ...j.data, _tab: j.tab });
        else setError(true);
      })
      .catch((err) => {
        console.error("Site analytics fetch error:", err);
        if (!cancelled) setError(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, refreshKey]);

  const isReady = Boolean(data && data._tab === tab);

  useEffect(() => {
    if (tab !== "live") return undefined;
    const timer = setInterval(() => setRefreshKey((k) => k + 1), 15000);
    return () => clearInterval(timer);
  }, [tab]);

  const setParams = useCallback((updates) => {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === undefined || v === "" || v === "all") p.delete(k);
      else p.set(k, v);
    }
    router.replace(`/admin/site-analytics?${p.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const onFilter = (key, value) => setParams({ [key]: value });
  const rangeValue = hasCustom ? "custom" : (searchParams.get("range") || "30");

  const onRangeChange = (value) => {
    if (value === "custom") {
      setParams({
        range: null,
        from: searchParams.get("from") || daysAgoIso(30),
        to: searchParams.get("to") || todayIso(),
      });
    } else {
      setParams({ range: value, from: null, to: null });
    }
  };

  const activeFilters = ["device", "segment", "browser", "os", "source", "medium", "campaign", "country", "pageType", "category", "priceBand", "productId"]
    .filter((k) => searchParams.get(k));

  const openJourney = (visitorId) => setJourneyId(visitorId);
  const pinProduct = (row) => setParams({ productId: row.productId });
  const pinCategory = (row) => setParams({ category: row.category });
  const pinPriceBand = (row) => setParams({ priceBand: row.key });

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#ccd0d4] shadow-sm rounded-[2px] p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 min-w-[160px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#646970]">Date range</span>
            <select
              value={rangeValue}
              onChange={(e) => onRangeChange(e.target.value)}
              className="border border-[#8c8f94] rounded-[3px] px-2 py-1.5 text-[12px] bg-white"
            >
              {DATE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          {hasCustom && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#646970]">From</span>
                <input type="date" value={searchParams.get("from") || ""} onChange={(e) => setParams({ from: e.target.value })} className="border border-[#8c8f94] rounded-[3px] px-2 py-1.5 text-[12px]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#646970]">To</span>
                <input type="date" value={searchParams.get("to") || ""} onChange={(e) => setParams({ to: e.target.value })} className="border border-[#8c8f94] rounded-[3px] px-2 py-1.5 text-[12px]" />
              </label>
            </>
          )}
          <FilterSelect label="Device" paramKey="device" value={searchParams.get("device")} onChange={onFilter} options={DEVICES.map((d) => ({ value: d, label: d }))} />
          <FilterSelect label="Shopper" paramKey="segment" value={searchParams.get("segment")} onChange={onFilter} options={[{ value: "customer", label: "Logged-in customers" }, { value: "guest", label: "Guests" }]} />
          <FilterSelect label="Source" paramKey="source" value={searchParams.get("source")} onChange={onFilter} options={(options?.sources || []).map((v) => ({ value: v, label: v }))} />
          <FilterSelect label="Medium" paramKey="medium" value={searchParams.get("medium")} onChange={onFilter} options={(options?.mediums || []).map((v) => ({ value: v, label: v }))} />
          <FilterSelect label="Campaign" paramKey="campaign" value={searchParams.get("campaign")} onChange={onFilter} options={(options?.campaigns || []).map((v) => ({ value: v, label: v }))} />
          <FilterSelect label="Country" paramKey="country" value={searchParams.get("country")} onChange={onFilter} options={(options?.countries || []).map((v) => ({ value: v, label: v }))} />
          <FilterSelect label="Browser" paramKey="browser" value={searchParams.get("browser")} onChange={onFilter} options={(options?.browsers || []).map((v) => ({ value: v, label: v }))} />
          <FilterSelect label="OS" paramKey="os" value={searchParams.get("os")} onChange={onFilter} options={(options?.oses || []).map((v) => ({ value: v, label: v }))} />
          <FilterSelect label="Page type" paramKey="pageType" value={searchParams.get("pageType")} onChange={onFilter} options={(options?.pageTypes || []).map((v) => ({ value: v, label: v }))} />
          <FilterSelect label="Category" paramKey="category" value={searchParams.get("category")} onChange={onFilter} options={(options?.categories || []).map((v) => ({ value: v, label: v }))} />
          <FilterSelect label="Price range" paramKey="priceBand" value={searchParams.get("priceBand")} onChange={onFilter} options={(options?.priceBands || []).map((b) => ({ value: b.key, label: b.label }))} />
          <FilterSelect label="Product" paramKey="productId" value={searchParams.get("productId")} onChange={onFilter} options={(options?.products || []).map((p) => ({ value: p.id, label: p.name }))} />
          <button
            type="button"
            onClick={() => router.replace(`${pathname}?tab=${tab}`, { scroll: false })}
            disabled={!activeFilters.length && !hasCustom && !searchParams.get("range")}
            className="px-3 py-1.5 text-[12px] font-bold border border-[#8c8f94] rounded-[3px] bg-white hover:bg-[#f6f7f7] disabled:text-gray-300 disabled:border-gray-200"
          >
            Reset filters
          </button>
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            {activeFilters.map((k) => (
              <button key={k} type="button" onClick={() => setParams({ [k]: null })} className="px-2 py-1 rounded-[2px] bg-[#f0f6fb] text-[#135e96] font-bold">
                {k}: {searchParams.get(k)} ×
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-[#ccd0d4]">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          const p = new URLSearchParams(searchParams.toString());
          p.set("tab", t.key);
          const href = `/admin/site-analytics?${p.toString()}`;
          return (
            <Link
              key={t.key}
              href={href}
              onClick={(e) => {
                e.preventDefault();
                setParams({ tab: t.key });
              }}
              className={`px-3 py-2 text-[12px] font-bold border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-[#2271b1] text-[#2271b1]"
                  : "border-transparent text-[#646970] hover:text-[#1d2327]"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {(!isReady || loading) && !error && <div className="p-16 text-center text-[13px] text-gray-500 italic bg-white border border-[#ccd0d4]">Crunching visitor data…</div>}
      {error && <div className="p-16 text-center text-[13px] text-red-500 font-bold bg-white border border-[#ccd0d4]">Failed to load this view.</div>}

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
      {isReady && tab === "heatmap" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 min-w-[260px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#646970]">Page</span>
              <select
                value={data.path || ""}
                onChange={(e) => setParams({ heatPath: e.target.value })}
                className="border border-[#8c8f94] rounded-[3px] px-2 py-1.5 text-[12px] bg-white"
              >
                {(data.pages || []).length === 0 && <option value="">No clicks yet</option>}
                {(data.pages || []).map((p) => (
                  <option key={p.path} value={p.path}>{p.path} ({p.clicks} clicks)</option>
                ))}
              </select>
            </label>
            <p className="text-[12px] text-[#646970]">{fmtNum(data.total)} clicks on this page</p>
          </div>
          <Panel title="Click heatmap">
            <div className="p-4">
              {!data.rows ? (
                <p className="text-center italic text-[#8c8f94] text-[12px] py-10">No clicks recorded for this page yet.</p>
              ) : (
                <HeatGrid data={data} />
              )}
              <p className="mt-3 text-[11px] text-[#8c8f94]">Each column is 5% of the page width and each row is 200px of page height. Darker cells had more clicks.</p>
            </div>
          </Panel>
        </div>
      )}
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

function HeatGrid({ data }) {
  const cellMap = new Map(data.cells.map((c) => [c.col + ":" + c.row, c]));
  const cells = [];
  for (let row = 0; row < data.rows; row++) {
    for (let col = 0; col < data.cols; col++) {
      const cell = cellMap.get(col + ":" + row);
      const alpha = cell ? 0.15 + 0.85 * (cell.count / data.max) : 0;
      cells.push(
        <div
          key={col + ":" + row}
          title={cell ? cell.count + " clicks" : ""}
          style={{ height: 14, background: cell ? "rgba(34,113,177," + alpha + ")" : "#f6f7f7" }}
        />
      );
    }
  }
  return (
    <div className="grid gap-px bg-[#e5e5e5]" style={{ gridTemplateColumns: "repeat(" + data.cols + ", minmax(0, 1fr))" }}>
      {cells}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Conversion funnel">
          <table className="w-full text-[12px] text-left">
            <thead className="text-[11px] uppercase text-[#646970] bg-[#fbfbfb]">
              <tr><th className="px-3 py-2">Step</th><th className="px-3 py-2">Sessions</th><th className="px-3 py-2">Events</th><th className="px-3 py-2">Of product viewers</th></tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f1]">
              {data.funnel.map((f) => (
                <tr key={f.name}>
                  <td className="px-3 py-2 font-bold text-[#1d2327]">{FUNNEL_LABELS[f.name]}</td>
                  <td className="px-3 py-2">{f.sessions}</td>
                  <td className="px-3 py-2">{f.events}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 bg-[#2271b1] rounded" style={{ width: `${funnelBase ? (f.sessions / funnelBase) * 120 : 0}px`, minWidth: 2 }} />
                      <span className="text-[#646970]">{funnelBase ? Math.round((f.sessions / funnelBase) * 100) : 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="What is tracked">
          <ul className="divide-y divide-[#f0f0f1]">
            {FEATURES.map(([title, text]) => (
              <li key={title} className="px-4 py-2.5 text-[12px]">
                <span className="font-bold text-[#1d2327]">{title}.</span> <span className="text-[#646970]">{text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
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
