import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

dotenv.config({ path: ".env.local" });

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let session = null;
vi.mock("next-auth", () => ({ default: () => () => {}, getServerSession: () => Promise.resolve(session) }));
vi.mock("@/lib/audit", () => ({ logAction: vi.fn(async () => {}), redactSecrets: (v) => v }));
vi.mock("@/lib/email", async (importOriginal) => ({ ...(await importOriginal()), sendQuestionReplyEmail: vi.fn(async () => {}) }));
vi.mock("@/lib/stripe", () => ({ default: { paymentIntents: { create: vi.fn(), update: vi.fn() } } }));
vi.mock("@/services/shipping/ShippingService", () => ({ shippingService: { getRatesForAddress: vi.fn(async () => ({ shippingEnabled: true, rates: [] })) } }));

import Product from "@/models/Product";
import Review from "@/models/Review";
import Blog from "@/models/Blog";
import Category from "@/models/Category";
import SizeChart from "@/models/SizeChart";
import GalleryItem from "@/models/GalleryItem";
import ProductQuestion from "@/models/ProductQuestion";
import Redirect from "@/models/Redirect";
import { buildOrderListQuery } from "@/app/api/admin/orders/orderListQuery";
import InvoiceTemplate from "@/components/admin/InvoiceTemplate";

const TAG = `min${Date.now()}`;
const oid = () => new mongoose.Types.ObjectId();
const call = (handler, path, init, ctx) => handler(new Request(`http://localhost${path}`, init), ctx);
const ctxOf = (id) => ({ params: Promise.resolve({ id: String(id) }) });
const send = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const superAdmin = () => ({ user: { id: String(oid()), isStaff: true, role: { slug: "super-admin" } } });
const staffWith = (permissions) => ({ user: { id: String(oid()), isStaff: true, role: { slug: "custom", permissions } } });
const newProduct = (n, extra = {}) =>
  Product.create({ id: 4_000_000 + Math.floor(Math.random() * 900_000), name: `Minor ${n} ${TAG}`, slug: `minor-${n}-${TAG}`, price: 60, status: "Published", ...extra });

// Finds the first value stored under a key anywhere inside a nested query object.
const findKey = (node, key) => {
  if (node && typeof node === "object") {
    if (key in node) return node[key];
    for (const child of Object.values(node)) { const hit = findKey(child, key); if (hit !== undefined) return hit; }
  }
  return undefined;
};

