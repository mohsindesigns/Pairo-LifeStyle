"use client";

// Admin → Products → 3D Rack: every product with its photos; make 3D models from them (one by one or in bulk,
// via the OFFCUT 3D service) or upload a .glb, and arrange what hangs on the homepage 3D rack.
import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import { ArrowUp, ArrowDown, X, Loader2, Upload, Sparkles, RotateCw, Trash2, RefreshCw, Search, Check, Box } from "lucide-react";
import { Page, PageHeader, Postbox, Notice } from "@/components/admin/ui";
import RequirePermission from "@/components/admin/RequirePermission";
import { can } from "@/lib/rbac";

// The steps a model goes through, with where each sits on the progress bar
const STEPS = [
  { key: "waiting", label: "In line", at: 0 },
  { key: "service", label: "Waiting for the 3D service", at: 1 },
  { key: "sending", label: "Sending photo", at: 2 },
  { key: "generating", label: "AI building the 3D model", at: 6 },
  { key: "downloading", label: "Downloading", at: 86 },
  { key: "optimising", label: "Optimising for the web", at: 92 },
  { key: "saving", label: "Saving to the store", at: 96 },
];
function stepOf(m) {
  if (m.status === "waiting") return 0;
  if (m.status === "queued" && !m.stage) return 1; // sent; queued at the service behind other models
  const st = { uploading: "sending", sending: "sending", generating: "generating", downloading: "downloading", optimising: "optimising", saving: "saving" }[m.stage] || (m.status === "queued" ? "sending" : "generating");
  return STEPS.findIndex((x) => x.key === st);
}
const pctOf = (m) => Math.max(STEPS[Math.max(0, stepOf(m))].at, Math.min(99, Math.round(m.progress || 0)));
const since = (t, now) => { if (!t) return ""; const s = Math.max(0, Math.round((now - new Date(t).getTime()) / 1000)); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`; };
function useNow(on) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!on) return undefined; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [on]);
  return now;
}

// Progress bar for one model: step name, percent, elapsed time and the step dots
function ProgressBar({ m, compact = false }) {
  const now = useNow(true);
  const i = Math.max(0, stepOf(m));
  const pct = pctOf(m);
  const waiting = m.status === "waiting" || i === 1;
  return (
    <div style={{ width: "100%" }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="3D model progress">
      <div className="wp-small" style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <span style={{ fontWeight: 600 }}>{STEPS[i].label}{waiting ? "…" : ""}</span>
        <span className="wp-muted">{waiting ? "waiting" : `${pct}%`}{m.startedAt ? ` · ${since(m.startedAt, now)}` : ""}</span>
      </div>
      <div style={{ height: compact ? 6 : 8, background: "#e0e0e0", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${waiting ? 3 : pct}%`, background: waiting ? "#a7aaad" : "linear-gradient(90deg,#2271b1,#4f94d4)", borderRadius: 99, transition: "width 1.2s ease", backgroundSize: "200% 100%", animation: waiting ? "none" : "rack3dStripe 1.6s linear infinite" }} />
      </div>
      {!compact && (
        <div style={{ display: "flex", gap: 3, marginTop: 5 }} aria-hidden="true">
          {STEPS.map((st, k) => <span key={st.key} title={st.label} style={{ flex: 1, height: 3, borderRadius: 2, background: k < i ? "#00a32a" : k === i ? "#2271b1" : "#dcdcde" }} />)}
        </div>
      )}
      {m.hasFiles && <div className="wp-small wp-muted" style={{ marginTop: 4 }}>The current model stays live until the new one is ready.</div>}
    </div>
  );
}

