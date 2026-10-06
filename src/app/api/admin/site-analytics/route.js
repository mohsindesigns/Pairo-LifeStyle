import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import { can } from "@/lib/rbac";
import {
  BOUNCE_EXPR, FUNNEL_EVENTS, PAGE_TYPES, PRICE_BANDS, isBounced,
} from "@/lib/analyticsDimensions";
import AnalyticsSession from "@/models/AnalyticsSession";
import AnalyticsPageView from "@/models/AnalyticsPageView";
import AnalyticsEvent from "@/models/AnalyticsEvent";
import Order from "@/models/Order";
import Customer from "@/models/Customer";

const DEVICES = ["desktop", "mobile", "tablet"];
const SEGMENTS = ["customer", "guest"];
const SESSION_DIMS = ["device", "browser", "os", "source", "medium", "campaign", "country"];
const EVENT_DIMS = [...SESSION_DIMS, "pageType"];
const PRODUCT_EVENTS = ["view_item", "view_item_list", "add_to_cart", "purchase"];
const LIVE_WINDOW_MS = 5 * 60 * 1000;

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
const round = (v) => Math.round(v || 0);
const money = (v) => Math.round((v || 0) * 100) / 100;

function parseFilters(sp) {
  const now = new Date();
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  let since;
  let until;
  if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    since = new Date(`${from}T00:00:00.000Z`);
    until = new Date(`${to}T23:59:59.999Z`);
  } else {
    const days = Math.min(365, Math.max(1, parseInt(sp.get("range") || "30", 10) || 30));
    until = now;
    since = new Date(now.getTime() - days * 86400000);
  }
  const pick = (key, allowed) => {
    const v = sp.get(key);
    if (!v || v === "all") return null;
    if (allowed && !allowed.includes(v)) return null;
    return v.slice(0, 120);
  };
  return {
    since,
    until,
    device: pick("device", DEVICES),
    segment: pick("segment", SEGMENTS),
    browser: pick("browser"),
    os: pick("os"),
    source: pick("source"),
    medium: pick("medium"),
    campaign: pick("campaign"),
    country: pick("country"),
    pageType: pick("pageType", PAGE_TYPES),
    category: pick("category"),
    priceBand: pick("priceBand", PRICE_BANDS.map((b) => b.key)),
    productId: pick("productId"),
    heatPath: sp.get("heatPath") ? sp.get("heatPath").slice(0, 300) : null,
  };
}

const dimMatch = (f, keys) => Object.fromEntries(keys.filter((k) => f[k]).map((k) => [k, f[k]]));
const hasItemFilter = (f) => Boolean(f.category || f.priceBand || f.productId);
const itemMatch = (f) => Object.fromEntries(
  Object.entries({ item_category: f.category, priceBand: f.priceBand, item_id: f.productId }).filter(([, v]) => v)
);
const itemStage = (f) => Object.fromEntries(
  Object.entries({ "items.item_category": f.category, "items.priceBand": f.priceBand, "items.item_id": f.productId }).filter(([, v]) => v)
);
const eventSegmentMatch = (f) => (f.segment ? { segment: f.segment } : {});
const sessionSegmentMatch = (f) => {
  if (f.segment === "customer") return { userId: { $ne: null } };
  if (f.segment === "guest") return { userId: null };
  return {};
};

function eventMatch(f, extra = {}) {
  const m = { createdAt: { $gte: f.since, $lte: f.until }, ...dimMatch(f, EVENT_DIMS), ...eventSegmentMatch(f), ...extra };
  if (hasItemFilter(f)) m.items = { $elemMatch: itemMatch(f) };
  return m;
}

function pageviewMatch(f, sessionIds) {
  const m = { enteredAt: { $gte: f.since, $lte: f.until }, ...dimMatch(f, EVENT_DIMS), ...eventSegmentMatch(f) };
  if (sessionIds) m.sessionId = { $in: sessionIds };
  return m;
}

function sessionMatch(f, sessionIds) {
  const m = { startedAt: { $gte: f.since, $lte: f.until }, ...dimMatch(f, SESSION_DIMS), ...sessionSegmentMatch(f) };
  if (sessionIds) m.sessionId = { $in: sessionIds };
  return m;
}

async function productSessionIds(f) {
  if (!hasItemFilter(f)) return null;
  return AnalyticsEvent.distinct("sessionId", eventMatch(f, { name: { $in: PRODUCT_EVENTS } }));
}