describe("minor audit fixes", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pairo");
  });

  afterAll(async () => {
    await Review.deleteMany({ customerName: { $regex: TAG } });
    await ProductQuestion.deleteMany({ customerName: { $regex: TAG } });
    await Blog.deleteMany({ title: { $regex: TAG } });
    await Category.deleteMany({ slug: { $regex: TAG } });
    await SizeChart.deleteMany({ label: { $regex: TAG } });
    await GalleryItem.deleteMany({ title: { $regex: TAG } });
    await Redirect.deleteMany({ oldPath: { $regex: TAG } });
    await Product.deleteMany({ slug: { $regex: TAG } });
    await mongoose.connection.close();
  });

  // ── search boxes are matched literally ────────────────────────────────────────────────────────────
  it("the orders search matches the typed text literally and caps its length", () => {
    const rx = findKey(buildOrderListQuery({ search: "(a+)+$.*[x]" }), "$regex");
    expect(rx).toBe("\\(a\\+\\)\\+\\$\\.\\*\\[x\\]");
    expect(findKey(buildOrderListQuery({ search: "a".repeat(500) }), "$regex")).toBe("a".repeat(100));
    expect(findKey(buildOrderListQuery({ search: "   " }), "$regex")).toBeUndefined();
    expect(findKey(buildOrderListQuery({ search: "PAI-1001" }), "$regex")).toBe("PAI-1001");
  });

  // ── trash is explicit, so a stale click can never hard-delete ─────────────────────────────────────
  describe("Move to Trash never deletes", () => {
    it("reviews: mode=trash and mode=permanent are strict, the older toggle still works", async () => {
      const product = await newProduct("rev");
      const make = (n) => Review.create({ productId: product._id, orderId: oid(), rating: 4, customerName: `R${n} ${TAG}`, customerEmail: `r${n}-${TAG}@example.invalid`, status: "Approved" });
      const { DELETE } = await import("@/app/api/admin/reviews/[id]/route");
      session = superAdmin();
      const del = (id, mode) => call(DELETE, `/api/admin/reviews/${id}${mode ? `?mode=${mode}` : ""}`, { method: "DELETE" }, ctxOf(id));
      const exists = async (id) => !!(await Review.findById(id));

      const live = await make(1);
      expect((await del(live._id, "permanent")).status).toBe(409); // not in the Trash yet
      expect(await exists(live._id)).toBe(true);

      expect((await del(live._id, "trash")).status).toBe(200);
      expect((await Review.findById(live._id)).isDeleted).toBe(true);

      const again = await del(live._id, "trash"); // a stale second click
      expect(again.status).toBe(200);
      expect(await exists(live._id)).toBe(true); // still there: this used to delete it for good

      expect((await del(live._id, "permanent")).status).toBe(200);
      expect(await exists(live._id)).toBe(false);

      const legacy = await make(2); // callers that send no mode keep the old toggle
      await del(legacy._id);
      expect((await Review.findById(legacy._id)).isDeleted).toBe(true);
      await del(legacy._id);
      expect(await exists(legacy._id)).toBe(false);
    });

    it("blogs: mode=trash on a post that is already in the Trash leaves it there", async () => {
      const { DELETE } = await import("@/app/api/admin/blogs/route");
      session = superAdmin();
      const blog = await Blog.create({ title: `Post ${TAG}`, slug: `post-${TAG}`, status: "Published" });
      const del = (query) => call(DELETE, `/api/admin/blogs?id=${blog._id}${query}`, { method: "DELETE" });

      expect((await del("&mode=trash")).status).toBe(200);
      expect((await Blog.findById(blog._id)).isDeleted).toBe(true);
      expect((await del("&mode=trash")).status).toBe(200); // stale second click
      expect(await Blog.findById(blog._id)).toBeTruthy();
      expect((await del("&permanent=true")).status).toBe(200);
      expect(await Blog.findById(blog._id)).toBeNull();
    });
  });

  // ── questions whose product no longer exists ──────────────────────────────────────────────────────
  it("a question whose product was deleted permanently can still be restored, approved and answered", async () => {
    const { PUT } = await import("@/app/api/admin/products/questions/[id]/route");
    session = superAdmin();
    const question = await ProductQuestion.create({ productId: oid(), customerName: `Asker ${TAG}`, customerEmail: `ask-${TAG}@example.invalid`, question: "Orphan?", status: "Pending", isDeleted: true });
    const put = (body) => call(PUT, "/x", send("PUT", body), ctxOf(question._id));

    expect((await put({ action: "restore" })).status).toBe(200);
    expect((await ProductQuestion.findById(question._id)).isDeleted).toBe(false);
    expect((await put({ action: "toggle_status", status: "Approved" })).status).toBe(200);
    expect((await ProductQuestion.findById(question._id)).status).toBe("Approved");
    expect((await put({ action: "reply", replyText: "Thanks for asking" })).status).toBe(200);
    expect((await ProductQuestion.findById(question._id)).replies[0].answer).toBe("Thanks for asking");
  });

  // ── products ──────────────────────────────────────────────────────────────────────────────────────
  describe("product saves", () => {
    it("the per-product save cannot trash or restore a product", async () => {
      const { PUT } = await import("@/app/api/admin/products/[id]/route");
      session = staffWith({ products: ["view", "edit"] }); // no products.delete
      const product = await newProduct("trashflag");
      const res = await call(PUT, "/x", send("PUT", { name: `Renamed ${TAG}`, isDeleted: true, deletedAt: new Date(), statusBeforeTrash: "Published" }), ctxOf(product._id));
      expect(res.status).toBe(200);
      const after = await Product.findById(product._id).lean();
      expect(after.name).toBe(`Renamed ${TAG}`); // the ordinary edit went through
      expect(after.isDeleted).toBe(false); // the trash flag did not
      expect(after.deletedAt ?? null).toBeNull();
    });

    it("a partial save (Restore, status toggle, Quick Edit) leaves the size chart's assignment alone", async () => {
      const { PUT } = await import("@/app/api/admin/products/route");
      session = superAdmin();
      const product = await newProduct("chart");
      const chart = await SizeChart.create({ label: `Chart ${TAG}`, publicHeading: "Sizes", columns: ["Size"], rows: [["M"]], assignmentType: "product", assignmentTargetId: product._id });
      await Product.updateOne({ _id: product._id }, { $set: { sizeChart: chart._id, sizeChartSource: "custom" } });

      expect((await call(PUT, "/x", send("PUT", { id: String(product._id), status: "Draft" }))).status).toBe(200);
      let reloaded = await SizeChart.findById(chart._id).lean();
      expect(reloaded).toMatchObject({ assignmentType: "product" });
      expect(String(reloaded.assignmentTargetId)).toBe(String(product._id));

      // Explicitly clearing the chart still un-assigns it.
      expect((await call(PUT, "/x", send("PUT", { id: String(product._id), sizeChart: "", sizeChartSource: "none" }))).status).toBe(200);
      reloaded = await SizeChart.findById(chart._id).lean();
      expect(reloaded.assignmentType).toBe("none");
    });
  });

  // ── redirects ─────────────────────────────────────────────────────────────────────────────────────
  it("adding a redirect with a non-text source is a clear 400, not a crash", async () => {
    const { POST } = await import("@/app/api/admin/redirects/route");
    session = staffWith({ settings: ["view", "edit"] });
    for (const sourceUrl of [123, { a: 1 }, ["/x"], true]) {
      const res = await call(POST, "/x", send("POST", { sourceUrl, targetUrl: "/target" }));
      expect(res.status, JSON.stringify(sourceUrl)).toBe(400);
      expect((await res.json()).error).toMatch(/must be text/i);
    }
  });

  // ── categories ────────────────────────────────────────────────────────────────────────────────────
  it("renaming a category onto a URL held by a trashed category is refused, and registers no redirects", async () => {
    const { PUT } = await import("@/app/api/admin/categories/route");
    session = superAdmin();
    const held = await Category.create({ name: `Held ${TAG}`, slug: `held-${TAG}`, isDeleted: true, deletedAt: new Date() });
    const mine = await Category.create({ name: `Mine ${TAG}`, slug: `mine-${TAG}` });

    const res = await call(PUT, "/x", send("PUT", { id: String(mine._id), slug: held.slug }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/already uses this URL/i);
    expect((await Category.findById(mine._id)).slug).toBe(`mine-${TAG}`);
    expect(await Redirect.countDocuments({ oldPath: { $regex: `mine-${TAG}` } })).toBe(0);

    // An ordinary rename still works and registers its redirect after the save.
    const ok = await call(PUT, "/x", send("PUT", { id: String(mine._id), slug: `catnew-${TAG}` }));
    expect(ok.status, await ok.clone().text()).toBe(200);
    expect((await Category.findById(mine._id)).slug).toBe(`catnew-${TAG}`);
    expect(await Redirect.countDocuments({ oldPath: `/mine-${TAG}` })).toBe(1);
  });

  // ── draft products cannot be ordered ──────────────────────────────────────────────────────────────
  it("a Draft product in a stale cart cannot be bought by card", async () => {
    const { POST } = await import("@/app/api/checkout/create-payment-intent/route");
    const stripe = (await import("@/lib/stripe")).default;
    const draft = await newProduct("draft", { status: "Draft" });
    const res = await POST(new Request("http://localhost/x", send("POST", {
      idempotencyKey: `${TAG}-draft`, customerEmail: `${TAG}@example.invalid`,
      shippingAddress: { fullName: "A B", street: "1 St", city: "Austin", country: "United States", countryCode: "US" },
      financials: {}, items: [{ id: String(draft._id), name: draft.name, quantity: 1, price: 60 }],
    })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no longer available/i);
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  // ── public gallery ────────────────────────────────────────────────────────────────────────────────
  it("the public gallery does not reveal the name or URL of a trashed product", async () => {
    const { GET } = await import("@/app/api/gallery/items/route");
    const live = await newProduct("gal-live");
    const trashed = await newProduct("gal-trash", { isDeleted: true });
    await GalleryItem.create({ image: "/a.jpg", title: `Live ${TAG}`, enabled: true, linkedProduct: live._id });
    await GalleryItem.create({ image: "/b.jpg", title: `Trashed ${TAG}`, enabled: true, linkedProduct: trashed._id });
    const items = await (await GET()).json();
    const liveItem = items.find((i) => i.title === `Live ${TAG}`);
    const trashedItem = items.find((i) => i.title === `Trashed ${TAG}`);
    expect(liveItem.linkedProductSlug).toBe(live.slug);
    expect(trashedItem).toBeTruthy(); // the picture itself is still shown
    expect(trashedItem.linkedProductSlug).toBeNull();
    expect(trashedItem.linkedProductName).toBeNull();
  });

  // ── printed invoice ───────────────────────────────────────────────────────────────────────────────
  describe("printed invoice", () => {
    const render = (financials) => renderToStaticMarkup(React.createElement(InvoiceTemplate, {
      order: { orderNumber: "PAI-1", createdAt: new Date(), status: "Pending", items: [{ name: "Jacket", quantity: 1, priceAtPurchase: 100 }], customer: { email: "a@b.co" }, shippingAddress: {}, financials: { subtotal: 100, shippingCost: 5, total: 113.5, currency: "USD", ...financials } },
    }));

    it("shows the tax line when the order has tax, so the lines add up to the total", () => {
      const html = render({ tax: 8.5 });
      expect(html).toMatch(/>Tax</);
      expect(html).toContain("$8.50");
    });
    it("leaves the tax line out when there is none", () => {
      expect(render({ tax: 0 })).not.toMatch(/>Tax</);
      expect(render({})).not.toMatch(/>Tax</);
    });
  });
});