// Everything being made, whatever page or filter is open
function MakingPanel({ list }) {
  if (!list || !list.length) return null;
  const done = list.filter((m) => m.status !== "waiting");
  const avg = Math.round(list.reduce((a, m) => a + (m.status === "waiting" ? 0 : pctOf(m)), 0) / list.length);
  return (
    <Postbox title={`Being made (${list.length})`} aside={<span className="wp-small wp-muted">{done.length} in progress · {list.length - done.length} in line · about 1–3 min each</span>}>
      <div style={{ marginBottom: 10 }}>
        <div className="wp-small" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><strong>Overall</strong><span>{avg}%</span></div>
        <div style={{ height: 10, background: "#e0e0e0", borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(2, avg)}%`, background: "#00a32a", borderRadius: 99, transition: "width 1.2s ease" }} /></div>
      </div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {list.map((m) => (
          <div key={m.id} style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 10, alignItems: "center", padding: 8, border: "1px solid #dcdcde", borderRadius: 4, background: "#fff" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {m.image ? <img src={m.image} alt="" style={{ width: 44, height: 52, objectFit: "contain", background: "#f6f7f7", borderRadius: 3 }} /> : <span />}
            <div style={{ minWidth: 0 }}>
              <div className="wp-small wp-strong" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{m.productName}{m.color ? ` · ${m.color}` : ""}</div>
              <ProgressBar m={m} compact />
            </div>
          </div>
        ))}
      </div>
    </Postbox>
  );
}
const isBusy = (m) => m && ["waiting", "queued", "processing"].includes(m.status);
const FILTERS = [["all", "All products"], ["without", "No 3D model"], ["with", "Has 3D model"], ["onrack", "On the rack"], ["busy", "Being made"], ["failed", "Failed"]];
const readFile = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

async function api(url, opts = {}) {
  const r = await fetch(url, opts.body && !(opts.body instanceof FormData) ? { ...opts, headers: { "Content-Type": "application/json" }, body: JSON.stringify(opts.body) } : opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

export default function Rack3DAdminPage() {
  return (
    <RequirePermission permission="products.view">
      <Rack3DAdmin />
    </RequirePermission>
  );
}

function Rack3DAdmin() {
  const { data: session } = useSession();
  const canEdit = can(session?.user, "products.edit");
  const canKeys = can(session?.user, "settings.manage");
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState({ q: "", filter: "all", page: 1 });
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sel, setSel] = useState([]);
  const [bulkHang, setBulkHang] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [make, setMake] = useState(null);
  const [upload, setUpload] = useState(null);
  const dirtyRef = useRef(false);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  const load = useCallback(async () => {
    try {
      const sp = new URLSearchParams({ q: query.q, filter: query.filter, page: String(query.page) });
      const j = await api(`/api/admin/rack-3d?${sp}`);
      setD((prev) => { if (!prev && j.settings) setBulkHang(j.settings.autoHang); return j; }); setErr("");
      if (!dirtyRef.current) setItems(j.rack.map((x) => ({ ...x })));
    } catch (e) { setErr(e.message); }
  }, [query]);
  useEffect(() => { Promise.resolve().then(load); }, [load]);
  // search as you type (debounced)
  useEffect(() => { const t = setTimeout(() => setQuery((x) => (x.q === search ? x : { ...x, q: search, page: 1 })), 350); return () => clearTimeout(t); }, [search]);

  const working = d && (d.waiting + d.running > 0);
  useEffect(() => { if (!working) return undefined; const t = setInterval(load, 3000); return () => clearInterval(t); }, [working, load]);

  if (err && !d) return <Page><PageHeader title="3D Rack" /><Notice type="error">{err}</Notice></Page>;
  if (!d) return <Page><PageHeader title="3D Rack" /><p className="wp-muted"><Loader2 className="inline w-4 h-4 animate-spin" /> Loading…</p></Page>;

  const setRack = (next) => { setItems(next); setDirty(true); };
  const move = (i, dir) => { const n = [...items]; const [x] = n.splice(i, 1); n.splice(i + dir, 0, x); setRack(n); };
  const saveRack = async (next = items) => {
    setSaving(true);
    try { await api("/api/admin/rack-3d", { method: "PUT", body: { items: next.map((i) => ({ id: i.id, scale: i.scale })) } }); setDirty(false); dirtyRef.current = false; toast.success("Rack saved — the homepage shows it now"); await load(); } catch (e) { toast.error(e.message); }
    setSaving(false);
  };
  const hang = (p, image) => {
    const next = [...items, { id: p.id, name: p.name, status: p.status, scale: 1, image }];
    if (dirty) setRack(next); else saveRack(next);
  };
  const unhang = (p) => { const next = items.filter((x) => x.id !== p.id); if (dirty) setRack(next); else saveRack(next); };
  const act = async (fn, ok) => { try { await fn(); if (ok) toast.success(ok); await load(); } catch (e) { toast.error(e.message); } };
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const pageIds = d.products.map((p) => p.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => sel.includes(id));
  const bulkMake = async () => {
    if (!window.confirm(`Make 3D models for ${sel.length} product${sel.length === 1 ? "" : "s"} from their photos? This uses Tripo API credits (about 30–40 per model).`)) return;
    setBulkBusy(true);
    try {
      const r = await api("/api/admin/rack-3d/bulk", { method: "POST", body: { productIds: sel, addToRack: bulkHang } });
      toast.success(`${r.queued} model${r.queued === 1 ? "" : "s"} queued — they are made a few at a time.`);
      if (r.skipped.length) toast.error(`${r.skipped.length} skipped: ${r.skipped.slice(0, 3).map((s) => `${s.name || s.id} (${s.reason})`).join("; ")}${r.skipped.length > 3 ? "…" : ""}`, { duration: 8000 });
      setSel([]); await load();
    } catch (e) { toast.error(e.message); }
    setBulkBusy(false);
  };
  const go = (patch) => { setQuery((x) => ({ ...x, ...patch })); };

  return (
    <Page>
      <PageHeader title="3D Rack" aside={<a className="wp-btn" href="/" target="_blank" rel="noreferrer">View homepage ↗</a>} />
      <p className="wp-muted" style={{ marginTop: -6, marginBottom: 14 }}>
        Make 3D models of your products from their photos and choose what hangs on the homepage 3D rack. To show the rack, add the <strong>3D Rack</strong> section to the homepage in <Link className="wp-link" href="/admin/pages">Pages</Link> → Builder.
      </p>

      <div className="wp-stats" style={{ marginBottom: 16 }}>
        <div className="wp-stat"><div className="wp-stat-label">On the rack</div><div className="wp-stat-value">{items.length}</div></div>
        <div className="wp-stat"><div className="wp-stat-label">Products with a 3D model</div><div className="wp-stat-value">{d.counts.with} <span className="wp-muted" style={{ fontSize: 14 }}>/ {d.counts.all}</span></div></div>
        <div className="wp-stat"><div className="wp-stat-label">Being made</div><div className="wp-stat-value">{d.waiting + d.running}{working && <Loader2 className="inline w-4 h-4 animate-spin" style={{ marginLeft: 6 }} />}</div></div>
        <div className="wp-stat"><div className="wp-stat-label">Tripo API key</div><div className="wp-stat-value" style={{ fontSize: 18 }}>{d.keys.tripo ? "Connected" : "Not added"}</div></div>
      </div>

      <div className="wp-cols">
        <div className="wp-col-main">
          <Postbox title="On the rack" aside={canEdit && <button type="button" className="wp-btn wp-btn-primary" disabled={!dirty || saving} onClick={() => saveRack()}>{saving ? "Saving…" : "Save rack"}</button>}>
            <p className="wp-muted">Left to right, as shoppers see it. Size makes a piece hang larger or smaller next to the others.</p>
            {!items.length && <p className="wp-empty">Nothing on the rack yet — make 3D models below, then hang them here.</p>}
            <ol style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 8 }}>
              {items.map((it, i) => (
                <li key={it.id} style={{ display: "grid", gridTemplateColumns: "24px 48px 1fr auto", gap: 10, alignItems: "center", padding: 8, border: "1px solid #dcdcde", borderRadius: 4, background: "#fff" }}>
                  <strong style={{ textAlign: "center", color: "#646970" }}>{i + 1}</strong>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {it.image ? <img src={it.image} alt="" style={{ width: 48, height: 56, objectFit: "contain", background: "#f6f7f7", borderRadius: 3 }} /> : <span />}
                  <div style={{ minWidth: 0 }}>
                    <div className="wp-strong">{it.name}{it.status !== "Published" && <span className="wp-muted"> · {it.status} (hidden in the shop)</span>}</div>
                    {canEdit && (
                      <label className="wp-small wp-muted" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        Size <input type="range" min="0.6" max="1.6" step="0.02" value={it.scale} onChange={(e) => setRack(items.map((x) => (x.id === it.id ? { ...x, scale: Number(e.target.value) } : x)))} style={{ width: 130 }} /> {Math.round(it.scale * 100)}%
                      </label>
                    )}
                  </div>
                  {canEdit && (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button type="button" className="wp-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move left"><ArrowUp className="w-4 h-4" /></button>
                      <button type="button" className="wp-btn" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move right"><ArrowDown className="w-4 h-4" /></button>
                      <button type="button" className="wp-btn" onClick={() => setRack(items.filter((x) => x.id !== it.id))} aria-label="Take off the rack"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            {canEdit && d.hangable.length > 0 && (
              <div className="wp-field" style={{ marginTop: 12 }}>
                <label className="wp-label">Hang another piece</label>
                <select className="wp-select" value="" onChange={(e) => { const p = d.hangable.find((x) => x.id === e.target.value); if (p && !items.some((x) => x.id === p.id)) setRack([...items, { id: p.id, name: p.name, status: "Published", scale: 1, image: p.image }]); }}>
                  <option value="">Choose a product with a 3D model…</option>
                  {d.hangable.filter((p) => !items.some((x) => x.id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </Postbox>
        </div>

        <div className="wp-col-side">
          <SettingsBox canEdit={canEdit} canKeys={canKeys} onSaved={load} />
        </div>
      </div>

      <style>{`@keyframes rack3dStripe { from { background-position: 200% 0 } to { background-position: 0 0 } }`}</style>
      <MakingPanel list={d.making} />

      <Postbox title="Products">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}>
            <Search className="w-4 h-4" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#8c8f94" }} />
            <input className="wp-input" style={{ paddingLeft: 30, width: "100%" }} placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search products" />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {FILTERS.map(([k, label]) => (
              <button key={k} type="button" className={`wp-btn ${d.filter === k ? "wp-btn-primary" : ""}`} onClick={() => { setSel([]); go({ filter: k, page: 1 }); }}>
                {label} <span style={{ opacity: 0.7 }}>({d.counts[k] ?? 0})</span>
              </button>
            ))}
          </div>
        </div>

        {canEdit && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "8px 10px", background: sel.length ? "#f0f6fc" : "#f6f7f7", border: "1px solid #dcdcde", borderRadius: 4, marginBottom: 12 }}>
            <label className="wp-small" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={allOnPage} onChange={() => setSel(allOnPage ? sel.filter((id) => !pageIds.includes(id)) : [...new Set([...sel, ...pageIds])])} /> Select all on this page
            </label>
            <span className="wp-small wp-muted">{sel.length} selected</span>
            <span style={{ flex: 1 }} />
            <label className="wp-small" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={bulkHang} onChange={(e) => setBulkHang(e.target.checked)} /> Hang on the rack when ready
            </label>
            <button type="button" className="wp-btn wp-btn-primary" disabled={!sel.length || bulkBusy || !d.keys.tripo} title={d.keys.tripo ? undefined : "Needs a Tripo API key"} onClick={bulkMake}>
              <Sparkles className="inline w-3.5 h-3.5" /> {bulkBusy ? "Queuing…" : `Make 3D for selected${sel.length ? ` (${sel.length})` : ""}`}
            </button>
            {sel.length > 0 && <button type="button" className="wp-btn" onClick={() => setSel([])}>Clear</button>}
          </div>
        )}

        {!d.products.length ? <p className="wp-empty">No products match.</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
            {d.products.map((p) => (
              <ProductCard key={p.id} p={p} canEdit={canEdit} keys={d.keys} selected={sel.includes(p.id)} onToggle={() => toggle(p.id)}
                onMake={(c) => setMake({ product: p, color: c })} onUpload={(c) => setUpload({ product: p, color: c })}
                onHang={(img) => hang(p, img)} onUnhang={() => unhang(p)} act={act} />
            ))}
          </div>
        )}

        {d.pages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 14 }}>
            <button type="button" className="wp-btn" disabled={d.page <= 1} onClick={() => go({ page: d.page - 1 })}>‹ Previous</button>
            <span className="wp-small">Page {d.page} of {d.pages} · {d.total} products</span>
            <button type="button" className="wp-btn" disabled={d.page >= d.pages} onClick={() => go({ page: d.page + 1 })}>Next ›</button>
          </div>
        )}
      </Postbox>

      {make && <MakeModal {...make} defaults={d.settings} onClose={() => setMake(null)} onDone={() => { setMake(null); load(); }} />}
      {upload && <UploadModal {...upload} onClose={() => setUpload(null)} onDone={() => { setUpload(null); load(); }} />}
    </Page>
  );
}

function ProductCard({ p, canEdit, keys, selected, onToggle, onMake, onUpload, onHang, onUnhang, act }) {
  const main = p.colors[0];
  const ready = p.colors.find((c) => c.model?.hasFiles);
  const photo = main.image || p.images[0] || "";
  return (
    <div style={{ border: `1px solid ${selected ? "#2271b1" : "#dcdcde"}`, boxShadow: selected ? "0 0 0 1px #2271b1" : "none", borderRadius: 6, background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ position: "relative", aspectRatio: "1 / 1", background: "#f6f7f7" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo ? <img src={photo} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div className="wp-muted" style={{ display: "grid", placeItems: "center", height: "100%" }}>No photo</div>}
        {canEdit && <label style={{ position: "absolute", top: 8, left: 8, background: "#fffd", borderRadius: 4, padding: "2px 4px" }}><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${p.name}`} /></label>}
        {ready?.model?.previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ready.model.previewUrl} alt="3D preview" title="3D model preview" style={{ position: "absolute", right: 8, bottom: 8, width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: "2px solid #fff", boxShadow: "0 1px 4px #0003" }} />
        )}
        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
          {p.onRack && <span className="wp-pill wp-pill-sm" style={{ background: "#00a32a", color: "#fff" }}>On rack</span>}
          {ready && !p.onRack && <span className="wp-pill wp-pill-sm"><Box className="inline w-3 h-3" /> 3D</span>}
        </div>
      </div>
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div className="wp-strong" style={{ lineHeight: 1.3 }}>{p.name}{p.status !== "Published" && <span className="wp-muted"> · {p.status}</span>}</div>
        {p.colors.map((c) => {
          const m = c.model;
          const idle = !isBusy(m);
          return (
            <div key={c.label || "one"} style={{ borderTop: p.colors.length > 1 ? "1px solid #f0f0f1" : "none", paddingTop: p.colors.length > 1 ? 6 : 0 }}>
              {c.label && <div className="wp-small" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: c.hex, border: "1px solid #0002" }} />{c.label}</div>}
              <ModelState m={m} />
              {canEdit && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {idle && <button type="button" className="wp-btn" disabled={!keys.tripo} title={keys.tripo ? "Make a 3D model from this product's photo" : "Needs a Tripo API key — or use Upload .glb"} onClick={() => onMake(c)}><Sparkles className="inline w-3.5 h-3.5" /> {m?.hasFiles ? "Remake" : "Make 3D"}</button>}
                  {idle && <button type="button" className="wp-btn" disabled={!keys.tripo && !keys.token} onClick={() => onUpload(c)} title="Upload a .glb (e.g. made on the Tripo website)"><Upload className="inline w-3.5 h-3.5" /> .glb</button>}
                  {m?.status === "failed" && !String(m.error).includes("no longer") && <button type="button" className="wp-btn" onClick={() => act(() => api(`/api/admin/rack-3d/models/${m.id}/retry`, { method: "POST" }), "Trying again…")}>Retry</button>}
                  {m?.hasFiles && m.status === "ready" && <button type="button" className="wp-btn" title="Turn it round if it hangs back to front (free)" onClick={() => act(() => api(`/api/admin/rack-3d/models/${m.id}/rotate`, { method: "POST", body: { degrees: 180 } }), "Turning it round…")}><RotateCw className="inline w-3.5 h-3.5" /></button>}
                  {m && idle && <button type="button" className="wp-btn" title="Move the 3D model to Trash" onClick={() => { if (window.confirm(`Move the 3D model of ${p.name}${c.label ? " — " + c.label : ""} to Trash? It leaves the rack; you can restore it from Trash.`)) act(() => api(`/api/admin/rack-3d/models/${m.id}`, { method: "DELETE" }), "Moved to Trash"); }} aria-label="Move 3D model to Trash"><Trash2 className="inline w-3.5 h-3.5" /></button>}
                </div>
              )}
            </div>
          );
        })}
        {canEdit && ready && (
          <div style={{ marginTop: "auto" }}>
            {p.onRack
              ? <button type="button" className="wp-btn" style={{ width: "100%" }} onClick={onUnhang}><X className="inline w-3.5 h-3.5" /> Take off the rack</button>
              : <button type="button" className="wp-btn wp-btn-primary" style={{ width: "100%" }} onClick={() => onHang(ready.image || photo)}><Check className="inline w-3.5 h-3.5" /> Hang on the rack</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function ModelState({ m }) {
  if (!m) return <span className="wp-small wp-muted">No 3D model yet</span>;
  if (isBusy(m)) return <ProgressBar m={m} />;
  return (
    <span className="wp-small" style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {m.hasFiles && <span style={{ color: "#00a32a", fontWeight: 600 }}>✓ 3D model ready</span>}
      {m.status === "failed" && <span style={{ color: "#d63638" }}>{m.hasFiles ? "Last attempt failed: " : "Failed: "}{m.error || "unknown error"}</span>}
      {m.hasFiles && m.meta?.rack_tris && <span className="wp-muted">{Math.round(m.meta.rack_tris / 1000)}k / {Math.round(m.meta.detail_tris / 1000)}k tris</span>}
    </span>
  );
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="wp-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wp-modal" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: 640, width: "100%" }}>
        <div className="wp-modal-head"><h2>{title}</h2><button type="button" className="wp-btn" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button></div>
        <div className="wp-modal-body">{children}</div>
        <div className="wp-modal-foot">{footer}</div>
      </div>
    </div>
  );
}