async function revenue(f, byDay = false) {
  return AnalyticsEvent.aggregate([
    { $match: eventMatch(f, { name: "purchase" }) },
    { $unwind: "$items" },
    ...(hasItemFilter(f) ? [{ $match: itemStage(f) }] : []),
    {
      $group: {
        _id: "$_id",
        day: { $first: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } },
        revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        units: { $sum: "$items.quantity" },
      },
    },
    {
      $group: {
        _id: byDay ? "$day" : null,
        revenue: { $sum: "$revenue" },
        units: { $sum: "$units" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

async function overview(f) {
  const ids = await productSessionIds(f);
  const sMatch = sessionMatch(f, ids);
  const pvMatch = pageviewMatch(f, ids);
  const liveMatch = { lastSeenAt: { $gte: new Date(Date.now() - LIVE_WINDOW_MS) }, ...dimMatch(f, SESSION_DIMS), ...sessionSegmentMatch(f) };

  const [sessionAgg, pageAgg, revTotal, revDaily, funnelAgg, liveCount] = await Promise.all([
    AnalyticsSession.aggregate([
      { $match: sMatch },
      {
        $facet: {
          summary: [{
            $group: {
              _id: null,
              sessions: { $sum: 1 },
              pageViews: { $sum: "$pageViews" },
              activeMs: { $sum: "$activeMs" },
              bounces: { $sum: BOUNCE_EXPR },
              converted: { $sum: { $cond: [{ $gt: ["$conversionCount", 0] }, 1, 0] } },
              identified: { $sum: { $cond: [{ $ne: ["$userId", null] }, 1, 0] } },
              clicks: { $sum: "$clickCount" },
            },
          }],
          visitors: [
            { $group: { _id: "$visitorId", sessions: { $sum: 1 } } },
            {
              $group: {
                _id: null,
                unique: { $sum: 1 },
                returning: { $sum: { $cond: [{ $gt: ["$sessions", 1] }, 1, 0] } },
              },
            },
          ],
          daily: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$startedAt" } },
                sessions: { $sum: 1 },
                converted: { $sum: { $cond: [{ $gt: ["$conversionCount", 0] }, 1, 0] } },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]),
    AnalyticsPageView.aggregate([
      { $match: pvMatch },
      { $group: { _id: null, views: { $sum: 1 }, engagedMs: { $sum: "$engagedMs" } } },
    ]),
    revenue(f, false),
    revenue(f, true),
    AnalyticsEvent.aggregate([
      { $match: eventMatch(f, { name: { $in: FUNNEL_EVENTS } }) },
      { $group: { _id: "$name", sessions: { $addToSet: "$sessionId" }, events: { $sum: 1 } } },
      { $project: { sessions: { $size: "$sessions" }, events: 1 } },
    ]),
    AnalyticsSession.countDocuments(liveMatch),
  ]);

  const facet = sessionAgg[0] || {};
  const s = facet.summary?.[0] || { sessions: 0, pageViews: 0, activeMs: 0, bounces: 0, converted: 0, identified: 0, clicks: 0 };
  const v = facet.visitors?.[0] || { unique: 0, returning: 0 };
  const pg = pageAgg[0] || { views: 0, engagedMs: 0 };
  const rev = revTotal[0] || { revenue: 0, units: 0, orders: 0 };
  const revByDay = new Map(revDaily.map((r) => [r._id, r]));
  const funnelMap = Object.fromEntries(funnelAgg.map((x) => [x._id, x]));

  const addToCartSessions = funnelMap.add_to_cart?.sessions || 0;
  const viewerSessions = funnelMap.view_item?.sessions || 0;

  return {
    kpis: {
      sessions: s.sessions,
      visitors: v.unique,
      returningPct: pct(v.returning, v.unique),
      pageViews: s.pageViews,
      pagesPerSession: s.sessions ? Math.round((s.pageViews / s.sessions) * 10) / 10 : 0,
      bounceRate: pct(s.bounces, s.sessions),
      avgSessionMs: s.sessions ? round(s.activeMs / s.sessions) : 0,
      avgTimeOnPageMs: pg.views ? round(pg.engagedMs / pg.views) : 0,
      conversionRate: pct(s.converted, s.sessions),
      addToCartRate: pct(addToCartSessions, viewerSessions),
      clicks: s.clicks,
      revenue: money(rev.revenue),
      orders: rev.orders,
      units: rev.units,
      aov: rev.orders ? money(rev.revenue / rev.orders) : 0,
      identifiedPct: pct(s.identified, s.sessions),
      liveNow: liveCount,
    },
    daily: (facet.daily || []).map((d) => ({
      day: d._id,
      sessions: d.sessions,
      converted: d.converted,
      revenue: money(revByDay.get(d._id)?.revenue),
    })),
    funnel: FUNNEL_EVENTS.map((name) => ({
      name,
      sessions: funnelMap[name]?.sessions || 0,
      events: funnelMap[name]?.events || 0,
    })),
  };
}

async function pages(f) {
  const ids = await productSessionIds(f);
  const [pv, exits, entries, types] = await Promise.all([
    AnalyticsPageView.aggregate([
      { $match: pageviewMatch(f, ids) },
      {
        $group: {
          _id: "$path",
          pageType: { $first: "$pageType" },
          categorySlug: { $first: "$categorySlug" },
          title: { $first: "$title" },
          views: { $sum: 1 },
          visitors: { $addToSet: "$visitorId" },
          engagedMs: { $sum: "$engagedMs" },
          avgScroll: { $avg: "$maxScrollPct" },
        },
      },
      {
        $project: {
          pageType: 1, categorySlug: 1, title: 1, views: 1,
          uniqueVisitors: { $size: "$visitors" }, engagedMs: 1,
          avgScroll: { $round: ["$avgScroll", 0] },
        },
      },
      { $sort: { views: -1 } },
      { $limit: 200 },
    ]),
    AnalyticsSession.aggregate([
      { $match: sessionMatch(f, ids) },
      { $group: { _id: "$exitPath", exits: { $sum: 1 } } },
    ]),
    AnalyticsSession.aggregate([
      { $match: sessionMatch(f, ids) },
      {
        $group: {
          _id: "$entryPath",
          sessions: { $sum: 1 },
          bounces: { $sum: BOUNCE_EXPR },
          converted: { $sum: { $cond: [{ $gt: ["$conversionCount", 0] }, 1, 0] } },
          activeMs: { $sum: "$activeMs" },
        },
      },
      { $sort: { sessions: -1 } },
      { $limit: 100 },
    ]),
    AnalyticsPageView.aggregate([
      { $match: pageviewMatch(f, ids) },
      { $group: { _id: "$pageType", views: { $sum: 1 }, visitors: { $addToSet: "$visitorId" }, engagedMs: { $sum: "$engagedMs" } } },
      { $project: { views: 1, uniqueVisitors: { $size: "$visitors" }, engagedMs: 1 } },
      { $sort: { views: -1 } },
    ]),
  ]);

  const exitMap = new Map(exits.map((e) => [e._id, e.exits]));
  return {
    pages: pv.map((p) => {
      const exited = exitMap.get(p._id) || 0;
      return {
        path: p._id,
        pageType: p.pageType,
        categorySlug: p.categorySlug,
        title: p.title,
        views: p.views,
        uniqueVisitors: p.uniqueVisitors,
        avgTimeMs: p.views ? round(p.engagedMs / p.views) : 0,
        avgScroll: p.avgScroll || 0,
        exits: exited,
        exitRate: pct(exited, p.views),
      };
    }),
    entries: entries.map((e) => ({
      path: e._id || "/",
      sessions: e.sessions,
      bounceRate: pct(e.bounces, e.sessions),
      conversionRate: pct(e.converted, e.sessions),
      avgSessionMs: e.sessions ? round(e.activeMs / e.sessions) : 0,
    })),
    pageTypes: types.map((t) => ({
      pageType: t._id || "page",
      views: t.views,
      uniqueVisitors: t.uniqueVisitors,
      avgTimeMs: t.views ? round(t.engagedMs / t.views) : 0,
    })),
  };
}

async function sections(f) {
  const rows = await AnalyticsEvent.aggregate([
    { $match: eventMatch(f, { name: "section_view" }) },
    {
      $group: {
        _id: { section: "$label", path: "$path" },
        impressions: { $sum: 1 },
        sessions: { $addToSet: "$sessionId" },
        avgMs: { $avg: "$durationMs" },
        totalMs: { $sum: "$durationMs" },
      },
    },
    {
      $project: {
        section: "$_id.section", path: "$_id.path", impressions: 1,
        uniqueSessions: { $size: "$sessions" }, avgMs: { $round: ["$avgMs", 0] }, totalMs: 1,
      },
    },
    { $sort: { impressions: -1 } },
    { $limit: 300 },
  ]);
  return { sections: rows.map((r) => ({ ...r, section: r.section || "(unnamed)" })) };
}

async function clicks(f) {
  const [labels, links] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: eventMatch(f, { name: "click" }) },
      {
        $group: {
          _id: { label: "$label", path: "$path" },
          clicks: { $sum: 1 },
          sessions: { $addToSet: "$sessionId" },
          sections: { $addToSet: "$section" },
        },
      },
      {
        $project: {
          label: "$_id.label", path: "$_id.path", clicks: 1,
          uniqueSessions: { $size: "$sessions" }, sections: { $slice: ["$sections", 3] },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 200 },
    ]),
    AnalyticsEvent.aggregate([
      { $match: eventMatch(f, { name: "click", href: { $ne: "" } }) },
      { $group: { _id: "$href", clicks: { $sum: 1 }, sessions: { $addToSet: "$sessionId" } } },
      { $project: { href: "$_id", clicks: 1, uniqueSessions: { $size: "$sessions" } } },
      { $sort: { clicks: -1 } },
      { $limit: 100 },
    ]),
  ]);
  return { labels, links };
}

async function itemRollup(f, field) {
  return AnalyticsEvent.aggregate([
    { $match: eventMatch(f, { name: { $in: PRODUCT_EVENTS } }) },
    { $unwind: "$items" },
    ...(hasItemFilter(f) ? [{ $match: itemStage(f) }] : []),
    { $match: { [`items.${field}`]: { $nin: [null, ""] } } },
    {
      $group: {
        _id: `$items.${field}`,
        name: { $first: "$items.item_name" },
        category: { $first: "$items.item_category" },
        productIds: { $addToSet: "$items.item_id" },
        views: { $sum: { $cond: [{ $eq: ["$name", "view_item"] }, 1, 0] } },
        listImpressions: { $sum: { $cond: [{ $eq: ["$name", "view_item_list"] }, 1, 0] } },
        addToCart: { $sum: { $cond: [{ $eq: ["$name", "add_to_cart"] }, 1, 0] } },
        unitsSold: { $sum: { $cond: [{ $eq: ["$name", "purchase"] }, "$items.quantity", 0] } },
        revenue: { $sum: { $cond: [{ $eq: ["$name", "purchase"] }, { $multiply: ["$items.price", "$items.quantity"] }, 0] } },
        visitors: { $addToSet: "$visitorId" },
        avgPrice: { $avg: "$items.price" },
      },
    },
    {
      $project: {
        name: 1, category: 1,
        productCount: { $size: "$productIds" },
        views: 1, listImpressions: 1, addToCart: 1, unitsSold: 1,
        revenue: { $round: ["$revenue", 2] },
        uniqueVisitors: { $size: "$visitors" },
        avgPrice: { $round: ["$avgPrice", 2] },
      },
    },
    { $sort: { views: -1, listImpressions: -1 } },
    { $limit: 200 },
  ]);
}

async function products(f) {
  const rows = await itemRollup(f, "item_id");
  return {
    products: rows.map((r) => ({
      productId: r._id,
      name: r.name || r._id,
      category: r.category || "",
      views: r.views,
      listImpressions: r.listImpressions,
      addToCart: r.addToCart,
      cartRate: pct(r.addToCart, r.views),
      unitsSold: r.unitsSold,
      revenue: r.revenue,
      avgPrice: r.avgPrice,
      uniqueVisitors: r.uniqueVisitors,
    })),
  };
}

async function categories(f) {
  const ids = await productSessionIds(f);
  const [rows, pageRows] = await Promise.all([
    itemRollup(f, "item_category"),
    AnalyticsPageView.aggregate([
      { $match: { ...pageviewMatch(f, ids), pageType: "category", categorySlug: { $ne: "" } } },
      { $group: { _id: "$categorySlug", views: { $sum: 1 }, visitors: { $addToSet: "$visitorId" } } },
      { $project: { views: 1, uniqueVisitors: { $size: "$visitors" } } },
      { $sort: { views: -1 } },
      { $limit: 100 },
    ]),
  ]);
  return {
    categories: rows.map((r) => ({
      category: r._id,
      productCount: r.productCount,
      views: r.views,
      listImpressions: r.listImpressions,
      addToCart: r.addToCart,
      cartRate: pct(r.addToCart, r.views),
      unitsSold: r.unitsSold,
      revenue: r.revenue,
      uniqueVisitors: r.uniqueVisitors,
    })),
    categoryPages: pageRows.map((r) => ({ categorySlug: r._id, views: r.views, uniqueVisitors: r.uniqueVisitors })),
  };
}

async function prices(f) {
  const rows = await itemRollup(f, "priceBand");
  return {
    bands: PRICE_BANDS.map((b) => {
      const r = rows.find((x) => x._id === b.key) || {};
      return {
        key: b.key,
        label: b.label,
        views: r.views || 0,
        listImpressions: r.listImpressions || 0,
        addToCart: r.addToCart || 0,
        cartRate: pct(r.addToCart || 0, r.views || 0),
        unitsSold: r.unitsSold || 0,
        revenue: r.revenue || 0,
        uniqueVisitors: r.uniqueVisitors || 0,
      };
    }),
  };
}

async function searchForms(f) {
  const [searches, fields] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: eventMatch(f, { name: "search", search_term: { $ne: "" } }) },
      { $group: { _id: "$search_term", searches: { $sum: 1 }, sessions: { $addToSet: "$sessionId" } } },
      { $project: { term: "$_id", searches: 1, uniqueSessions: { $size: "$sessions" } } },
      { $sort: { searches: -1 } },
      { $limit: 100 },
    ]),
    AnalyticsEvent.aggregate([
      { $match: eventMatch(f, { name: "field_interaction" }) },
      {
        $group: {
          _id: { path: "$path", field: "$fieldName" },
          interactions: { $sum: 1 },
          filled: { $sum: { $cond: ["$filled", 1, 0] } },
          sessions: { $addToSet: "$sessionId" },
        },
      },
      {
        $project: {
          path: "$_id.path", field: "$_id.field", interactions: 1, filled: 1,
          uniqueSessions: { $size: "$sessions" },
        },
      },
      { $sort: { interactions: -1 } },
      { $limit: 200 },
    ]),
  ]);
  const zeroRows = await AnalyticsEvent.aggregate([
    { $match: eventMatch(f, { name: "search_result", search_term: { $ne: "" } }) },
    {
      $group: {
        _id: "$search_term",
        searches: { $sum: 1 },
        zeroResults: { $sum: { $cond: [{ $eq: ["$resultCount", 0] }, 1, 0] } },
        avgResults: { $avg: "$resultCount" },
      },
    },
    { $sort: { zeroResults: -1, searches: -1 } },
    { $limit: 100 },
  ]);
  return {
    searches,
    zeroSearches: zeroRows.filter((r) => r.zeroResults > 0).map((r) => ({
      term: r._id,
      searches: r.searches,
      zeroResults: r.zeroResults,
      zeroRate: pct(r.zeroResults, r.searches),
      avgResults: Math.round((r.avgResults || 0) * 10) / 10,
    })),
    fields: fields.map((x) => ({ ...x, fillRate: pct(x.filled, x.interactions) })),
  };
}

