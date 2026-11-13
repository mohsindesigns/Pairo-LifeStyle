"use client";

// Admin → Products → 3D Rack: make products 3D (via the OFFCUT 3D service) and arrange the homepage rack.
import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { ArrowUp, ArrowDown, X, Loader2, Upload, Sparkles, RotateCw, Trash2, RefreshCw } from "lucide-react";
import { Page, PageHeader, Postbox, Notice } from "@/components/admin/ui";
import RequirePermission from "@/components/admin/RequirePermission";

const STAGE = { uploading: "Sending photos", generating: "AI is building it", downloading: "Downloading", optimising: "Optimising for the web" };
const busyStatus = (m) => m && ["queued", "processing"].includes(m.status);
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
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [make, setMake] = useState(null);
  const [upload, setUpload] = useState(null);
  const [testMsg, setTestMsg] = useState("");
  const dirtyRef = useRef(false);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  const load = useCallback(async () => {
    try {
      const j = await api("/api/admin/rack-3d");
      setD(j); setErr("");
      if (!dirtyRef.current) setItems(j.rack.map((x) => ({ ...x })));
    } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const busy = d && d.products.some((p) => p.colors.some((c) => busyStatus(c.model)));
  useEffect(() => { if (!busy) return undefined; const t = setInterval(load, 4000); return () => clearInterval(t); }, [busy, load]);

  if (err && !d) return <Page><PageHeader title="3D Rack" /><Notice type="error">{err}</Notice></Page>;
  if (!d) return <Page><PageHeader title="3D Rack" /><p className="wp-muted"><Loader2 className="inline w-4 h-4 animate-spin" /> Loading…</p></Page>;

  const models = d.products.flatMap((p) => p.colors.map((c) => c.model).filter(Boolean));
  const ready = models.filter((m) => m.hasFiles).length;
  const making = models.filter(busyStatus).length;
  const canHang = d.products.filter((p) => !items.some((i) => i.id === p.id) && p.colors.some((c) => c.model?.hasFiles && c.model?.rackUrl));
  const setRack = (next) => { setItems(next); setDirty(true); };
  const move = (i, dir) => { const n = [...items]; const [x] = n.splice(i, 1); n.splice(i + dir, 0, x); setRack(n); };
  const saveRack = async () => {
    setSaving(true);
    try { await api("/api/admin/rack-3d", { method: "PUT", body: { items: items.map((i) => ({ id: i.id, scale: i.scale })) } }); setDirty(false); toast.success("Rack saved — the homepage shows it now"); await load(); } catch (e) { toast.error(e.message); }
    setSaving(false);
  };
  const act = async (fn, ok) => { try { await fn(); if (ok) toast.success(ok); await load(); } catch (e) { toast.error(e.message); } };
  const test = async () => { setTestMsg("Testing…"); try { setTestMsg((await api("/api/admin/rack-3d/test", { method: "POST" })).message); } catch (e) { setTestMsg(e.message); } };

  return (
    <Page>
      <PageHeader title="3D Rack" aside={<a className="wp-btn" href="/" target="_blank" rel="noreferrer">View homepage ↗</a>} />
      <p className="wp-muted" style={{ marginTop: -6, marginBottom: 14 }}>
        Turn products into 3D models and choose what hangs on the homepage 3D rack. To show the rack, add the <strong>3D Rack</strong> section to the homepage in <Link className="wp-link" href="/admin/pages">Pages</Link> → Builder.
      </p>

      <div className="wp-stats" style={{ marginBottom: 16 }}>
        <div className="wp-stat"><div className="wp-stat-label">On the rack</div><div className="wp-stat-value">{items.length}</div></div>
        <div className="wp-stat"><div className="wp-stat-label">3D models ready</div><div className="wp-stat-value">{ready}</div></div>
        <div className="wp-stat"><div className="wp-stat-label">Being made</div><div className="wp-stat-value">{making}</div></div>
        <div className="wp-stat"><div className="wp-stat-label">Tripo API key</div><div className="wp-stat-value" style={{ fontSize: 18 }}>{d.keys.tripo ? "Connected" : "Not added"}</div></div>
      </div>

      <div className="wp-cols">
        <div className="wp-col-main">
          <Postbox title="On the rack" aside={<button type="button" className="wp-btn wp-btn-primary" disabled={!dirty || saving} onClick={saveRack}>{saving ? "Saving…" : "Save rack"}</button>}>
            <p className="wp-muted">Left to right, as shoppers see it. Size makes a piece hang larger or smaller next to the others.</p>
            {!items.length && <p className="wp-empty">Nothing on the rack yet — make a 3D model below, then hang it here.</p>}
            <ol style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 8 }}>
              {items.map((it, i) => (
                <li key={it.id} style={{ display: "grid", gridTemplateColumns: "24px 48px 1fr auto", gap: 10, alignItems: "center", padding: 8, border: "1px solid #dcdcde", borderRadius: 4, background: "#fff" }}>
                  <strong style={{ textAlign: "center", color: "#646970" }}>{i + 1}</strong>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {it.image ? <img src={it.image} alt="" style={{ width: 48, height: 56, objectFit: "contain", background: "#f6f7f7", borderRadius: 3 }} /> : <span />}
                  <div style={{ minWidth: 0 }}>
                    <div className="wp-strong">{it.name}{it.status !== "Published" && <span className="wp-muted"> · {it.status} (hidden in the shop)</span>}</div>
                    <label className="wp-small wp-muted" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      Size <input type="range" min="0.6" max="1.6" step="0.02" value={it.scale} onChange={(e) => setRack(items.map((x) => (x.id === it.id ? { ...x, scale: Number(e.target.value) } : x)))} style={{ width: 130 }} /> {Math.round(it.scale * 100)}%
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button type="button" className="wp-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move left"><ArrowUp className="w-4 h-4" /></button>
                    <button type="button" className="wp-btn" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move right"><ArrowDown className="w-4 h-4" /></button>
                    <button type="button" className="wp-btn" onClick={() => setRack(items.filter((x) => x.id !== it.id))} aria-label="Take off the rack"><X className="w-4 h-4" /></button>
                  </div>
                </li>
              ))}
            </ol>
            {canHang.length > 0 && (
              <div className="wp-field" style={{ marginTop: 12 }}>
                <label className="wp-label">Hang another piece</label>
                <select className="wp-select" value="" onChange={(e) => { const p = d.products.find((x) => x.id === e.target.value); if (p) setRack([...items, { id: p.id, name: p.name, status: p.status, scale: 1, image: (p.colors.find((c) => c.model?.hasFiles) || {}).image || p.images[0] }]); }}>
                  <option value="">Choose a product with a 3D model…</option>
                  {canHang.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </Postbox>
        </div>

        <div className="wp-col-side">
          <Postbox title="3D service">
            <p className="wp-small">Models are made by the OFFCUT 3D service at <code>{d.serviceUrl}</code>. Finished files are copied into this store’s media storage, so the rack keeps working even if the service is down.</p>
            {!d.keys.tripo && <p className="wp-small">No Tripo <strong>API</strong> key: make a model on the Tripo website (Image to 3D → download GLB) and use <strong>Upload .glb</strong>. To make models here from photos, add <code>TRIPO_API_KEY</code> to the server environment.</p>}
            {!d.keys.token && <Notice type="warning">The 3D service token (<code>RACK3D_SERVICE_TOKEN</code>) is not set on the server.</Notice>}
            <button type="button" className="wp-btn" onClick={test} disabled={!d.keys.tripo && !d.keys.token}><RefreshCw className="inline w-3.5 h-3.5" /> Test connection</button>
            {testMsg && <p className="wp-small" style={{ marginTop: 8 }}>{testMsg}</p>}
          </Postbox>
        </div>
      </div>

      <Postbox title="3D models" flush>
        <p className="wp-muted" style={{ padding: "8px 12px 0" }}>One model per colour. A clear photo of just the piece, on a plain background, works best; a back photo improves the back. Making one takes about 1–3 minutes. The rack shows up to two colours of each piece in 3D.</p>
        <div className="wp-table-box">
          <table className="wp-list-table">
            <thead><tr><th>Product</th><th>Colour</th><th>3D model</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
            <tbody>
              {d.products.map((p) => p.colors.map((c, ci) => {
                const m = c.model;
                const idle = !busyStatus(m);
                return (
                  <tr key={p.id + "-" + c.label}>
                    <td>{ci === 0 && <><span className="wp-strong">{p.name}</span>{p.onRack && <span className="wp-pill wp-pill-sm" style={{ marginLeft: 6 }}>on rack</span>}{p.status !== "Published" && <span className="wp-muted"> · {p.status}</span>}</>}</td>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{c.hex && <span style={{ width: 12, height: 12, borderRadius: 99, background: c.hex, border: "1px solid #0002" }} />}{c.label || "—"}</span></td>
                    <td><ModelState m={m} /></td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {idle && <button type="button" className="wp-btn" disabled={!d.keys.tripo} title={d.keys.tripo ? undefined : "Needs a Tripo API key — or use Upload .glb"} onClick={() => setMake({ product: p, color: c })}><Sparkles className="inline w-3.5 h-3.5" /> {m?.hasFiles ? "Remake" : "Make 3D"}</button>}{" "}
                      {idle && <button type="button" className="wp-btn" disabled={!d.keys.tripo && !d.keys.token} onClick={() => setUpload({ product: p, color: c })}><Upload className="inline w-3.5 h-3.5" /> Upload .glb</button>}{" "}
                      {m?.status === "failed" && !String(m.error).includes("no longer") && <button type="button" className="wp-btn" onClick={() => act(() => api(`/api/admin/rack-3d/models/${m.id}/retry`, { method: "POST" }))}>Retry</button>}{" "}
                      {m?.hasFiles && m.status === "ready" && <button type="button" className="wp-btn" title="Turn it round if it hangs back to front (free)" onClick={() => act(() => api(`/api/admin/rack-3d/models/${m.id}/rotate`, { method: "POST", body: { degrees: 180 } }), "Turning it round…")}><RotateCw className="inline w-3.5 h-3.5" /> Turn round</button>}{" "}
                      {m && idle && <button type="button" className="wp-btn" onClick={() => { if (window.confirm(`Delete the 3D model for ${p.name}${c.label ? " — " + c.label : ""}?`)) act(() => api(`/api/admin/rack-3d/models/${m.id}`, { method: "DELETE" }), "Model deleted"); }} aria-label="Delete model"><Trash2 className="inline w-3.5 h-3.5" /></button>}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </Postbox>

      {make && <MakeModal {...make} onClose={() => setMake(null)} onDone={() => { setMake(null); load(); }} />}
      {upload && <UploadModal {...upload} onClose={() => setUpload(null)} onDone={() => { setUpload(null); load(); }} />}
    </Page>
  );
}

function ModelState({ m }) {
  if (!m) return <span className="wp-muted">No 3D model</span>;
  if (busyStatus(m)) return <span><Loader2 className="inline w-3.5 h-3.5 animate-spin" /> {STAGE[m.stage] || "Waiting"} · {m.progress || 0}%{m.hasFiles && <span className="wp-muted"> (current model stays live)</span>}</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {m.previewUrl && <img src={m.previewUrl} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 3 }} />}
      {m.hasFiles && <span style={{ color: "#00a32a", fontWeight: 600 }}>✓ Ready</span>}
      {m.status === "failed" && <span style={{ color: "#d63638" }}>{m.hasFiles ? "Last attempt failed: " : ""}{m.error || "Failed"}</span>}
      {m.hasFiles && m.meta?.rack_tris && <span className="wp-muted wp-small">{Math.round(m.meta.rack_tris / 1000)}k / {Math.round(m.meta.detail_tris / 1000)}k tris</span>}
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
  const tile = (on) => ({ width: 76, height: 88, border: `2px solid ${on ? "#2271b1" : "#dcdcde"}`, borderRadius: 4, background: "#f6f7f7", padding: 3, display: "grid", placeItems: "center", cursor: "pointer", fontSize: 12 });
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

function MakeModal({ product, color, onClose, onDone }) {
  const choices = [...new Set([color.image, ...product.images, ...product.colors.map((c) => c.image)].filter(Boolean))];
  const [front, setFront] = useState(color.image || choices[0] || "");
  const [back, setBack] = useState("");
  const [quality, setQuality] = useState("detailed");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await api("/api/admin/rack-3d/models", { method: "POST", body: { productId: product.id, color: color.label, views: { front, back }, quality } }); toast.success("Making the 3D model — about 1–3 minutes"); onDone(); } catch (e) { toast.error(e.message); setBusy(false); }
  };
  return (
    <Modal title={`Make 3D — ${product.name}${color.label ? " · " + color.label : ""}`} onClose={onClose}
      footer={<><button type="button" className="wp-btn" onClick={onClose}>Cancel</button> <button type="button" className="wp-btn wp-btn-primary" disabled={!front || busy} onClick={go}>{busy ? "Sending…" : "Make 3D model"}</button></>}>
      <PhotoPick label="Front photo" value={front} onChange={setFront} choices={choices} />
      <PhotoPick label="Back photo" value={back} onChange={setBack} choices={choices} optional />
      <div className="wp-field"><label className="wp-label">Texture quality</label>
        <select className="wp-select" value={quality} onChange={(e) => setQuality(e.target.value)}><option value="detailed">Detailed (recommended)</option><option value="standard">Standard (fewer credits)</option></select></div>
      <p className="wp-small wp-muted">Uses Tripo API credits. The photo should show only this piece, in this colour. If it comes out back to front, use “Turn round” — that’s free.</p>
    </Modal>
  );
}

function UploadModal({ product, color, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const tooBig = file && file.size > 40 * 1024 * 1024;
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
      <p className="wp-small">Made this piece on the Tripo website (Image to 3D → download as GLB), or have a model from a 3D artist or a scan? Upload the .glb here — it’s turned, sized and optimised for the rack automatically. No API credits used. Keep the file under 40 MB (skip 8K textures when exporting).</p>
      <div className="wp-field"><label className="wp-label">Model file (.glb)</label><input type="file" accept=".glb,model/gltf-binary" onChange={(e) => setFile(e.target.files[0] || null)} /></div>
      {tooBig && <Notice type="error">That file is over 40 MB.</Notice>}
    </Modal>
  );
}
