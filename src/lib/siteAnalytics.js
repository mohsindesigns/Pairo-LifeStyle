/**
 * First-party visitor analytics (browser). Feeds the admin "Visitor Analytics" dashboard.
 * Every export is a no-op during SSR and when the visitor declined cookies.
 */

const VISITOR_KEY = "pairo_vid";
const SESSION_KEY = "pairo_session";
const CONSENT_KEY = "pairo_cookie_consent";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const TICK_MS = 15000;
const FLUSH_MS = 3000;
const MIN_SECTION_MS = 1000;
const SENSITIVE_FIELD = /card|cvv|cvc|pass|secret|token|ssn|iban|routing|account/i;

let current = null;
let initialized = false;
let queue = [];
let flushTimer = null;
let observer = null;
const sectionStates = new Map();

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function isEnabled() {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(CONSENT_KEY) === "declined") return false;
    if (window.location.pathname.startsWith("/admin")) return false;
    if (window.self !== window.top) return false;
  } catch {
    return false;
  }
  return true;
}

function getVisitorId() {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = newId();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

function getSessionId() {
  const now = Date.now();
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch {}
  let id = stored?.id;
  if (!id || now - (stored.last || 0) > SESSION_IDLE_MS) id = newId();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id, last: now }));
  return id;
}

function send(payload, { beacon = false } = {}) {
  const body = JSON.stringify(payload);
  try {
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/collect", new Blob([body], { type: "application/json" }));
      return Promise.resolve(null);
    }
    return fetch("/api/analytics/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).then((r) => r.json()).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

function attribution() {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source");
  const utmMedium = params.get("utm_medium");
  const utmCampaign = params.get("utm_campaign");
  let referrerHost = "";
  try {
    referrerHost = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
  } catch {}
  return {
    source: (utmSource || referrerHost || "direct").slice(0, 120),
    medium: (utmMedium || (referrerHost ? "referral" : "none")).slice(0, 120),
    campaign: (utmCampaign || "").slice(0, 160),
  };
}

function currentScrollPct() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 100;
  return Math.round((window.scrollY / scrollable) * 100);
}

function resolveSectionName(el, index) {
  const explicit = el.getAttribute("data-track-section");
  if (explicit) return explicit.slice(0, 80);
  if (el.id) return `#${el.id}`.slice(0, 80);
  const aria = el.getAttribute("aria-label");
  if (aria) return aria.slice(0, 80);
  const heading = el.querySelector("h1, h2, h3");
  const text = heading?.innerText?.trim();
  if (text) return text.replace(/\s+/g, " ").slice(0, 80);
  return `section ${index + 1}`;
}

function findSections() {
  return Array.from(document.querySelectorAll("section, [data-track-section]"))
    .filter((el) => !el.closest("header, nav, footer, [data-track-ignore]"))
    .slice(0, 60);
}

function nearestSectionName(el) {
  const section = el.closest("section, [data-track-section]");
  return section ? resolveSectionName(section, 0) : "";
}

function enqueue(evt) {
  if (!isEnabled()) return;
  queue.push({ ...evt, pageViewId: evt.pageViewId ?? current?.id ?? null });
  if (queue.length >= 50) {
    flushQueue(false);
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => flushQueue(false), FLUSH_MS);
  }
}

function flushQueue(beacon) {
  clearTimeout(flushTimer);
  flushTimer = null;
  if (!queue.length) return;
  const events = queue.splice(0, 100);
  send({ type: "batch", sessionId: getSessionId(), visitorId: getVisitorId(), events }, { beacon });
}

// Adds time spent since the last tick, counting only while the tab is visible.
function tick() {
  if (!current) return;
  const now = Date.now();
  if (document.visibilityState === "visible") current.pendingMs += now - current.lastTick;
  current.lastTick = now;
  flushHeartbeat(false);
}

function flushHeartbeat(beacon) {
  if (!current || !current.id || current.pendingMs <= 0) return;
  const engagedMs = Math.round(current.pendingMs);
  current.pendingMs = 0;
  send({
    type: "heartbeat",
    sessionId: current.sessionId,
    visitorId: current.visitorId,
    pageViewId: current.id,
    engagedMs,
    scrollPct: current.maxScroll,
  }, { beacon });
}