async function audience(f) {
  const ids = await productSessionIds(f);
  const sMatch = sessionMatch(f, ids);
  const group = (expr) => [
    {
      $group: {
        _id: expr,
        sessions: { $sum: 1 },
        converted: { $sum: { $cond: [{ $gt: ["$conversionCount", 0] }, 1, 0] } },
        bounces: { $sum: BOUNCE_EXPR },
        activeMs: { $sum: "$activeMs" },
      },
    },
    { $sort: { sessions: -1 } },
    { $limit: 30 },
  ];
  const keys = ["source", "medium", "campaign", "device", "browser", "os", "country"];
  const facets = Object.fromEntries(keys.map((k) => [k, group(`$${k}`)]));
  facets.segment = group({ $cond: [{ $ne: ["$userId", null] }, "customer", "guest"] });

  const [result] = await AnalyticsSession.aggregate([{ $match: sMatch }, { $facet: facets }]);
  const out = {};
  for (const [key, rows] of Object.entries(result || {})) {
    out[key] = rows.map((r) => ({
      value: r._id === null || r._id === undefined || r._id === "" ? "(none)" : String(r._id),
      sessions: r.sessions,
      conversionRate: pct(r.converted, r.sessions),
      bounceRate: pct(r.bounces, r.sessions),
      avgSessionMs: r.sessions ? round(r.activeMs / r.sessions) : 0,
    }));
  }
  return { breakdowns: out };
}