function PhotoPick({ label, value, onChange, choices, optional }) {
  const ref = useRef();
  const tile = (on) => ({ width: 88, height: 100, border: `2px solid ${on ? "#2271b1" : "#dcdcde"}`, borderRadius: 4, background: "#f6f7f7", padding: 3, display: "grid", placeItems: "center", cursor: "pointer", fontSize: 12 });
  return (
    <div className="wp-field" style={{ marginBottom: 12 }}>
      <label className="wp-label">{label}{optional && <span className="wp-muted"> (optional)</span>}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {optional && <button type="button" style={tile(!value)} onClick={() => onChange("")}>None</button>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {choices.map((src) => <button type="button" key={src} style={tile(value === src)} onClick={() => onChange(src)}><img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></button>)}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value && value.startsWith("data:") && <button type="button" style={tile(true)}><img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></button>}
        <button type="button" style={tile(false)} onClick={() => ref.current.click()}>＋ Upload</button>
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={async (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) onChange(await readFile(f)); }} />
      </div>
    </div>
  );
}

function MakeModal({ product, color, defaults = {}, onClose, onDone }) {
  const choices = [...new Set([color.image, ...product.images].filter(Boolean))];
  const [front, setFront] = useState(color.image || choices[0] || "");
  const [back, setBack] = useState("");
  const [quality, setQuality] = useState(defaults.defaultQuality || "detailed");
  const [addToRack, setAddToRack] = useState(!product.onRack && defaults.autoHang !== false);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await api("/api/admin/rack-3d/models", { method: "POST", body: { productId: product.id, color: color.label, views: { front, back }, quality, addToRack } }); toast.success("Queued — the 3D model takes about 1–3 minutes"); onDone(); } catch (e) { toast.error(e.message); setBusy(false); }
  };
  return (
    <Modal title={`Make 3D — ${product.name}${color.label ? " · " + color.label : ""}`} onClose={onClose}
      footer={<><button type="button" className="wp-btn" onClick={onClose}>Cancel</button> <button type="button" className="wp-btn wp-btn-primary" disabled={!front || busy} onClick={go}>{busy ? "Sending…" : "Make 3D model"}</button></>}>
      <PhotoPick label="Front photo (the whole garment, facing the camera)" value={front} onChange={setFront} choices={choices} />
      <PhotoPick label="Back photo" value={back} onChange={setBack} choices={choices} optional />
      <div className="wp-field"><label className="wp-label">Texture quality</label>
        <select className="wp-select" value={quality} onChange={(e) => setQuality(e.target.value)}><option value="detailed">Detailed (recommended)</option><option value="standard">Standard (fewer credits)</option></select></div>
      <label className="wp-small" style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "8px 0" }}><input type="checkbox" checked={addToRack} onChange={(e) => setAddToRack(e.target.checked)} /> Hang it on the rack when it’s ready</label>
      <p className="wp-small wp-muted">Uses Tripo API credits (about 30–40 per model). Photos of just the garment on a plain background work best. If it comes out back to front, use “Turn round” — that’s free.</p>
    </Modal>
  );
}