function startSectionObserver() {
  if (!("IntersectionObserver" in window)) return;
  if (observer) observer.disconnect();
  sectionStates.clear();
  observer = new IntersectionObserver((entries) => {
    const now = Date.now();
    for (const entry of entries) {
      const st = sectionStates.get(entry.target);
      if (!st) continue;
      const visible = entry.intersectionRatio >= 0.5;
      if (visible && !st.active) {
        st.active = true;
        st.since = now;
      } else if (!visible && st.active) {
        st.total += now - st.since;
        st.active = false;
      }
    }
  }, { threshold: [0, 0.5] });

  findSections().forEach((el, i) => {
    sectionStates.set(el, { name: resolveSectionName(el, i), active: false, since: 0, total: 0 });
    observer.observe(el);
  });
}

function flushSections() {
  const now = Date.now();
  for (const st of sectionStates.values()) {
    if (st.active) {
      st.total += now - st.since;
      st.since = now;
    }
    if (st.total >= MIN_SECTION_MS) {
      enqueue({
        name: "section_view",
        label: st.name,
        durationMs: Math.round(st.total),
        path: current?.path || window.location.pathname,
        pageViewId: current?.id ?? null,
      });
    }
    st.total = 0;
  }
}

export function trackPageView(path, title = "") {
  if (!isEnabled()) return;
  if (current) {
    tick();
    flushSections();
    flushHeartbeat(true);
  }

  const sessionId = getSessionId();
  const visitorId = getVisitorId();
  const attr = attribution();
  current = { id: null, path, sessionId, visitorId, lastTick: Date.now(), pendingMs: 0, maxScroll: 0 };
  const view = current;

  send({
    type: "pageview",
    sessionId,
    visitorId,
    path,
    title: String(title || document.title || "").slice(0, 200),
    referrer: document.referrer ? document.referrer.slice(0, 300) : "",
    source: attr.source,
    medium: attr.medium,
    campaign: attr.campaign,
  }).then((res) => {
    if (res?.pageViewId) {
      view.id = res.pageViewId;
      flushHeartbeat(false);
    }
  });

  setTimeout(startSectionObserver, 800);
  setTimeout(startSectionObserver, 3000);
}

export function recordSiteEvent(name, params = {}) {
  if (!isEnabled()) return;
  enqueue({
    name,
    path: typeof window !== "undefined" ? window.location.pathname.slice(0, 300) : "",
    params: {
      value: params.value,
      currency: params.currency,
      items: params.items,
      search_term: params.search_term,
      item_list_name: params.item_list_name,
      shipping_tier: params.shipping_tier,
      payment_type: params.payment_type,
      transaction_id: params.transaction_id,
    },
  });
}

export function recordOptionSelect(optionGroup, value, product) {
  if (!isEnabled() || !product) return;
  const productId = String(product.sku || product._id || product.id || "");
  if (!productId) return;
  enqueue({
    name: "option_select",
    label: String(optionGroup || "").slice(0, 120),
    variant: String(value || "").slice(0, 80),
    path: window.location.pathname.slice(0, 300),
    params: {
      items: [{ item_id: productId, item_name: String(product.name || "").slice(0, 200), price: Number(product.price) || 0, quantity: 1 }],
    },
  });
}

export function recordSearchResult(term, resultCount) {
  const q = String(term || "").trim();
  if (!q || !isEnabled()) return;
  enqueue({
    name: "search_result",
    path: window.location.pathname.slice(0, 300),
    resultCount: Number(resultCount) || 0,
    params: { search_term: q },
  });
}