async function users(f) {
  const ids = await productSessionIds(f);
  const sMatch = sessionMatch(f, ids);
  const [byUser, revByUser, recent] = await Promise.all([
    AnalyticsSession.aggregate([
      { $match: { ...sMatch, userId: { $ne: null } } },
      {
        $group: {
          _id: "$userId",
          name: { $last: "$userName" },
          email: { $last: "$userEmail" },
          sessions: { $sum: 1 },
          pageViews: { $sum: "$pageViews" },
          activeMs: { $sum: "$activeMs" },
          conversions: { $sum: "$conversionCount" },
          firstSeen: { $min: "$startedAt" },
          lastSeen: { $max: "$lastSeenAt" },
          visitorId: { $last: "$visitorId" },
        },
      },
      { $sort: { lastSeen: -1 } },
      { $limit: 200 },
    ]),
    AnalyticsEvent.aggregate([
      { $match: eventMatch(f, { name: "purchase", userId: { $ne: null } }) },
      { $unwind: "$items" },
      ...(hasItemFilter(f) ? [{ $match: itemStage(f) }] : []),
      {
        $group: {
          _id: "$userId",
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          orders: { $addToSet: "$transaction_id" },
        },
      },
      { $project: { revenue: { $round: ["$revenue", 2] }, orders: { $size: "$orders" } } },
    ]),
    AnalyticsSession.find(sMatch)
      .sort({ lastSeenAt: -1 })
      .limit(100)
      .select("sessionId visitorId userName userEmail userId device browser os country source medium campaign entryPath exitPath pageViews clickCount eventCount conversionCount activeMs startedAt lastSeenAt")
      .lean(),
  ]);

  const revMap = new Map(revByUser.map((r) => [String(r._id), r]));
  return {
    customers: byUser.map((u) => {
      const r = revMap.get(String(u._id));
      return {
        userId: String(u._id),
        name: u.name,
        email: u.email,
        sessions: u.sessions,
        pageViews: u.pageViews,
        avgSessionMs: u.sessions ? round(u.activeMs / u.sessions) : 0,
        conversions: u.conversions,
        orders: r?.orders || 0,
        revenue: r?.revenue || 0,
        firstSeen: u.firstSeen,
        lastSeen: u.lastSeen,
        visitorId: u.visitorId,
      };
    }),
    recent: recent.map((r) => ({ ...r, bounced: isBounced(r) })),
  };
}

