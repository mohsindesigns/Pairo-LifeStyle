import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  ALLOWED_EVENTS, BOT_PATTERN, CONVERSION_EVENTS, SENSITIVE_FIELD, pageInfo, parseUserAgent, priceBandFor,
} from "@/lib/analyticsDimensions";
import Product from "@/models/Product";
import Category from "@/models/Category";
import AnalyticsSession from "@/models/AnalyticsSession";
import AnalyticsPageView from "@/models/AnalyticsPageView";
import AnalyticsEvent from "@/models/AnalyticsEvent";

const ID_PATTERN = /^[a-zA-Z0-9-]{8,64}$/;
const MAX_HEARTBEAT_MS = 60000;
const MAX_BATCH = 100;
const MAX_ITEMS = 24;

const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const numOrNull = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

const productCache = new Map();
let categoryCache = { slugs: new Set(), expires: 0 };

async function categorySlugs() {
  if (categoryCache.expires > Date.now()) return categoryCache.slugs;
  const rows = await Category.find({}).select("slug").lean();
  categoryCache = { slugs: new Set(rows.map((r) => r.slug).filter(Boolean)), expires: Date.now() + 5 * 60 * 1000 };
  return categoryCache.slugs;
}

async function resolveProduct(itemId) {
  const cached = productCache.get(itemId);
  if (cached && cached.expires > Date.now()) return cached.value;

  const or = [{ sku: itemId }];
  if (mongoose.isValidObjectId(itemId)) or.push({ _id: itemId });
  if (/^\d+$/.test(itemId)) or.push({ id: Number(itemId) });

  const product = await Product.findOne({ $or: or })
    .select("name primaryCategory")
    .populate("primaryCategory", "name")
    .lean();

  const value = product ? {
    productId: String(product._id),
    name: product.name || "",
    category: product.primaryCategory?.name || "",
    categoryId: product.primaryCategory?._id ? String(product.primaryCategory._id) : "",
  } : null;

  if (productCache.size > 5000) productCache.clear();
  productCache.set(itemId, { value, expires: Date.now() + 10 * 60 * 1000 });
  return value;
}

async function buildItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  const cleaned = rawItems.slice(0, MAX_ITEMS).map((i, idx) => ({
    item_id: str(String(i?.item_id ?? ""), 80),
    item_name: str(String(i?.item_name ?? ""), 200),
    item_category: str(String(i?.item_category ?? ""), 120),
    price: num(i?.price),
    quantity: Math.max(1, Math.min(999, num(i?.quantity) || 1)),
    position: num(i?.position),
  })).filter((i) => i.item_id);

  return Promise.all(cleaned.map(async (i) => {
    const product = await resolveProduct(i.item_id).catch(() => null);
    return {
      ...i,
      item_name: i.item_name || product?.name || "",
      item_category: i.item_category || product?.category || "",
      item_category_id: product?.categoryId || "",
      productId: product?.productId || "",
      priceBand: priceBandFor(i.price),
    };
  }));
}

function ensureSessionFields({ sessionId, visitorId, ua, path, referrer, source, medium, campaign, country, now, user }) {
  const dims = parseUserAgent(ua);
  return AnalyticsSession.updateOne(
    { sessionId },
    {
      $setOnInsert: {
        visitorId, startedAt: now, entryPath: path, landingPath: path, referrer,
        source: source || "direct", medium, campaign, country,
        device: dims.device, browser: dims.browser, os: dims.os,
      },
      $set: { lastSeenAt: now, ...(user ? { userId: user.id, userName: user.name, userEmail: user.email } : {}) },
    },
    { upsert: true }
  );
}

function sessionContext(session) {
  return {
    sessionId: session.sessionId,
    visitorId: session.visitorId,
    userId: session.userId || null,
    device: session.device || "",
    browser: session.browser || "",
    os: session.os || "",
    country: session.country || "",
    source: session.source || "",
    medium: session.medium || "",
    campaign: session.campaign || "",
    segment: session.userId ? "customer" : "guest",
  };
}

async function storeEvents(rawEvents, ctx, now, slugs) {
  const docs = [];
  for (const raw of rawEvents.slice(0, MAX_BATCH)) {
    const name = str(raw?.name, 60);
    if (!ALLOWED_EVENTS.has(name)) continue;
    if (name === "field_interaction" && SENSITIVE_FIELD.test(str(raw.fieldName, 80))) continue;

    const params = raw.params && typeof raw.params === "object" ? raw.params : {};
    const path = str(raw.path, 300);
    const info = pageInfo(path, slugs);
    const items = await buildItems(params.items ?? raw.items);
    const first = items[0];

    docs.push({
      ...ctx,
      pageViewId: mongoose.isValidObjectId(raw.pageViewId) ? raw.pageViewId : null,
      name,
      path,
      pageType: info.pageType,
      categorySlug: info.categorySlug,
      value: num(params.value ?? raw.value),
      currency: str(params.currency ?? raw.currency, 8),
      items,
      category: first?.item_category || "",
      priceBand: first?.priceBand || "",
      productId: first?.productId || "",
      search_term: str(params.search_term ?? raw.search_term, 120).trim().toLowerCase(),
      list_name: str(params.item_list_name ?? raw.list_name, 120),
      shipping_tier: str(params.shipping_tier ?? raw.shipping_tier, 80),
      payment_type: str(params.payment_type ?? raw.payment_type, 80),
      transaction_id: str(params.transaction_id ?? raw.transaction_id, 80),
      label: str(raw.label, 120),
      href: str(raw.href, 300),
      section: str(raw.section, 120),
      durationMs: Math.max(0, Math.min(3600000, num(raw.durationMs))),
      fieldName: str(raw.fieldName, 80),
      filled: raw.filled === true,
      variant: str(raw.variant, 80),
      statusCode: Math.max(0, Math.min(999, num(raw.statusCode))),
      resultCount: raw.resultCount === null || raw.resultCount === undefined || !Number.isFinite(Number(raw.resultCount)) ? null : Number(raw.resultCount),
      lcp: numOrNull(raw.lcp),
      cls: numOrNull(raw.cls),
      fid: numOrNull(raw.fid),
      ttfb: numOrNull(raw.ttfb),
      createdAt: now,
    });
  }
  if (docs.length) await AnalyticsEvent.insertMany(docs, { ordered: false });
  return docs;
}