function UploadModal({ product, color, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const tooBig = file && file.size > 70 * 1024 * 1024;
  const go = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("productId", product.id); fd.append("color", color.label); fd.append("file", file);
      await api("/api/admin/rack-3d/models/import", { method: "POST", body: fd });
      toast.success("Uploaded — optimising for the rack"); onDone();
    } catch (e) { toast.error(e.message); setBusy(false); }
  };
  return (
    <Modal title={`Upload a 3D model — ${product.name}${color.label ? " · " + color.label : ""}`} onClose={onClose}
      footer={<><button type="button" className="wp-btn" onClick={onClose}>Cancel</button> <button type="button" className="wp-btn wp-btn-primary" disabled={!file || tooBig || busy} onClick={go}>{busy ? "Uploading…" : "Upload"}</button></>}>
      <p className="wp-small">Made this piece on the Tripo website (Image to 3D → download as GLB), or have a model from a 3D artist or a scan? Upload the .glb here — it’s turned, sized and optimised for the rack automatically. No API credits used. Files up to 70 MB are fine (Tripo exports are usually about 60 MB).</p>
      <div className="wp-field"><label className="wp-label">Model file (.glb)</label><input type="file" accept=".glb,model/gltf-binary" onChange={(e) => setFile(e.target.files[0] || null)} /></div>
      {tooBig && <Notice type="error">That file is over 70 MB.</Notice>}
    </Modal>
  );
}