async function live(f) {
  const match = { lastSeenAt: { $gte: new Date(Date.now() - LIVE_WINDOW_MS) }, ...dimMatch(f, SESSION_DIMS), ...sessionSegmentMatch(f) };
  const [count, sessions] = await Promise.all([
    AnalyticsSession.countDocuments(match),
    AnalyticsSession.find(match)
      .sort({ lastSeenAt: -1 })
      .limit(50)
      .select("sessionId visitorId userName userEmail device browser os country source exitPath pageViews activeMs lastSeenAt")
      .lean(),
  ]);
  return { count, sessions };
}

async function options() {
  const since = new Date(Date.now() - 365 * 86400000);
  const [sources, mediums, campaigns, countries, browsers, oses, categoryNames, topProducts] = await Promise.all([
    AnalyticsSession.distinct("source", { startedAt: { $gte: since } }),
    AnalyticsSession.distinct("medium", { startedAt: { $gte: since } }),
    AnalyticsSession.distinct("campaign", { startedAt: { $gte: since } }),
    AnalyticsSession.distinct("country", { startedAt: { $gte: since } }),
    AnalyticsSession.distinct("browser", { startedAt: { $gte: since } }),
    AnalyticsSession.distinct("os", { startedAt: { $gte: since } }),
    AnalyticsEvent.distinct("items.item_category", { createdAt: { $gte: since } }),
    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: since }, name: "view_item" } },
      { $unwind: "$items" },
      { $group: { _id: "$items.item_id", name: { $first: "$items.item_name" }, views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: 200 },
    ]),
  ]);
  const clean = (arr) => arr.filter(Boolean).map(String).sort();
  return {
    sources: clean(sources),
    mediums: clean(mediums),
    campaigns: clean(campaigns),
    countries: clean(countries),
    browsers: clean(browsers),
    oses: clean(oses),
    categories: clean(categoryNames),
    products: topProducts.map((p) => ({ id: p._id, name: p.name || p._id, views: p.views })),
    pageTypes: PAGE_TYPES,
    priceBands: PRICE_BANDS.map((b) => ({ key: b.key, label: b.label })),
    devices: DEVICES,
    segments: SEGMENTS,
  };
}

