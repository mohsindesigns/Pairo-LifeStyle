// Server-only helpers for the homepage 3D rack: talking to the OFFCUT 3D service, copying finished models
// into our own storage (so the live rack never depends on the service), and building the rack data.
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

async function startJob(productId, color, body, auth) {
  const p = await findProduct(productId);
  const c = colorsOf(p).find((x) => x.label === String(color ?? ""));
  if (!c) throw new RackError(400, "That colour is not one of this product's colours.");
  const m = await Rack3dModel.findOne({ product: p._id, color: c.label });
  if (m && ["queued", "processing"].includes(m.status) && m.jobId) throw new RackError(409, "A model for this colour is already being made.");
  const j = await svc("POST", "/v1/models", { ...body(p, c), external_id: `pairo-${p._id}-${slug(c.label)}` }, auth);
  return Rack3dModel.findOneAndUpdate(
    { product: p._id, color: c.label },
    { $set: { status: j.status, stage: j.stage || "", progress: j.progress || 0, error: "", jobId: j.id, jobAuth: auth } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

// Make a model from photos (front + optional left/back/right) with our Tripo key
export function makeFromPhotos({ productId, color, views = {}, quality }) {
  return startJob(productId, color, (p, c) => {
    const images = {};
    for (const k of ["front", "left", "back", "right"]) { const s = forService(views[k]); if (s) images[k] = s; }
    if (!images.front) images.front = forService(c.image);
    if (!images.front) throw new RackError(400, "Add a front photo.");
    return { images, name: `${p.name}${c.label ? " — " + c.label : ""}`, quality: quality === "standard" ? "standard" : "detailed" };
  }, "key");
}

// Optimise a model the store already has (e.g. made on the Tripo website) — no API credits
export function importGlb({ productId, color, glb }) {
  if (typeof glb !== "string" || !glb.startsWith("data:")) throw new RackError(400, "Choose a .glb file.");
  return startJob(productId, color, (p, c) => ({ glb, name: `${p.name}${c.label ? " — " + c.label : ""} (upload)` }), "token");
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
  if (m.status !== "failed" || !m.jobId) throw new RackError(409, "Only failed models can be retried.");
  const j = await svc("POST", `/v1/models/${m.jobId}/retry`, null, m.jobAuth || "key");
  m.set({ status: j.status, stage: j.stage || "", progress: 0, error: "" });
  await m.save();
  return m.toObject();
}

async function dropFiles(files) {
  for (const f of files || []) { if (f.publicId) await deleteFromStorage(f.publicId).catch(() => {}); }
}

export async function deleteModel(id) {
  const m = await modelDoc(id);
  await dropFiles(m.files);
  await Rack3dModel.deleteOne({ _id: m._id });
  // a product without a usable model can't stay on the rack
  const still = await Rack3dModel.exists({ product: m.product, rackUrl: { $ne: "" } });
  if (!still) await Rack3dConfig.updateOne({ key: "main" }, { $pull: { items: { product: m.product } } });
}

// Bring models that are being made up to date; copy finished files into our storage
export async function refreshModels() {
  const busy = await Rack3dModel.find({ status: { $in: ["queued", "processing"] }, jobId: { $ne: "" } });
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
      m.set({ status: "ready", stage: "", progress: 100, error: "", rackUrl, detailUrl, previewUrl, files: stored, meta: j.meta || {} });
      await m.save();
      await dropFiles(old);
    } catch (e) {
      m.set({ status: "failed", error: `Made, but couldn't save it: ${e.message}` });
      await m.save();
    }
  }
}

// ---------- the rack ----------
const plain = (x) => JSON.parse(JSON.stringify(x));

// rack3d data for one product: one rack model per hanger, up to two colourways close up
function rackModelFor(p, models) {
  const ready = colorsOf(p).map((c) => ({ c, m: models.find((m) => m.color === c.label && m.detailUrl) })).filter((x) => x.m);
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
  const [products, models] = await Promise.all([Product.find(q).lean(), Rack3dModel.find({ product: { $in: ids } }).lean()]);
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
  const seen = new Set(), clean = [];
  for (const it of items) {
    const p = await findProduct(it.id || it.product);
    const id = String(p._id);
    if (seen.has(id)) throw new RackError(400, "A product is on the rack twice.");
    seen.add(id);
    const models = await Rack3dModel.find({ product: p._id }).lean();
    if (!rackModelFor(p, models)) throw new RackError(400, `“${p.name}” has no finished 3D model yet.`);
    clean.push({ product: p._id, scale: Math.max(0.5, Math.min(2, Number(it.scale) || 1)) });
  }
  await Rack3dConfig.findOneAndUpdate({ key: "main" }, { $set: { items: clean } }, { upsert: true });
  return clean.length;
}

// Back-office view: products with their colours + model status, and the rack
export async function adminView() {
  await refreshModels().catch((e) => console.error("[rack3d] refresh", e.message));
  const [products, models, cfg] = await Promise.all([
    Product.find({ isDeleted: { $ne: true } }).select("name slug status images image attributes").sort({ updatedAt: -1 }).lean(),
    Rack3dModel.find({}).lean(),
    getConfig(),
  ]);
  const byProduct = (id) => models.filter((m) => String(m.product) === String(id));
  const modelOut = (m) => m && {
    id: String(m._id), color: m.color, status: m.status, stage: m.stage, progress: m.progress, error: m.error,
    hasFiles: !!m.detailUrl, rackUrl: m.rackUrl, detailUrl: m.detailUrl, previewUrl: m.previewUrl, auth: m.jobAuth, meta: m.meta || {}, updatedAt: m.updatedAt,
  };
  const rack = [];
  for (const it of cfg.items) {
    const p = products.find((x) => String(x._id) === String(it.product));
    if (!p) continue;
    const r = rackModelFor(p, byProduct(p._id));
    rack.push({ id: String(p._id), name: p.name, status: p.status, scale: it.scale || 1, image: r ? r.colors[0].img : p.images?.[0] || "", ok: !!r });
  }
  return plain({
    serviceUrl: serviceUrl(),
    keys: keys(),
    rack,
    products: products.map((p) => ({
      id: String(p._id), name: p.name, slug: p.slug, status: p.status, images: p.images || [],
      onRack: rack.some((x) => x.id === String(p._id)),
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
