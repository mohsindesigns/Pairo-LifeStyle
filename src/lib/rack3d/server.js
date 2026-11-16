// Server-only helpers for the homepage 3D rack: talking to the OFFCUT 3D service, a small queue that sends
// a few models at a time, copying finished models into our own storage (so the live rack never depends on
// the service), and building the rack data.
import fs from "fs";
import crypto from "crypto";
import path from "path";
import mongoose from "mongoose";
import Product from "@/models/Product";
import Rack3dModel from "@/models/Rack3dModel";
import Rack3dConfig from "@/models/Rack3dConfig";
import { uploadToStorage, deleteFromStorage } from "@/lib/storage";

export class RackError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const DEFAULT_SERVICE = "https://3d.mohsindesigns.com";

// ---------- settings & keys (set in Admin → Products → 3D Rack; env vars are only a fallback) ----------
// Keys are encrypted at rest with AES-256-GCM, keyed from RACK3D_SECRET or NEXTAUTH_SECRET.
function cipherKey() {
  const s = process.env.RACK3D_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new RackError(500, "NEXTAUTH_SECRET is not set on the server, so keys cannot be stored safely.");
  return crypto.createHash("sha256").update("rack3d:" + s).digest();
}
function seal(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", cipherKey(), iv);
  const enc = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
function open(blob) {
  if (!blob) return "";
  try {
    const [iv, tag, enc] = blob.split(".").map((x) => Buffer.from(x, "base64"));
    const d = crypto.createDecipheriv("aes-256-gcm", cipherKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch { return ""; } // secret changed: the key has to be entered again
}

let rtCache = null;
// Current settings + keys (cached for a few seconds)
export async function rt() {
  if (rtCache && rtCache.at > Date.now() - 5000) return rtCache.v;
  const cfg = (await Rack3dConfig.findOne({ key: "main" }).select("settings secrets").lean()) || {};
  const s = cfg.settings || {}, sec = cfg.secrets || {};
  const dbKey = open(sec.tripoKey), dbToken = open(sec.serviceToken);
  const v = {
    url: String(s.serviceUrl || process.env.RACK3D_SERVICE_URL || DEFAULT_SERVICE).replace(/\/$/, ""),
    key: dbKey || process.env.TRIPO_API_KEY || "",
    token: dbToken || process.env.RACK3D_SERVICE_TOKEN || "",
    keySource: dbKey ? "admin" : process.env.TRIPO_API_KEY ? "server environment" : null,
    tokenSource: dbToken ? "admin" : process.env.RACK3D_SERVICE_TOKEN ? "server environment" : null,
    maxRunning: Math.max(1, Math.min(10, Number(s.maxRunning) || Number(process.env.RACK3D_MAX_RUNNING) || 6)), // the service allows 10 per client
    defaultQuality: s.defaultQuality === "standard" ? "standard" : "detailed",
    autoHang: s.autoHang !== false,
  };
  rtCache = { at: Date.now(), v };
  return v;
}
const preview = (k) => (k ? "••••" + k.slice(-4) : "");
export async function settingsView() {
  const v = await rt();
  const cfg = (await Rack3dConfig.findOne({ key: "main" }).select("settings").lean()) || {};
  return {
    serviceUrl: v.url, serviceUrlSaved: cfg.settings?.serviceUrl || "", defaultServiceUrl: process.env.RACK3D_SERVICE_URL || DEFAULT_SERVICE,
    maxRunning: v.maxRunning, defaultQuality: v.defaultQuality, autoHang: v.autoHang,
    tripoKey: { set: !!v.key, preview: preview(v.key), source: v.keySource },
    serviceToken: { set: !!v.token, preview: preview(v.token), source: v.tokenSource },
  };
}
// Save settings. tripoKey / serviceToken: a new value replaces, "" keeps, null removes the saved one.
export async function saveSettings(b = {}, { canKeys = false } = {}) {
  const set = {};
  if (b.serviceUrl !== undefined) {
    const u = String(b.serviceUrl || "").trim().replace(/\/$/, "");
    if (u && !/^https?:\/\/[^\s/]+/.test(u)) throw new RackError(400, "Enter the 3D service address, e.g. https://3d.example.com");
    set["settings.serviceUrl"] = u;
  }
  if (b.maxRunning !== undefined) set["settings.maxRunning"] = Math.max(1, Math.min(10, Number(b.maxRunning) || 6));
  if (b.defaultQuality !== undefined) set["settings.defaultQuality"] = b.defaultQuality === "standard" ? "standard" : "detailed";
  if (b.autoHang !== undefined) set["settings.autoHang"] = !!b.autoHang;
  for (const [field, name] of [["tripoKey", "Tripo API key"], ["serviceToken", "3D service token"]]) {
    if (b[field] === undefined || b[field] === "") continue;
    if (!canKeys) throw new RackError(403, `Only staff who can manage settings can change the ${name}.`);
    if (b[field] === null) { set[`secrets.${field}`] = ""; continue; }
    const val = String(b[field]).trim();
    if (val.length < 8) throw new RackError(400, `That ${name} looks too short.`);
    set[`secrets.${field}`] = seal(val);
  }
  await Rack3dConfig.findOneAndUpdate({ key: "main" }, { $set: set }, { upsert: true });
  rtCache = null;
  return settingsView();
}
const ACTIVE = ["queued", "processing"];
const BUSY = ["waiting", ...ACTIVE];
const live = { isDeleted: { $ne: true } };

// auth: 'key' = as our Tripo API key (needed to make models from photos);
//       'token' = as our service token (enough for uploaded .glb models, no AI provider needed)
export async function svc(method, p, body, auth = "key") {
  const { url, key, token } = await rt();
  if (auth === "key" && !key) throw new RackError(400, "Making models from photos needs a Tripo API key — add it in 3D Rack → Settings & keys. You can still use Upload .glb.");
  if (auth === "token" && !token) throw new RackError(400, "Add the 3D service token in 3D Rack → Settings & keys.");
  let r;
  try {
    r = await fetch(url + p, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(90000),
      headers: { "Content-Type": "application/json", ...(auth === "key" ? { "X-Tripo-Key": key } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch (e) {
    throw new RackError(424, `Can't reach the 3D service at ${url} (${e.cause?.code || e.message}).`);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new RackError(r.status === 401 ? 400 : r.status >= 500 ? 424 : r.status, j.error || `3D service error (${r.status}).`);
  return j;
}

// ---------- product helpers ----------
const attr = (p, type) => (p.attributes || []).find((a) => a.type === type);
export function colorsOf(p) {
  const a = attr(p, "color");
  const fallback = p.images?.[0] || p.image || "";
  if (!a || !a.values?.length) return [{ label: "", hex: "", image: fallback }];
  return a.values.map((v) => ({ label: v.label || v.value || "", hex: v.hex || "#cccccc", image: v.variantImage || v.image || fallback }));
}
export const sizesOf = (p) => (attr(p, "size")?.values || []).map((v) => v.label || v.value).filter(Boolean);

// Product image path, URL or data URL → something the service can read
function forService(src) {
  if (typeof src !== "string" || !src) return null;
  if (/^(data:|https?:)/.test(src)) return src;
  if (!src.startsWith("/") || src.includes("..")) return null;
  const roots = [process.env.LOCAL_UPLOAD_DIR && src.startsWith("/uploads/") ? path.join(process.env.LOCAL_UPLOAD_DIR, src.slice("/uploads/".length)) : null, path.join(process.cwd(), "public", src)].filter(Boolean);
  const f = roots.find((x) => fs.existsSync(x));
  if (!f) throw new RackError(400, `Photo not found: ${src}`);
  const ext = path.extname(f).slice(1).toLowerCase();
  const type = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }[ext] || "application/octet-stream";
  return `data:${type};base64,${fs.readFileSync(f).toString("base64")}`;
}

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";

async function findProduct(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new RackError(404, "Product not found.");
  const p = await Product.findOne({ _id: id, isDeleted: { $ne: true } }).lean();
  if (!p) throw new RackError(404, "Product not found.");
  return p;
}
function colourOf(p, color) {
  const c = colorsOf(p).find((x) => x.label === String(color ?? ""));
  if (!c) throw new RackError(400, "That colour is not one of this product's colours.");
  return c;
}

// Queue a model of one product colour made from its photos (sent to the 3D service a few at a time)
export async function queueFromPhotos({ productId, color = "", views = {}, quality, addToRack = false }) {
  ensureTicker();
  if (!(await rt()).key) throw new RackError(400, "Making models from photos needs a Tripo API key — add it in 3D Rack → Settings & keys. You can still use Upload .glb.");
  const p = await findProduct(productId);
  const c = colourOf(p, color);
  const m = await Rack3dModel.findOne({ product: p._id, color: c.label });
  if (m && !m.isDeleted && BUSY.includes(m.status)) throw new RackError(409, `A model of “${p.name}” is already being made.`);
  const front = views.front || c.image;
  if (!front) throw new RackError(400, `“${p.name}” has no photo to make a model from.`);
  const doc = await Rack3dModel.findOneAndUpdate(
    { product: p._id, color: c.label },
    { $set: { status: "waiting", stage: "", progress: 0, startedAt: new Date(), error: "", jobId: "", jobAuth: "key", views: { front, back: views.back || "" }, quality: (quality || (await rt()).defaultQuality) === "standard" ? "standard" : "detailed", addToRack: !!addToRack, isDeleted: false, deletedAt: null } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  pump().catch((e) => console.error("[rack3d] pump", e.message));
  return doc;
}

// Make models for many products at once (each product's colours, from their own photos)
export async function queueMany({ productIds = [], addToRack = false, quality }) {
  if (!Array.isArray(productIds) || !productIds.length) throw new RackError(400, "Choose at least one product.");
  if (productIds.length > 200) throw new RackError(400, "Choose at most 200 products at a time.");
  let queued = 0;
  const skipped = [];
  for (const id of productIds) {
    let p;
    try { p = await findProduct(id); } catch { skipped.push({ id, reason: "not found" }); continue; }
    for (const c of colorsOf(p)) {
      try { await queueFromPhotos({ productId: p._id, color: c.label, quality, addToRack }); queued++; } catch (e) { skipped.push({ id: String(p._id), name: p.name, reason: e.message }); }
    }
  }
  return { queued, skipped };
}

// Send waiting models to the 3D service while fewer than the "models at once" setting are being made
let pumping = false;
export async function pump() {
  if (pumping) return;
  const { key, maxRunning } = await rt();
  if (!key) return;
  pumping = true;
  try {
    for (;;) {
      const running = await Rack3dModel.countDocuments({ ...live, status: { $in: ACTIVE }, jobId: { $ne: "" }, jobAuth: "key" });
      if (running >= maxRunning) break;
      const m = await Rack3dModel.findOneAndUpdate({ ...live, status: "waiting" }, { $set: { status: "queued", stage: "sending" } }, { sort: { updatedAt: 1 }, new: true });
      if (!m) break;
      try {
        const p = await findProduct(m.product);
        const images = {};
        for (const k of ["front", "back"]) { const s = forService(m.views?.[k]); if (s) images[k] = s; }
        if (!images.front) throw new RackError(400, "The product photo is missing.");
        const j = await svc("POST", "/v1/models", { images, name: `${p.name}${m.color ? " — " + m.color : ""}`, external_id: `pairo-${p._id}-${slug(m.color)}`, quality: m.quality }, "key");
        m.set({ status: j.status, stage: j.stage || "", progress: j.progress || 0, jobId: j.id, jobAuth: "key", error: "" });
      } catch (e) {
        if (e.status === 429) { m.set({ status: "waiting", stage: "" }); await m.save(); break; } // the service is full; try later
        m.set({ status: "failed", stage: "", error: e.message });
      }
      await m.save();
    }
  } finally { pumping = false; }
}

// Optimise a model the store already has (e.g. made on the Tripo website) — no API credits
export async function importGlb({ productId, color, glb }) {
  ensureTicker();
  if (typeof glb !== "string" || !glb.startsWith("data:")) throw new RackError(400, "Choose a .glb file.");
  const p = await findProduct(productId);
  const c = colourOf(p, color);
  const m = await Rack3dModel.findOne({ product: p._id, color: c.label });
  if (m && !m.isDeleted && BUSY.includes(m.status)) throw new RackError(409, "A model for this colour is already being made.");
  const j = await svc("POST", "/v1/models", { glb, name: `${p.name}${c.label ? " — " + c.label : ""} (upload)`, external_id: `pairo-${p._id}-${slug(c.label)}` }, "token");
  return Rack3dModel.findOneAndUpdate(
    { product: p._id, color: c.label },
    { $set: { status: j.status, stage: j.stage || "", progress: j.progress || 0, startedAt: new Date(), error: "", jobId: j.id, jobAuth: "token", isDeleted: false, deletedAt: null } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

export async function modelDoc(id) {
  const m = mongoose.Types.ObjectId.isValid(id) ? await Rack3dModel.findById(id) : null;
  if (!m) throw new RackError(404, "Model not found.");
  return m;
}

export async function rotateModel(id, degrees = 180) {
  const m = await modelDoc(id);
  if (!m.jobId) throw new RackError(400, "Only models made by the 3D service can be turned.");
  const turned = ((Number(m.meta?.rotated) || 0) + (Number.isFinite(Number(degrees)) ? Number(degrees) : 180)) % 360;
  const j = await svc("POST", `/v1/models/${m.jobId}/reprocess`, { rotate_y: turned }, m.jobAuth || "key");
  m.set({ status: j.status, stage: "optimising", progress: j.progress || 90, error: "" });
  await m.save();
  return m.toObject();
}

// Re-optimise every finished model from its original at the 3D service (free — no new AI generation), e.g. so
// older models get the hanger measurements. Each one shows progress like a new model.
export async function refitAll() {
  const ms = await Rack3dModel.find({ ...live, status: "ready", jobId: { $ne: "" } });
  let started = 0;
  const skipped = [];
  for (const m of ms) {
    try {
      const j = await svc("POST", `/v1/models/${m.jobId}/reprocess`, { rotate_y: Number.isFinite(Number(m.meta?.rotated)) ? Number(m.meta.rotated) : "auto" }, m.jobAuth || "key");
      m.set({ status: j.status, stage: "optimising", progress: j.progress || 90, error: "", startedAt: new Date() });
      await m.save();
      started++;
    } catch (e) { skipped.push(e.message); }
  }
  ensureTicker();
  return { started, skipped: skipped.length, reason: skipped[0] || null };
}

export async function retryModel(id) {
  const m = await modelDoc(id);
  if (m.status !== "failed") throw new RackError(409, "Only failed models can be retried.");
  if (!m.jobId) { m.set({ status: "waiting", error: "" }); await m.save(); pump().catch(() => {}); return m.toObject(); }
  const j = await svc("POST", `/v1/models/${m.jobId}/retry`, null, m.jobAuth || "key");
  m.set({ status: j.status, stage: j.stage || "", progress: 0, error: "" });
  await m.save();
  return m.toObject();
}

async function dropFiles(files) {
  for (const f of files || []) {
    if (!f.publicId) continue;
    await deleteFromStorage(f.publicId).catch(() => {});
    // .glb files live in Cloudinary as "raw" assets, which the default (image) destroy does not remove
    if (process.env.CLOUDINARY_CLOUD_NAME && /\.glb$/i.test(f.url || "")) {
      try { const { v2 } = await import("cloudinary"); await v2.uploader.destroy(f.publicId, { resource_type: "raw" }); } catch {}
    }
  }
}

async function takeOffRackIfNoModel(productId) {
  const still = await Rack3dModel.exists({ product: productId, ...live, rackUrl: { $ne: "" } });
  if (!still) await Rack3dConfig.updateOne({ key: "main" }, { $pull: { items: { product: productId } } });
}

// Move to Trash (restorable); the product leaves the rack if it has no other model
export async function trashModel(id) {
  const m = await modelDoc(id);
  if (BUSY.includes(m.status) && !m.isDeleted) throw new RackError(409, "This model is being made right now. Delete it when it finishes.");
  m.set({ isDeleted: true, deletedAt: new Date() });
  await m.save();
  await takeOffRackIfNoModel(m.product);
}
export async function restoreModel(id) {
  const m = await modelDoc(id);
  m.set({ isDeleted: false, deletedAt: null });
  await m.save();
}
export async function deleteModelForever(id) {
  const m = await modelDoc(id);
  if (!m.isDeleted) throw new RackError(409, "Move the model to Trash first.");
  await dropFiles(m.files);
  await Rack3dModel.deleteOne({ _id: m._id });
}
export async function trashedModels() {
  const ms = await Rack3dModel.find({ isDeleted: true }).sort({ deletedAt: -1 }).lean();
  const products = await Product.find({ _id: { $in: ms.map((m) => m.product) } }).select("name images image").lean();
  return plain(ms.map((m) => {
    const p = products.find((x) => String(x._id) === String(m.product));
    return { ...m, productName: p?.name || "(deleted product)", thumb: m.previewUrl || p?.images?.[0] || p?.image || null };
  }));
}

async function hangOnRack(productId) {
  const cfg = await getConfig();
  if (cfg.items.some((i) => String(i.product) === String(productId))) return;
  await Rack3dConfig.findOneAndUpdate({ key: "main" }, { $push: { items: { product: productId, scale: 1 } } }, { upsert: true });
}

// Bring models that are being made up to date; copy finished files into our storage; send waiting ones
let refreshing = false;
export async function refreshModels() {
  if (refreshing) return;
  refreshing = true;
  try {
    const busy = await Rack3dModel.find({ ...live, status: { $in: ACTIVE }, jobId: { $ne: "" } });
    for (const m of busy) {
      let j;
      try { j = await svc("GET", `/v1/models/${m.jobId}`, null, m.jobAuth || "key"); } catch (e) {
        if (e.status === 404) { m.set({ status: "failed", error: "The 3D service no longer has this model. Make it again." }); await m.save(); }
        continue;
      }
      if (j.status !== "ready") {
        m.set({ status: j.status, stage: j.stage || "", progress: j.progress || 0, error: j.error || "" });
        await m.save();
        continue;
      }
      try {
        const stored = [];
        const base0 = (await rt()).url;
        const grab = async (fileUrl, name) => {
          const u = new URL(fileUrl, base0);
          const r = await fetch(base0 + u.pathname, { signal: AbortSignal.timeout(120000) });
          if (!r.ok) throw new Error(`download failed (${r.status})`);
          const saved = await uploadToStorage(Buffer.from(await r.arrayBuffer()), name, "pairo-3d");
          stored.push({ url: saved.url, publicId: saved.publicId || "" });
          return saved.url;
        };
        m.set({ stage: "saving", progress: 96 });
        await m.save();
        const base = `rack-${m.product}-${slug(m.color)}-${j.id.slice(-8)}`;
        const rackUrl = await grab(j.files.rack, `${base}-rack.glb`);
        const detailUrl = await grab(j.files.detail, `${base}-detail.glb`);
        const previewUrl = j.files.preview ? await grab(j.files.preview, `${base}-preview.webp`).catch(() => "") : "";
        const old = m.files;
        m.set({ status: "ready", stage: "", progress: 100, error: "", rackUrl, detailUrl, previewUrl, files: stored, meta: j.meta || {}, views: { front: "", back: "" } });
        await m.save();
        await dropFiles(old);
        if (m.addToRack) await hangOnRack(m.product);
      } catch (e) {
        m.set({ status: "failed", error: `Made, but couldn't save it: ${e.message}` });
        await m.save();
      }
    }
    await pump();
  } finally { refreshing = false; }
}

// Keep models moving even when nobody has the admin page open (one timer per server process)
export function ensureTicker() {
  if (globalThis.__rack3dTicker) return;
  globalThis.__rack3dTicker = setInterval(() => {
    Rack3dModel.exists({ ...live, status: { $in: BUSY } })
      .then((any) => any && refreshModels())
      .catch((e) => console.error("[rack3d] tick", e.message));
  }, Number(process.env.RACK3D_POLL_MS || 4000));
  globalThis.__rack3dTicker.unref?.();
}

// ---------- the rack ----------
const plain = (x) => JSON.parse(JSON.stringify(x));

// rack3d data for one product: one rack model per hanger, up to two colourways close up
function rackModelFor(p, models) {
  const ready = colorsOf(p).map((c) => ({ c, m: models.find((m) => m.color === c.label && m.detailUrl && !m.isDeleted) })).filter((x) => x.m);
  if (!ready.length || !ready[0].m.rackUrl) return null;
  const two = ready.slice(0, 2);
  return {
    lo: ready[0].m.rackUrl, hi: ready[0].m.detailUrl, alt: (two[1] || two[0]).m.detailUrl,
    hang: ready[0].m.meta?.hang || null, // shoulder line + width measured by the 3D service
    colors: two.map(({ c }) => ({ label: c.label, sw: c.hex || "#cccccc", img: c.image })),
  };
}

export async function getConfig() {
  return (await Rack3dConfig.findOne({ key: "main" }).lean()) || { items: [] };
}

// What the homepage rack shows (published products with a finished model, in rack order)
const AUTO_MAX = 12;

// Which products hang on the rack: the saved order, or — when nothing is saved — automatically every
// product that has a finished 3D model (newest model first). Returns ids + sizes in order.
async function rackPlan() {
  const cfg = await getConfig();
  if (cfg.items.length) return { mode: "manual", items: cfg.items.map((i) => ({ product: String(i.product), scale: i.scale || 1 })) };
  const ready = await Rack3dModel.find({ ...live, rackUrl: { $ne: "" }, detailUrl: { $ne: "" } }).sort({ updatedAt: -1 }).select("product").lean();
  const ids = [...new Set(ready.map((m) => String(m.product)))];
  return { mode: "auto", items: ids.map((product) => ({ product, scale: 1 })) };
}

const rackProduct = (p, r, scale) => plain({
  _id: p._id, id: String(p._id), name: p.name, slug: p.slug, status: p.status, productType: p.productType,
  price: p.price, compareAtPrice: p.compareAtPrice, sku: p.sku, stock: p.stock, manageStock: p.manageStock,
  image: p.images?.[0] || p.image || "", images: p.images || [],
  attributes: p.attributes || [], variantCombinations: p.variantCombinations || [],
  sizes: sizesOf(p),
  rack3d: { ...r, scale: scale || 1 },
});

// What the homepage rack shows (published products with a finished model, in rack order) + what was left out and why
export async function rackReport({ includeDrafts = false } = {}) {
  const plan = await rackPlan();
  const ids = plan.items.map((i) => i.product).filter((id) => mongoose.Types.ObjectId.isValid(id));
  const [products, models] = await Promise.all([
    Product.find({ _id: { $in: ids } }).lean(),
    Rack3dModel.find({ product: { $in: ids }, ...live }).lean(),
  ]);
  const shown = [], skipped = [];
  for (const it of plan.items) {
    const p = products.find((x) => String(x._id) === it.product);
    if (!p || p.isDeleted) { skipped.push({ id: it.product, name: p?.name || "(deleted product)", reason: "the product was deleted" }); continue; }
    if (!includeDrafts && p.status !== "Published") { skipped.push({ id: it.product, name: p.name, reason: `it is a ${String(p.status || "draft").toLowerCase()} product — publish it to show it` }); continue; }
    const r = rackModelFor(p, models.filter((m) => String(m.product) === it.product));
    if (!r) { skipped.push({ id: it.product, name: p.name, reason: "it has no finished 3D model" }); continue; }
    if (plan.mode === "auto" && shown.length >= AUTO_MAX) break;
    shown.push(rackProduct(p, r, it.scale));
  }
  return { mode: plan.mode, items: shown, skipped };
}

export async function rackItems(opts) {
  return (await rackReport(opts)).items;
}

export async function saveRack(items) {
  if (!Array.isArray(items)) throw new RackError(400, "items is required.");
  const ids = items.map((it) => String(it.id || it.product));
  if (new Set(ids).size !== ids.length) throw new RackError(400, "A product is on the rack twice.");
  if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) throw new RackError(404, "Product not found.");
  const [products, models] = await Promise.all([
    Product.find({ _id: { $in: ids }, isDeleted: { $ne: true } }).lean(),
    Rack3dModel.find({ product: { $in: ids }, ...live }).lean(),
  ]);
  const clean = items.map((it, i) => {
    const p = products.find((x) => String(x._id) === ids[i]);
    if (!p) throw new RackError(404, "Product not found.");
    if (!rackModelFor(p, models.filter((m) => String(m.product) === ids[i]))) throw new RackError(400, `“${p.name}” has no finished 3D model yet.`);
    return { product: p._id, scale: Math.max(0.5, Math.min(2, Number(it.scale) || 1)) };
  });
  await Rack3dConfig.findOneAndUpdate({ key: "main" }, { $set: { items: clean } }, { upsert: true });
  return clean.length;
}

const modelOut = (m) => m && {
  id: String(m._id), color: m.color, status: m.status, stage: m.stage, progress: m.progress, error: m.error,
  hasFiles: !!m.detailUrl, rackUrl: m.rackUrl, detailUrl: m.detailUrl, previewUrl: m.previewUrl, auth: m.jobAuth, meta: m.meta || {}, updatedAt: m.updatedAt,
  startedAt: m.startedAt,
};

// Everything being made right now, with progress (shown above the product grid whatever the page/filter)
async function makingList(models) {
  const busy = models.filter((m) => BUSY.includes(m.status));
  if (!busy.length) return [];
  const ps = await Product.find({ _id: { $in: busy.map((m) => m.product) } }).select("name images image").lean();
  const order = { processing: 0, queued: 1, waiting: 2 };
  return busy
    .sort((a, b) => (order[a.status] - order[b.status]) || (new Date(a.startedAt || a.updatedAt) - new Date(b.startedAt || b.updatedAt)))
    .map((m) => {
      const p = ps.find((x) => String(x._id) === String(m.product));
      return { ...modelOut(m), productId: String(m.product), productName: p?.name || "(product)", image: p?.images?.[0] || p?.image || "" };
    });
}

// Back-office view: one page of products (with photos, colours + model status), filters with counts, and the rack.
// Model progress is brought up to date in the background, so this never waits on the 3D service.
export async function adminView({ q = "", filter = "all", page = 1, per = 24 } = {}) {
  ensureTicker();
  const run = await rt();
  refreshModels().catch((e) => console.error("[rack3d] refresh", e.message));

  const cfg = await getConfig();
  const onRackIds = cfg.items.map((i) => String(i.product));
  const models = await Rack3dModel.find(live).lean();
  const withModel = [...new Set(models.filter((m) => m.detailUrl).map((m) => String(m.product)))];
  const busyIds = [...new Set(models.filter((m) => BUSY.includes(m.status)).map((m) => String(m.product)))];
  const failedIds = [...new Set(models.filter((m) => m.status === "failed").map((m) => String(m.product)))];

  const base = { isDeleted: { $ne: true } };
  const search = String(q || "").trim();
  if (search) base.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const oid = (arr) => arr.map((x) => new mongoose.Types.ObjectId(x));
  const byFilter = {
    all: {}, with: { _id: { $in: oid(withModel) } }, without: { _id: { $nin: oid(withModel) } },
    onrack: { _id: { $in: oid(onRackIds) } }, busy: { _id: { $in: oid(busyIds) } }, failed: { _id: { $in: oid(failedIds) } },
  };
  const f = byFilter[filter] ? filter : "all";
  const counts = {};
  await Promise.all(Object.entries(byFilter).map(async ([k, cond]) => { counts[k] = await Product.countDocuments({ ...base, ...cond }); }));

  const perPage = Math.max(6, Math.min(96, Number(per) || 24));
  const total = counts[f];
  const pages = Math.max(1, Math.ceil(total / perPage));
  const pg = Math.max(1, Math.min(pages, Number(page) || 1));
  const products = await Product.find({ ...base, ...byFilter[f] }).select("name slug status images image attributes").sort({ updatedAt: -1 }).skip((pg - 1) * perPage).limit(perPage).lean();

  const byProduct = (id) => models.filter((m) => String(m.product) === String(id));
  const rackProducts = await Product.find({ _id: { $in: cfg.items.map((i) => i.product) }, isDeleted: { $ne: true } }).select("name status images image attributes").lean();
  const rack = [];
  for (const it of cfg.items) {
    const p = rackProducts.find((x) => String(x._id) === String(it.product));
    if (!p) continue;
    const r = rackModelFor(p, byProduct(p._id));
    rack.push({ id: String(p._id), name: p.name, status: p.status, scale: it.scale || 1, image: r ? r.colors[0].img : p.images?.[0] || "", ok: !!r });
  }
  const hangable = withModel.length > onRackIds.length || withModel.some((id) => !onRackIds.includes(id));
  return plain({
    serviceUrl: run.url, keys: { tripo: !!run.key, token: !!run.token }, settings: { defaultQuality: run.defaultQuality, autoHang: run.autoHang, maxRunning: run.maxRunning }, rack, counts, filter: f, q: search, page: pg, pages, total, perPage,
    waiting: models.filter((m) => m.status === "waiting").length,
    making: await makingList(models),
    homepage: await (async () => { const r = await rackReport(); return { mode: r.mode, count: r.items.length, names: r.items.map((x) => x.name), skipped: r.skipped }; })(),
    running: models.filter((m) => ACTIVE.includes(m.status)).length,
    hangable: hangable ? (await Product.find({ _id: { $in: oid(withModel.filter((id) => !onRackIds.includes(id))) }, isDeleted: { $ne: true } }).select("name images").lean()).map((p) => ({ id: String(p._id), name: p.name, image: p.images?.[0] || "" })) : [],
    products: products.map((p) => ({
      id: String(p._id), name: p.name, slug: p.slug, status: p.status, images: p.images || (p.image ? [p.image] : []),
      onRack: onRackIds.includes(String(p._id)),
      colors: colorsOf(p).map((c) => ({ ...c, model: modelOut(byProduct(p._id).find((m) => m.color === c.label)) })),
    })),
  });
}

export async function testConnection() {
  let health;
  const { url, key } = await rt();
  try { health = await (await fetch(url + "/health", { signal: AbortSignal.timeout(10000) })).json(); } catch {
    throw new RackError(424, `Can't reach the 3D service at ${url}.`);
  }
  if (!key) {
    await svc("GET", "/v1/models?limit=1", null, "token");
    return `Connected to the 3D service (v${health.version}). No Tripo API key: you can upload .glb models; add a key to make models from photos.`;
  }
  const a = await svc("GET", "/v1/account");
  return `Connected to the 3D service (v${health.version}). Tripo API credits: ${a.balance ?? "?"}.`;
}
