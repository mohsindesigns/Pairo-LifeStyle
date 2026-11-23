import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let session = null;
const mailer = vi.hoisted(() => ({ sent: [], fail: false, delay: 0 }));
vi.mock("next-auth", () => ({ default: () => () => {}, getServerSession: () => Promise.resolve(session) }));
vi.mock("@/lib/email", async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    isSmtpConfigured: () => true,
    // the real builder is used, only the actual mail sending is replaced
    sendFeedbackRequestEmail: vi.fn(async (order, { to }) => {
      if (mailer.delay) await new Promise((r) => setTimeout(r, mailer.delay));
      if (mailer.fail) throw new Error("550 mailbox unavailable");
      mailer.sent.push({ to, order: order.orderNumber });
      return { messageId: `<fb-${mailer.sent.length}@example.invalid>`, subject: real.buildFeedbackEmail(order).subject };
    }),
  };
});

import Order from "@/models/Order";
import FeedbackEmailLog from "@/models/FeedbackEmailLog";
import { buildFeedbackEmail } from "@/lib/email";
import {
  getFeedbackAudience, sendFeedbackEmailToOrder, startFeedbackCampaign, getCampaignProgress, sendFeedbackTest,
} from "@/lib/feedbackEmailService";

const TAG = `fb${Date.now()}`;
const emailOf = (n) => `${TAG}-${n}@example.invalid`;
const oid = () => new mongoose.Types.ObjectId();
let seq = 0;
const makeOrder = async (email, extra = {}) => {
  const doc = {
    orderNumber: `T-${TAG}-${++seq}`, status: "Delivered", isDeleted: false, createdAt: new Date(Date.now() + seq * 1000),
    items: [{ productId: oid(), name: "Test Jacket", quantity: 1, priceAtPurchase: 100 }],
    shippingAddress: { fullName: "Dana <b>Smith</b>" }, customer: { email, isGuest: true }, ...extra,
  };
  const r = await Order.collection.insertOne(doc);
  return { ...doc, _id: r.insertedId };
};
const mine = (audience) => audience.pending.filter((p) => p.email.includes(TAG));
const call = (handler, init) => handler(new Request("http://localhost/api/admin/feedback-emails", init));
const post = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const superAdmin = { user: { id: String(oid()), isStaff: true, role: { slug: "super-admin" } } };