async function variants(f) {
  const [rows, viewers, pickers] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: eventMatch(f, { name: "option_select" }) },
      { $group: { _id: { path: "$path", group: "$label", value: "$variant" }, selections: { $sum: 1 }, sessions: { $addToSet: "$sessionId" } } },
      { $project: { path: "$_id.path", group: "$_id.group", value: "$_id.value", selections: 1, uniqueSessions: { $size: "$sessions" } } },
      { $sort: { selections: -1 } },
      { $limit: 200 },
    ]),
    AnalyticsEvent.distinct("sessionId", eventMatch(f, { name: "view_item" })),
    AnalyticsEvent.distinct("sessionId", eventMatch(f, { name: "option_select" })),
  ]);
  const viewerSet = new Set(viewers);
  const pickerCount = pickers.filter((id) => viewerSet.has(id)).length;
  return {
    options: rows,
    viewerSessions: viewerSet.size,
    pickerSessions: pickerCount,
    pickRate: pct(pickerCount, viewerSet.size),
  };
}

function errorGroup(f, name) {
  return AnalyticsEvent.aggregate([
    { $match: eventMatch(f, { name }) },
    {
      $group: {
        _id: "$label",
        count: { $sum: 1 },
        sessions: { $addToSet: "$sessionId" },
        paths: { $addToSet: "$path" },
        statuses: { $addToSet: "$statusCode" },
      },
    },
    { $project: { message: "$_id", count: 1, uniqueSessions: { $size: "$sessions" }, paths: { $slice: ["$paths", 3] }, statuses: 1 } },
    { $sort: { count: -1 } },
    { $limit: 100 },
  ]);
}

async function errors(f) {
  const [js, api, form, errorSessionIds] = await Promise.all([
    errorGroup(f, "js_error"),
    errorGroup(f, "api_error"),
    errorGroup(f, "form_error"),
    AnalyticsEvent.distinct("sessionId", eventMatch(f, { name: { $in: ["js_error", "api_error", "form_error"] } })),
  ]);
  const conversion = async (ids) => {
    const [row] = await AnalyticsSession.aggregate([
      { $match: sessionMatch(f, ids) },
      { $group: { _id: null, sessions: { $sum: 1 }, converted: { $sum: { $cond: [{ $gt: ["$conversionCount", 0] }, 1, 0] } } } },
    ]);
    return { sessions: row?.sessions || 0, converted: row?.converted || 0 };
  };
  const errored = await conversion(errorSessionIds);
  const all = await conversion(null);
  return {
    js,
    api,
    form,
    errorSessions: errored.sessions,
    errorConversionRate: pct(errored.converted, errored.sessions),
    overallConversionRate: pct(all.converted, all.sessions),
  };
}

const CHECKOUT_PAGE = "checkout";