export async function POST(req) {
  try {
    const ua = req.headers.get("user-agent") || "";
    if (BOT_PATTERN.test(ua)) return NextResponse.json({ ok: true, skipped: "bot" });

    const rate = await checkRateLimit(req, { limit: 600, window: 60, keyPrefix: "ANALYTICS_COLLECT" });
    if (!rate.success) return NextResponse.json({ ok: false }, { status: 429 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false }, { status: 400 });

    const { type } = body;
    const sessionId = str(body.sessionId, 64);
    const visitorId = str(body.visitorId, 64);
    if (!ID_PATTERN.test(sessionId) || !ID_PATTERN.test(visitorId)) {
      return NextResponse.json({ ok: false, error: "invalid ids" }, { status: 400 });
    }

    await dbConnect();

    const authSession = await getServerSession(authOptions).catch(() => null);
    const isCustomer = !!authSession?.user?.id && !authSession.user.isStaff && !authSession.user.isAffiliate;
    const user = isCustomer && mongoose.isValidObjectId(authSession.user.id)
      ? { id: authSession.user.id, name: str(authSession.user.name, 120), email: str(authSession.user.email, 160) }
      : null;
    const now = new Date();

    if (type === "pageview") {
      const path = str(body.path, 300) || "/";
      const slugs = await categorySlugs();
      const info = pageInfo(path, slugs);
      const country = str(req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "", 4);

      await ensureSessionFields({
        sessionId, visitorId, ua, path, country, now, user,
        referrer: str(body.referrer, 300),
        source: str(body.source, 120),
        medium: str(body.medium, 120),
        campaign: str(body.campaign, 160),
      });
      await AnalyticsSession.updateOne({ sessionId }, { $inc: { pageViews: 1 }, $set: { exitPath: path } });
      const session = await AnalyticsSession.findOne({ sessionId }).lean();

      const pageView = await AnalyticsPageView.create({
        sessionId, visitorId,
        userId: session.userId || null,
        path,
        pageType: info.pageType,
        categorySlug: info.categorySlug,
        title: str(body.title, 200),
        referrer: session.referrer || "",
        enteredAt: now,
        device: session.device, browser: session.browser, os: session.os, country: session.country,
        source: session.source, medium: session.medium, campaign: session.campaign,
        segment: session.userId ? "customer" : "guest",
      });

      return NextResponse.json({ ok: true, pageViewId: pageView._id.toString() });
    }

    if (type === "heartbeat") {
      const pageViewId = str(body.pageViewId, 24);
      if (!mongoose.isValidObjectId(pageViewId)) return NextResponse.json({ ok: false }, { status: 400 });

      const delta = Math.max(0, Math.min(MAX_HEARTBEAT_MS, num(body.engagedMs)));
      const scroll = Math.max(0, Math.min(100, num(body.scrollPct)));

      await AnalyticsPageView.updateOne(
        { _id: pageViewId, sessionId },
        { $inc: { engagedMs: delta }, $max: { maxScrollPct: scroll } }
      );
      await AnalyticsSession.updateOne({ sessionId }, { $inc: { activeMs: delta }, $set: { lastSeenAt: now } });
      return NextResponse.json({ ok: true });
    }

    if (type === "batch" || type === "event") {
      const rawEvents = type === "batch"
        ? (Array.isArray(body.events) ? body.events : [])
        : [body];

      await ensureSessionFields({
        sessionId, visitorId, ua, path: "", country: "", now, user,
        referrer: "", source: "", medium: "", campaign: "",
      });
      const session = await AnalyticsSession.findOne({ sessionId }).lean();
      const slugs = await categorySlugs();
      const docs = await storeEvents(rawEvents, sessionContext(session), now, slugs);

      const conversions = docs.filter((d) => CONVERSION_EVENTS.has(d.name)).length;
      const clicks = docs.filter((d) => d.name === "click").length;
      await AnalyticsSession.updateOne(
        { sessionId },
        {
          $inc: { eventCount: docs.length, conversionCount: conversions, clickCount: clicks },
          $set: { lastSeenAt: now },
        }
      );
      return NextResponse.json({ ok: true, stored: docs.length });
    }

    return NextResponse.json({ ok: false, error: "unknown type" }, { status: 400 });
  } catch (error) {
    // Analytics must never surface errors to the shopper.
    console.error("[Analytics Collect Error]", error.message);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