describe("feedback emails", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pairo");
  });
  afterAll(async () => {
    await Order.collection.deleteMany({ orderNumber: { $regex: `^T-${TAG}` } });
    await FeedbackEmailLog.deleteMany({ email: { $regex: TAG } });
    await mongoose.connection.close();
  });
  beforeEach(() => { mailer.sent.length = 0; mailer.fail = false; mailer.delay = 0; });

  describe("who is asked", () => {
    it("only delivered, live orders with a valid email; one entry per customer (newest order); already-emailed customers are skipped", async () => {
      await makeOrder(emailOf("a"));
      const newest = await makeOrder(emailOf("a").toUpperCase()); // same customer, other capitals, newer order
      await makeOrder(emailOf("shipped"), { status: "Shipped" });
      await makeOrder(emailOf("trashed"), { isDeleted: true });
      await makeOrder("not-an-email");
      await makeOrder(emailOf("done"), { feedbackEmail: { sentAt: new Date() } });
      await makeOrder(emailOf("done")); // a second order of someone who was already emailed
      const audience = await getFeedbackAudience();
      const list = mine(audience);
      expect(list.map((p) => p.email).sort()).toEqual([emailOf("a")]);
      expect(String(list[0].order._id)).toBe(String(newest._id));
      expect(audience.counts.pending).toBeGreaterThanOrEqual(1);
      expect(audience.counts.alreadyEmailed).toBeGreaterThanOrEqual(1);
      expect(audience.counts.deliveredCustomers).toBeGreaterThanOrEqual(audience.counts.pending + audience.counts.alreadyEmailed);
    });
  });

  describe("sending", () => {
    it("marks sentAt only after the mail was accepted, and logs it", async () => {
      const o = await makeOrder(emailOf("ok"));
      expect(await sendFeedbackEmailToOrder(o, { staffId: oid() })).toMatchObject({ sent: true });
      const saved = await Order.collection.findOne({ _id: o._id });
      expect(saved.feedbackEmail.sentAt).toBeTruthy();
      expect(saved.feedbackEmail.messageId).toMatch(/^<fb-/);
      expect(mailer.sent).toEqual([{ to: emailOf("ok"), order: o.orderNumber }]);
      expect(await FeedbackEmailLog.countDocuments({ orderId: o._id, status: "sent" })).toBe(1);
      expect(await sendFeedbackEmailToOrder(o)).toMatchObject({ sent: false, reason: "already-sent-or-claimed" });
      expect(mailer.sent).toHaveLength(1);
    });

    it("a failed send leaves the order unsent, records the error, and can be retried", async () => {
      const o = await makeOrder(emailOf("fail"));
      mailer.fail = true;
      expect(await sendFeedbackEmailToOrder(o)).toMatchObject({ sent: false, reason: "error" });
      let saved = await Order.collection.findOne({ _id: o._id });
      expect(saved.feedbackEmail.sentAt ?? null).toBeNull();
      expect(saved.feedbackEmail.lastError).toMatch(/550/);
      expect(saved.feedbackEmail.sendingSince ?? null).toBeNull();
      expect(await FeedbackEmailLog.countDocuments({ orderId: o._id, status: "failed" })).toBe(1);
      mailer.fail = false;
      expect(await sendFeedbackEmailToOrder(o)).toMatchObject({ sent: true });
      saved = await Order.collection.findOne({ _id: o._id });
      expect(saved.feedbackEmail.sentAt).toBeTruthy();
    });

    it("two simultaneous sends for the same order email the customer once", async () => {
      const o = await makeOrder(emailOf("race"));
      mailer.delay = 80;
      const results = await Promise.all([sendFeedbackEmailToOrder(o), sendFeedbackEmailToOrder(o)]);
      expect(results.filter((r) => r.sent)).toHaveLength(1);
      expect(mailer.sent.filter((m) => m.to === emailOf("race"))).toHaveLength(1);
    });

    it("the test email goes to the given address and marks nothing", async () => {
      const o = await makeOrder(emailOf("sample"));
      const before = await Order.countDocuments({ "feedbackEmail.sentAt": { $ne: null } });
      expect(await sendFeedbackTest(emailOf("me"))).toEqual({ sent: true });
      expect(mailer.sent.at(-1).to).toBe(emailOf("me"));
      expect(await Order.countDocuments({ "feedbackEmail.sentAt": { $ne: null } })).toBe(before);
      expect((await Order.collection.findOne({ _id: o._id })).feedbackEmail?.sentAt ?? null).toBeNull();
      expect(await FeedbackEmailLog.countDocuments({ email: emailOf("me"), status: "test" })).toBe(1);
      expect(await sendFeedbackTest("nope")).toMatchObject({ sent: false });
    });

    it("the campaign emails each pending customer once, in the background, with progress, and only one run at a time", async () => {
      const a = await makeOrder(emailOf("c1"));
      const b = await makeOrder(emailOf("c2"));
      mailer.delay = 20;
      const first = await startFeedbackCampaign({ staffId: oid(), pauseMs: 5 });
      expect(first.started).toBe(true);
      expect((await startFeedbackCampaign({ pauseMs: 5 })).started).toBe(false); // already running
      for (let i = 0; i < 200 && getCampaignProgress().running; i++) await new Promise((r) => setTimeout(r, 50));
      expect(getCampaignProgress().running).toBe(false);
      for (const o of [a, b]) expect(mailer.sent.filter((m) => m.order === o.orderNumber)).toHaveLength(1);
      expect(mine(await getFeedbackAudience())).toHaveLength(0);
    });
  });

  describe("email content", () => {
    const order = { orderNumber: "PAI-9<x>", shippingAddress: { fullName: "Dana <script>alert(1)</script>" }, items: [
      { productId: "p1", name: "Jacket <img src=x onerror=1>", quantity: 1 }, { name: "No product id" },
      { productId: "p2", name: "B" }, { productId: "p3", name: "C" }, { productId: "p4", name: "D" },
    ] };

    it("has the Trustpilot link, the video-review offer and product links (max 3, none without an id)", () => {
      const { html, subject } = buildFeedbackEmail(order);
      expect(html).toContain('href="https://www.trustpilot.com/review/pairolifestyle.com"');
      expect(html).toMatch(/video review/i);
      expect(html).toMatch(/10% off/i);
      expect(subject).toMatch(/10% off/);
      const links = [...html.matchAll(/href="[^"]*\/product\/([^"]+)"/g)].map((m) => m[1]);
      expect(links).toEqual(["p1", "p2", "p3"]);
    });

    it("escapes customer text", () => {
      const { html } = buildFeedbackEmail(order);
      expect(html).not.toContain("<script>alert(1)");
      expect(html).not.toContain("<img src=x");
      expect(html).not.toContain("PAI-9<x>");
      expect(html).toContain("Hi Dana");
    });
  });

  describe("API permissions", () => {
    it("needs a signed-in staff member; viewers can read but not send", async () => {
      const { GET, POST } = await import("@/app/api/admin/feedback-emails/route");
      session = null;
      expect((await call(GET)).status).toBe(401);
      expect((await call(POST, post({ action: "test", email: emailOf("x") }))).status).toBe(401);
      session = { user: { id: String(oid()), isStaff: true, role: { slug: "support", permissions: { orders: ["view"] } } } };
      expect((await call(GET)).status).toBe(200);
      expect((await call(POST, post({ action: "start" }))).status).toBe(403);
      expect((await call(POST, post({ action: "test", email: emailOf("x") }))).status).toBe(403);
      session = { user: { id: String(oid()), isStaff: true, role: { slug: "support", permissions: { products: ["view"] } } } };
      expect((await call(GET)).status).toBe(403);
    });

    it("an admin can send a test, and unknown actions are refused", async () => {
      const { GET, POST } = await import("@/app/api/admin/feedback-emails/route");
      session = superAdmin;
      const res = await call(POST, post({ action: "test", email: emailOf("admintest") }));
      expect(res.status).toBe(200);
      expect(mailer.sent.at(-1).to).toBe(emailOf("admintest"));
      expect((await call(POST, post({ action: "nope" }))).status).toBe(400);
      const body = await (await call(GET)).json();
      expect(body).toMatchObject({ success: true, smtpConfigured: true });
      expect(body.counts).toEqual(expect.objectContaining({ deliveredCustomers: expect.any(Number), pending: expect.any(Number) }));
    });
  });
});