export function initSiteAnalytics() {
  if (!isEnabled() || initialized) return () => {};
  initialized = true;

  const onScroll = () => {
    if (!current) return;
    current.maxScroll = Math.max(current.maxScroll, currentScrollPct());
  };

  let domActivityAt = 0;
  let netActivityAt = 0;
  let rageTarget = null;
  let rageTimes = [];

  const onClick = (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const pathNow = window.location.pathname.slice(0, 300);
    const el = target?.closest("a, button, [data-track], [role='button'], label, input[type='submit'], input[type='button']");
    if (!el || el.closest("[data-track-ignore]")) return;

    const raw = el.getAttribute("data-track")
      || el.getAttribute("aria-label")
      || el.innerText
      || el.getAttribute("title")
      || el.getAttribute("alt")
      || el.tagName.toLowerCase();
    const label = String(raw).replace(/\s+/g, " ").trim().slice(0, 120);

    let href = "";
    if (el.tagName === "A" && el.href) {
      try {
        const url = new URL(el.href);
        href = url.origin === window.location.origin ? url.pathname.slice(0, 300) : url.hostname.slice(0, 120);
      } catch {}
    }

    enqueue({
      name: "click",
      label,
      href,
      section: nearestSectionName(el),
      path: pathNow,
    });

    const now = Date.now();
    if (rageTarget === el) rageTimes.push(now);
    else { rageTarget = el; rageTimes = [now]; }
    rageTimes = rageTimes.filter((t) => now - t <= 1000);
    if (rageTimes.length >= 3) {
      enqueue({ name: "rage_click", label, section: nearestSectionName(el), path: pathNow, value: rageTimes.length });
      rageTimes = [];
    }

    const isNewTabOrMail = el.tagName === "A" && (el.target === "_blank" || /^(mailto|tel):/.test(el.getAttribute("href") || ""));
    const isField = el.tagName === "LABEL" || el.tagName === "INPUT";
    if (isNewTabOrMail || isField) return;

    const urlAtClick = window.location.href;
    const focusAtClick = document.activeElement;
    setTimeout(() => {
      const responded = domActivityAt >= now || netActivityAt >= now
        || window.location.href !== urlAtClick || document.activeElement !== focusAtClick;
      if (!responded && el.isConnected) {
        enqueue({ name: "dead_click", label, section: nearestSectionName(el), path: pathNow, durationMs: 1500 });
      }
    }, 1500);
  };

  const onBlur = (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
    if (el.type === "password" || el.type === "hidden" || el.type === "file") return;
    const name = el.getAttribute("name") || el.id || el.getAttribute("placeholder") || `${el.type || "text"}-field`;
    if (SENSITIVE_FIELD.test(name)) return;
    enqueue({
      name: "field_interaction",
      fieldName: name.slice(0, 80),
      filled: String(el.value || "").trim().length > 0,
      path: window.location.pathname.slice(0, 300),
    });
  };

  const onVisibility = () => {
    tick();
    if (document.visibilityState === "hidden") {
      flushSections();
      flushHeartbeat(true);
      flushQueue(true);
    }
  };

  const onPageHide = () => {
    tick();
    flushSections();
    flushHeartbeat(true);
    flushQueue(true);
  };

  const onWindowError = (e) => {
    enqueue({
      name: "js_error",
      label: String(e.message || "Script error").slice(0, 160),
      path: window.location.pathname.slice(0, 300),
    });
  };
  const onRejection = (e) => {
    const msg = e.reason?.message || String(e.reason || "unhandled rejection");
    enqueue({
      name: "js_error",
      label: `Unhandled: ${msg}`.slice(0, 160),
      path: window.location.pathname.slice(0, 300),
    });
  };
  window.addEventListener("error", onWindowError);
  window.addEventListener("unhandledrejection", onRejection);

  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const input = args[0];
    const probeUrl = typeof input === "string" ? input : input?.url || "";
    if (!probeUrl.includes("/api/analytics/")) netActivityAt = Date.now();
    const url = typeof input === "string" ? input : input?.url || "";
    const method = String(args[1]?.method || input?.method || "GET").toUpperCase();
    let pathname = "";
    try { pathname = new URL(url, window.location.origin).pathname; } catch {}
    const tracked = pathname.startsWith("/api/") && !pathname.startsWith("/api/analytics/");
    try {
      const res = await originalFetch(...args);
      if (tracked && (res.status >= 500 || [400, 409, 422, 429].includes(res.status))) {
        enqueue({
          name: "api_error",
          label: `${method} ${pathname}`.slice(0, 160),
          statusCode: res.status,
          path: window.location.pathname.slice(0, 300),
        });
      }
      return res;
    } catch (err) {
      if (tracked) {
        enqueue({
          name: "api_error",
          label: `${method} ${pathname} (network)`.slice(0, 160),
          statusCode: 0,
          path: window.location.pathname.slice(0, 300),
        });
      }
      throw err;
    }
  };

  const seenFormErrors = new Set();
  const errorObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const candidates = [node, ...node.querySelectorAll("[class*='text-red']")];
        for (const el of candidates) {
          if (!(el instanceof HTMLElement) || !/text-red/.test(el.className)) continue;
          const text = (el.innerText || "").replace(/\s+/g, " ").trim();
          if (!text || text.length > 160) continue;
          const key = `${window.location.pathname}|${text}`;
          if (seenFormErrors.has(key)) continue;
          seenFormErrors.add(key);
          enqueue({ name: "form_error", label: text, path: window.location.pathname.slice(0, 300) });
        }
      }
    }
  });
  errorObserver.observe(document.body, { childList: true, subtree: true });
  const RESPONSE_SELECTOR = "[role='dialog'], [role='alertdialog'], [role='status'], [role='alert'], [aria-live], dialog";
  const activityObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes") { domActivityAt = Date.now(); return; }
      for (const node of m.addedNodes) {
        if (node instanceof HTMLElement && (node.matches(RESPONSE_SELECTOR) || node.querySelector(RESPONSE_SELECTOR))) {
          domActivityAt = Date.now();
          return;
        }
      }
    }
  });
  activityObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "hidden", "open", "aria-expanded", "aria-hidden", "aria-selected", "aria-pressed", "aria-checked", "data-state"],
    childList: true,
    subtree: true,
  });

  // Core Web Vitals for the page the visitor landed on (first real page load only;
  // these are standards-defined for a single navigation, not every SPA route change).
  const vitalsPath = window.location.pathname.slice(0, 300);
  let lcpValue = null;
  let clsValue = 0;
  let fidValue = null;
  let vitalsReported = false;
  const vitalsObservers = [];

  if (typeof PerformanceObserver !== "undefined") {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) lcpValue = Math.round(last.renderTime || last.loadTime || last.startTime);
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
      vitalsObservers.push(lcpObserver);
    } catch {}
    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) clsValue += entry.value;
        }
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });
      vitalsObservers.push(clsObserver);
    } catch {}
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entry = list.getEntries()[0];
        if (entry && fidValue === null) fidValue = Math.round(entry.processingStart - entry.startTime);
      });
      fidObserver.observe({ type: "first-input", buffered: true });
      vitalsObservers.push(fidObserver);
    } catch {}
  }

  const reportVitals = () => {
    if (vitalsReported || !isEnabled()) return;
    if (lcpValue === null && fidValue === null && !clsValue) return;
    vitalsReported = true;
    let ttfb = null;
    try {
      const nav = performance.getEntriesByType("navigation")[0];
      if (nav) ttfb = Math.round(nav.responseStart);
    } catch {}
    enqueue({
      name: "web_vitals",
      path: vitalsPath,
      lcp: lcpValue,
      cls: clsValue ? Math.round(clsValue * 1000) / 1000 : 0,
      fid: fidValue,
      ttfb,
    });
  };
  const onVitalsHidden = () => { if (document.visibilityState === "hidden") reportVitals(); };
  document.addEventListener("visibilitychange", onVitalsHidden);
  window.addEventListener("pagehide", reportVitals);

  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("click", onClick, true);
  document.addEventListener("blur", onBlur, true);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  const interval = setInterval(tick, TICK_MS);

  return () => {
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("blur", onBlur, true);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    document.removeEventListener("visibilitychange", onVitalsHidden);
    window.removeEventListener("pagehide", reportVitals);
    vitalsObservers.forEach((o) => { try { o.disconnect(); } catch {} });
    clearInterval(interval);
    if (observer) observer.disconnect();
    window.removeEventListener("error", onWindowError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.fetch = originalFetch;
    errorObserver.disconnect();
    activityObserver.disconnect();
    initialized = false;
  };
}
