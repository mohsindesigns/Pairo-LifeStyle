// Server-only helpers for the homepage 3D rack: talking to the OFFCUT 3D service, a small queue that sends
// a few models at a time, copying finished models into our own storage (so the live rack never depends on
// the service), and building the rack data.
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import Product from "@/models/Product";
import Rack3dModel from "@/models/Rack3dModel";
import Rack3dConfig from "@/models/Rack3dConfig";
import { uploadToStorage, deleteFromStorage } from "@/lib/storage";

export class RackError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const serviceUrl = () => String(process.env.RACK3D_SERVICE_URL || "https://3d.mohsindesigns.com").replace(/\/$/, "");
export const keys = () => ({ tripo: !!process.env.TRIPO_API_KEY, token: !!process.env.RACK3D_SERVICE_TOKEN });
const MAX_RUNNING = Math.max(1, Number(process.env.RACK3D_MAX_RUNNING || 6)); // the service allows 10 per client
const ACTIVE = ["queued", "processing"];
const BUSY = ["waiting", ...ACTIVE];
const live = { isDeleted: { $ne: true } };

// auth: 'key' = as our Tripo API key (needed to make models from photos);
//       'token' = as our service token (enough for uploaded .glb models, no AI provider needed)
export async function svc(method, p, body, auth = "key") {
  const key = process.env.TRIPO_API_KEY;
  const token = process.env.RACK3D_SERVICE_TOKEN;
  if (auth === "key" && !key) throw new RackError(400, "Making models from photos needs a Tripo API key (TRIPO_API_KEY). You can still use Upload .glb.");
  if (auth === "token" && !token) throw new RackError(400, "The 3D service token (RACK3D_SERVICE_TOKEN) is not set on the server.");
  let r;
  try {
    r = await fetch(serviceUrl() + p, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(90000),
      headers: { "Content-Type": "application/json", ...(auth === "key" ? { "X-Tripo-Key": key } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch (e) {
    throw new RackError(424, `Can't reach the 3D service at ${serviceUrl()} (${e.cause?.code || e.message}).`);
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
  if (!process.env.TRIPO_API_KEY) throw new RackError(400, "Making models from photos needs a Tripo API key (TRIPO_API_KEY). You can still use Upload .glb.");
  const p = await findProduct(productId);
  const c = colourOf(p, color);
  const m = await Rack3dModel.findOne({ product: p._id, color: c.label });
  if (m && !m.isDeleted && BUSY.includes(m.status)) throw new RackError(409, `A model of “${p.name}” is already being made.`);
  const front = views.front || c.image;
  if (!front) throw new RackError(400, `“${p.name}” has no photo to make a model from.`);
  const doc = await Rack3dModel.findOneAndUpdate(
    { product: p._id, color: c.label },
    { $set: { status: "waiting", stage: "", progress: 0, error: "", jobId: "", jobAuth: "key", views: { front, back: views.back || "" }, quality: quality === "standard" ? "standard" : "detailed", addToRack: !!addToRack, isDeleted: false, deletedAt: null } },
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

// Send waiting models to the 3D service while fewer than MAX_RUNNING are being made
let pumping = false;
export async function pump() {
  if (pumping || !process.env.TRIPO_API_KEY) return;
  pumping = true;
  try {
    for (;;) {
      const running = await Rack3dModel.countDocuments({ ...live, status: { $in: ACTIVE }, jobId: { $ne: "" }, jobAuth: "key" });
      if (running >= MAX_RUNNING) break;
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
    { $set: { status: j.status, stage: j.stage || "", progress: j.progress || 0, error: "", jobId: j.id, jobAuth: "token", isDeleted: false, deletedAt: null } },
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
        const grab = async (fileUrl, name) => {
          const u = new URL(fileUrl, serviceUrl());
          const r = await fetch(serviceUrl() + u.pathname, { signal: AbortSignal.timeout(120000) });
          if (!r.ok) throw new Error(`download failed (${r.status})`);
          const saved = await uploadToStorage(Buffer.from(await r.arrayBuffer()), name, "pairo-3d");
          stored.push({ url: saved.url, publicId: saved.publicId || "" });
          return saved.url;
        };
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
  }, Number(process.env.RACK3D_POLL_MS || 8000));
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
    colors: two.map(({ c }) => ({ label: c.label, sw: c.hex || "#cccccc", img: c.image })),
  };
}

export async function getConfig() {
  return (await Rack3dConfig.findOne({ key: "main" }).lean()) || { items: [] };
}

// What the homepage rack shows (published products with a finished model, in rack order)
export async function rackItems({ includeDrafts = false } = {}) {
  const cfg = await getConfig();
  if (!cfg.items.length) return [];
  const ids = cfg.items.map((i) => i.product);
  const q = { _id: { $in: ids }, isDeleted: { $ne: true } };
  if (!includeDrafts) q.status = "Published";
  const [products, models] = await Promise.all([Product.find(q).lean(), Rack3dModel.find({ product: { $in: ids }, ...live }).lean()]);
  const out = [];
  for (const it of cfg.items) {
    const p = products.find((x) => String(x._id) === String(it.product));
    if (!p) continue;
    const r = rackModelFor(p, models.filter((m) => String(m.product) === String(p._id)));
    if (!r) continue;
    out.push(plain({
      _id: p._id, id: String(p._id), name: p.name, slug: p.slug, status: p.status, productType: p.productType,
      price: p.price, compareAtPrice: p.compareAtPrice, sku: p.sku, stock: p.stock, manageStock: p.manageStock,
      image: p.images?.[0] || p.image || "", images: p.images || [],
      attributes: p.attributes || [], variantCombinations: p.variantCombinations || [],
      sizes: sizesOf(p),
      rack3d: { ...r, scale: it.scale || 1 },
    }));
  }
  return out;
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
};

// Back-office view: one page of products (with photos, colours + model status), filters with counts, and the rack.
// Model progress is brought up to date in the background, so this never waits on the 3D service.
export async function adminView({ q = "", filter = "all", page = 1, per = 24 } = {}) {
  ensureTicker();
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
    serviceUrl: serviceUrl(), keys: keys(), rack, counts, filter: f, q: search, page: pg, pages, total, perPage,
    waiting: models.filter((m) => m.status === "waiting").length,
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
  try { health = await (await fetch(serviceUrl() + "/health", { signal: AbortSignal.timeout(10000) })).json(); } catch {
    throw new RackError(424, `Can't reach the 3D service at ${serviceUrl()}.`);
  }
  if (!process.env.TRIPO_API_KEY) {
    await svc("GET", "/v1/models?limit=1", null, "token");
    return `Connected to the 3D service (v${health.version}). No Tripo API key: you can upload .glb models; add TRIPO_API_KEY to make models from photos.`;
  }
  const a = await svc("GET", "/v1/account");
  return `Connected to the 3D service (v${health.version}). Tripo API credits: ${a.balance ?? "?"}.`;
}