// Settings & keys for the 3D rack (no server environment needed). Keys are write-only: they are stored
// encrypted and only their last 4 characters are ever shown.
function SettingsBox({ canEdit, canKeys, onSaved }) {
  const [v, setV] = useState(null);
  const [f, setF] = useState(null);
  const [newKey, setNewKey] = useState("");
  const [newToken, setNewToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const read = useCallback(async () => {
    try { const j = await api("/api/admin/rack-3d/settings"); setV(j); setF({ serviceUrl: j.serviceUrlSaved, maxRunning: j.maxRunning, defaultQuality: j.defaultQuality, autoHang: j.autoHang }); } catch (e) { setMsg(e.message); }
  }, []);
  useEffect(() => { Promise.resolve().then(read); }, [read]);
  if (!v || !f) return <Postbox title="Settings & keys"><p className="wp-muted"><Loader2 className="inline w-4 h-4 animate-spin" /> Loading…</p></Postbox>;

  const save = async (extra = {}) => {
    setSaving(true); setMsg("");
    try {
      const body = { ...f, ...extra };
      if (newKey) body.tripoKey = newKey;
      if (newToken) body.serviceToken = newToken;
      const j = await api("/api/admin/rack-3d/settings", { method: "PUT", body });
      setV(j); setNewKey(""); setNewToken(""); toast.success("Settings saved"); onSaved && onSaved();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };
  const test = async () => { setMsg("Testing…"); try { setMsg((await api("/api/admin/rack-3d/test", { method: "POST" })).message); } catch (e) { setMsg(e.message); } };
  const keyRow = (label, info, value, setValue, field, help) => (
    <div className="wp-field" style={{ marginBottom: 12 }}>
      <label className="wp-label">{label}</label>
      <div className="wp-small" style={{ marginBottom: 4 }}>
        {info.set ? <>Saved <code>{info.preview}</code>{info.source === "server environment" && <span className="wp-muted"> (from the server environment)</span>}</> : <span className="wp-muted">Not set</span>}
        {canKeys && info.set && info.source === "admin" && <button type="button" className="wp-link" style={{ marginLeft: 8, background: "none", border: 0, cursor: "pointer", color: "#d63638" }} onClick={() => { if (window.confirm(`Remove the saved ${label}?`)) save({ [field]: null }); }}>Remove</button>}
      </div>
      {canKeys ? <input className="wp-input" type="password" autoComplete="new-password" style={{ width: "100%" }} placeholder={info.set ? "Paste a new one to replace it" : "Paste it here"} value={value} onChange={(e) => setValue(e.target.value)} /> : <p className="wp-small wp-muted">Only staff who can manage settings can change this.</p>}
      <p className="wp-small wp-muted" style={{ marginTop: 4 }}>{help}</p>
    </div>
  );

  return (
    <Postbox title="Settings & keys">
      {keyRow("Tripo API key", v.tripoKey, newKey, setNewKey, "tripoKey", <>Makes 3D models from your product photos (about 30–40 Tripo API credits each). Get it at <a className="wp-link" href="https://developers.tripo3d.ai/en/keys" target="_blank" rel="noreferrer">developers.tripo3d.ai</a> — website plan credits don’t work here.</>)}
      {keyRow("3D service token", v.serviceToken, newToken, setNewToken, "serviceToken", "Access token for the OFFCUT 3D service. Needed for everything, including Upload .glb.")}
      <div className="wp-field" style={{ marginBottom: 12 }}>
        <label className="wp-label">3D service address</label>
        <input className="wp-input" style={{ width: "100%" }} disabled={!canEdit} value={f.serviceUrl} placeholder={v.defaultServiceUrl} onChange={(e) => setF({ ...f, serviceUrl: e.target.value })} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="wp-field"><label className="wp-label">Models made at once</label>
          <select className="wp-select" disabled={!canEdit} value={f.maxRunning} onChange={(e) => setF({ ...f, maxRunning: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
        <div className="wp-field"><label className="wp-label">Default quality</label>
          <select className="wp-select" disabled={!canEdit} value={f.defaultQuality} onChange={(e) => setF({ ...f, defaultQuality: e.target.value })}><option value="detailed">Detailed</option><option value="standard">Standard (fewer credits)</option></select></div>
      </div>
      <label className="wp-small" style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 0" }}>
        <input type="checkbox" disabled={!canEdit} checked={f.autoHang} onChange={(e) => setF({ ...f, autoHang: e.target.checked })} /> Hang new models on the rack when they’re ready
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {canEdit && <button type="button" className="wp-btn wp-btn-primary" disabled={saving} onClick={() => save()}>{saving ? "Saving…" : "Save settings"}</button>}
        <button type="button" className="wp-btn" onClick={test} disabled={!v.tripoKey.set && !v.serviceToken.set}><RefreshCw className="inline w-3.5 h-3.5" /> Test connection</button>
      </div>
      {msg && <p className="wp-small" style={{ marginTop: 8 }}>{msg}</p>}
      <p className="wp-small wp-muted" style={{ marginTop: 8 }}>Finished models are copied into this store’s own storage, so the rack keeps working even if the 3D service is down.</p>
    </Postbox>
  );
}