async function checkout(f) {
  const ids = await productSessionIds(f);
  const base = (extra) => ({
    createdAt: { $gte: f.since, $lte: f.until },
    ...dimMatch(f, SESSION_DIMS),
    ...eventSegmentMatch(f),
    ...(ids ? { sessionId: { $in: ids } } : {}),
    ...extra,
  });

  const [flags, fieldRows, errorRows] = await Promise.all([
    AnalyticsEvent.aggregate([
      {
        $match: base({
          name: { $in: ["begin_checkout", "add_shipping_info", "add_payment_info", "purchase", "form_error", "api_error"] },
        }),
      },
      {
        $group: {
          _id: "$sessionId",
          started: { $max: { $cond: [{ $eq: ["$name", "begin_checkout"] }, 1, 0] } },
          shipping: { $max: { $cond: [{ $eq: ["$name", "add_shipping_info"] }, 1, 0] } },
          payment: { $max: { $cond: [{ $eq: ["$name", "add_payment_info"] }, 1, 0] } },
          purchased: { $max: { $cond: [{ $eq: ["$name", "purchase"] }, 1, 0] } },
          errors: {
            $sum: {
              $cond: [
                { $and: [{ $in: ["$name", ["form_error", "api_error"]] }, { $eq: ["$pageType", CHECKOUT_PAGE] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    AnalyticsEvent.aggregate([
      { $match: base({ name: "field_interaction", pageType: CHECKOUT_PAGE }) },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$sessionId", lastField: { $first: "$fieldName" }, lastFilled: { $first: "$filled" } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: base({ name: { $in: ["form_error", "api_error"] }, pageType: CHECKOUT_PAGE }) },
      {
        $group: {
          _id: { type: "$name", message: "$label", status: "$statusCode" },
          count: { $sum: 1 },
          sessions: { $addToSet: "$sessionId" },
        },
      },
      {
        $project: {
          type: "$_id.type", message: "$_id.message", status: "$_id.status",
          count: 1, uniqueSessions: { $size: "$sessions" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]),
  ]);

  const fieldBySession = new Map(fieldRows.map((r) => [r._id, r]));
  const started = flags.filter((s) => s.started === 1);
  const purchased = started.filter((s) => s.purchased === 1);
  const abandoned = started.filter((s) => s.purchased !== 1);

  const reasonCounts = new Map();
  const leftAt = new Map();
  for (const s of abandoned) {
    const field = fieldBySession.get(s._id);
    const emptyField = Boolean(field) && field.lastFilled === false;
    const reason = s.errors > 0 ? "Saw an error on checkout"
      : emptyField ? "Left on an empty field"
      : s.payment === 1 ? "Left at payment with no error"
      : s.shipping === 1 ? "Left at shipping with no error"
      : "Left before shipping with no error";
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    const key = field ? `${field.lastField}${field.lastFilled ? "" : " (empty)"}` : "(no field touched)";
    leftAt.set(key, (leftAt.get(key) || 0) + 1);
  }

  const stepRows = [
    { step: "Started checkout", sessions: started.length },
    { step: "Entered shipping", sessions: started.filter((s) => s.shipping === 1).length },
    { step: "Entered payment", sessions: started.filter((s) => s.payment === 1).length },
    { step: "Purchased", sessions: purchased.length },
  ];
  const steps = stepRows.map((row, i) => ({
    ...row,
    dropFromPrevious: i === 0 ? 0 : pct(stepRows[i - 1].sessions - row.sessions, stepRows[i - 1].sessions),
  }));

  return {
    kpis: {
      started: started.length,
      purchased: purchased.length,
      conversionRate: pct(purchased.length, started.length),
      abandoned: abandoned.length,
      abandonRate: pct(abandoned.length, started.length),
      errorSessions: started.filter((s) => s.errors > 0).length,
    },
    steps,
    reasons: [...reasonCounts.entries()]
      .map(([reason, sessions]) => ({ reason, sessions, share: pct(sessions, abandoned.length) }))
      .sort((a, b) => b.sessions - a.sessions),
    leftAt: [...leftAt.entries()]
      .map(([field, sessions]) => ({ field, sessions, share: pct(sessions, abandoned.length) }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 20),
    errors: errorRows.map((e) => ({ ...e, status: e.status || "" })),
  };
}

async function retention(f) {
  const DAY = 86400000;
  const rows = await Order.aggregate([
    {
      $match: {
        createdAt: { $lte: f.until },
        status: { $nin: ["Cancelled", "Refunded"] },
        "customer.userId": { $ne: null },
      },
    },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: "$customer.userId",
        dates: { $push: "$createdAt" },
        revenue: { $sum: "$financials.total" },
      },
    },
  ]);

  const cohort = rows.filter((r) => r.dates[0] >= f.since && r.dates[0] <= f.until);
  const repeaters = cohort.filter((r) => r.dates.length >= 2);
  const within = (days) => repeaters.filter((r) => r.dates[1] - r.dates[0] <= days * DAY).length;
  const gaps = repeaters.map((r) => (r.dates[1] - r.dates[0]) / DAY).sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length === 0 ? 0 : gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;

  const created = await Customer.find({ createdAt: { $gte: f.since, $lte: f.until } }).select("_id").lean();
  const buyerIds = new Set(rows.map((r) => String(r._id)));
  const accountsPurchased = created.filter((c) => buyerIds.has(String(c._id))).length;

  const months = new Map();
  for (const r of cohort) {
    const key = r.dates[0].toISOString().slice(0, 7);
    const m = months.get(key) || { month: key, customers: 0, repeat: 0, repeat30: 0, revenue: 0 };
    m.customers += 1;
    m.revenue += r.revenue || 0;
    if (r.dates.length >= 2) {
      m.repeat += 1;
      if (r.dates[1] - r.dates[0] <= 30 * DAY) m.repeat30 += 1;
    }
    months.set(key, m);
  }

  const touches = cohort.length
    ? await AnalyticsSession.find({ userId: { $in: cohort.map((r) => r._id) } })
      .select("userId startedAt source medium")
      .sort({ startedAt: 1 })
      .lean()
    : [];
  const visitsByUser = new Map();
  for (const s of touches) {
    const k = String(s.userId);
    if (!visitsByUser.has(k)) visitsByUser.set(k, []);
    visitsByUser.get(k).push(s);
  }
  const sourceLabel = (s) => (s ? `${s.source || "direct"}${s.medium ? ` / ${s.medium}` : ""}` : "(no visit recorded)");
  const firstTouch = new Map();
  const lastTouch = new Map();
  for (const r of cohort) {
    const list = visitsByUser.get(String(r._id)) || [];
    const first = sourceLabel(list[0]);
    const row = firstTouch.get(first) || { source: first, customers: 0, repeaters: 0 };
    row.customers += 1;
    if (r.dates.length >= 2) {
      row.repeaters += 1;
      const before = list.filter((s) => s.startedAt <= r.dates[1]);
      const last = sourceLabel(before[before.length - 1]);
      lastTouch.set(last, (lastTouch.get(last) || 0) + 1);
    }
    firstTouch.set(first, row);
  }

  const avgOrders = cohort.length ? cohort.reduce((sum, r) => sum + r.dates.length, 0) / cohort.length : 0;
  const avgRevenue = cohort.length ? cohort.reduce((sum, r) => sum + (r.revenue || 0), 0) / cohort.length : 0;

  return {
    kpis: {
      cohortCustomers: cohort.length,
      repeatRate: pct(repeaters.length, cohort.length),
      repeat30Rate: pct(within(30), cohort.length),
      repeat90Rate: pct(within(90), cohort.length),
      medianDaysToSecondOrder: Math.round(median),
      avgOrders: Math.round(avgOrders * 10) / 10,
      avgRevenue: money(avgRevenue),
      accountsCreated: created.length,
      accountsPurchased,
    },
    cohorts: [...months.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((m) => ({
        month: m.month,
        customers: m.customers,
        repeatRate: pct(m.repeat, m.customers),
        repeat30Rate: pct(m.repeat30, m.customers),
        avgRevenue: money(m.revenue / m.customers),
      })),
    firstTouch: [...firstTouch.values()]
      .map((r) => ({ ...r, repeatRate: pct(r.repeaters, r.customers) }))
      .sort((a, b) => b.customers - a.customers)
      .slice(0, 30),
    lastTouch: [...lastTouch.entries()]
      .map(([source, count]) => ({ source, repeaters: count }))
      .sort((a, b) => b.repeaters - a.repeaters),
  };
}

async function friction(f) {
  const names = ["dead_click", "rage_click"];
  const [rows, hitSessions, totalSessions] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: eventMatch(f, { name: { $in: names } }) },
      { $group: { _id: { type: "$name", label: "$label", path: "$path" }, count: { $sum: 1 }, sessions: { $addToSet: "$sessionId" } } },
      { $project: { type: "$_id.type", label: "$_id.label", path: "$_id.path", count: 1, uniqueSessions: { $size: "$sessions" } } },
      { $sort: { count: -1 } },
      { $limit: 200 },
    ]),
    AnalyticsEvent.distinct("sessionId", eventMatch(f, { name: { $in: names } })),
    AnalyticsSession.countDocuments(sessionMatch(f)),
  ]);
  return {
    kpis: {
      deadClicks: rows.filter((r) => r.type === "dead_click").reduce((s, r) => s + r.count, 0),
      rageBursts: rows.filter((r) => r.type === "rage_click").reduce((s, r) => s + r.count, 0),
      sessionsHit: hitSessions.length,
      sessionsHitPct: pct(hitSessions.length, totalSessions),
    },
    rows,
  };
}

async function heatmap(f) {
  const COLS = 20;
  const ROW_PX = 200;
  const MAX_ROWS = 60;
  const pages = await AnalyticsEvent.aggregate([
    { $match: eventMatch(f, { name: "heat_click" }) },
    { $group: { _id: "$path", clicks: { $sum: 1 } } },
    { $sort: { clicks: -1 } },
    { $limit: 50 },
  ]);
  const path = f.heatPath || pages[0]?._id || "";
  const cells = path
    ? await AnalyticsEvent.aggregate([
      { $match: eventMatch(f, { name: "heat_click", path, clickX: { $ne: null }, clickY: { $ne: null } }) },
      {
        $project: {
          col: { $min: [COLS - 1, { $floor: { $divide: ["$clickX", 100 / COLS] } }] },
          row: { $min: [MAX_ROWS - 1, { $floor: { $divide: ["$clickY", ROW_PX] } }] },
        },
      },
      { $group: { _id: { col: "$col", row: "$row" }, count: { $sum: 1 } } },
    ])
    : [];
  return {
    path,
    pages: pages.map((p) => ({ path: p._id, clicks: p.clicks })),
    cols: COLS,
    rowPx: ROW_PX,
    rows: cells.length ? Math.max(...cells.map((c) => c._id.row)) + 1 : 0,
    cells: cells.map((c) => ({ col: c._id.col, row: c._id.row, count: c.count })),
    max: Math.max(1, ...cells.map((c) => c.count)),
    total: cells.reduce((s, c) => s + c.count, 0),
  };
}

const TABS = {
  overview,
  pages,
  sections,
  clicks,
  products,
  categories,
  prices,
  search: searchForms,
  audience,
  users,
  live,
  variants,
  errors,
  checkout,
  retention,
  friction,
  heatmap,
};

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "analytics.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await dbConnect();
    const sp = new URL(req.url).searchParams;
    const tab = sp.get("tab") || "overview";

    if (tab === "options") return NextResponse.json({ success: true, data: await options() });

    const handler = TABS[tab];
    if (!handler) return NextResponse.json({ error: "Unknown tab" }, { status: 400 });

    const filters = parseFilters(sp);
    const data = await handler(filters);
    return NextResponse.json({
      success: true,
      tab,
      filters: { since: filters.since, until: filters.until },
      data,
    });
  } catch (error) {
    console.error("Site analytics error:", error);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
