import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// The signed-in staff member for the next request (null = signed out).
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 }); // the first test loads four whole route modules

let session = null;
const sent = [];

// The recovery-email settings normally live in the shared site-config document. Other test files (and a developer's
// local app) use that same document at the same time, so this file keeps them in memory instead: the validation is the
// real code, only the storage is swapped. (The real storage is covered in abandoned-cart-voucher.test.js.)
const store = vi.hoisted(() => ({ settings: null, lastRun: null }));
vi.mock("@/lib/abandonedCartSettings", async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    getAbandonedCartSettings: async () => real.normalizeAbandonedCartSettings(store.settings),
    saveAbandonedCartSettings: async (settings) => { store.settings = { ...settings }; return settings; },
    recordScanResult: async (result) => { store.lastRun = { at: new Date(), ...result }; },
    getLastScan: async () => store.lastRun,
  };
});

vi.mock("next-auth", () => ({
  default: () => () => {},
  getServerSession: () => Promise.resolve(session),
}));
vi.mock("@/lib/audit", () => ({ logAction: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/email", () => ({
  isSmtpConfigured: () => true,
  getFromAddress: () => '"PAIRO Lifestyle" <test@example.invalid>',
  sendAbandonedCartEmail: vi.fn(async (email, cart, code) => {
    sent.push({ email, code });
    return { messageId: "<admin-test@example.invalid>", subject: "You left something behind", accepted: [email], rejected: [], response: "250 OK" };
  }),
}));

import AbandonedCart from "@/models/AbandonedCart";
import AbandonedCartEmailLog from "@/models/AbandonedCartEmailLog";
import Discount from "@/models/Discount";
import { logAction } from "@/lib/audit";

const TAG = `adm${Date.now()}`;
const emailOf = (n) => `${TAG}-${n}@example.invalid`;
const staffId = new mongoose.Types.ObjectId().toString();
const superAdmin = { user: { id: staffId, isStaff: true, role: { slug: "super-admin" } } };
const viewOnly = { user: { id: staffId, isStaff: true, role: { slug: "support", permissions: { orders: ["view"] } } } };

const url = (path) => `http://localhost${path}`;
const call = (handler, path, init, ctx) => handler(new Request(url(path), init), ctx);
const json = (res) => res.json();
const put = (body) => ({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const makeCart = async (name, email, { idleMinutes = 5, extra = {} } = {}) => {
  const cart = await AbandonedCart.create({
    sessionKey: `${TAG}-${email}`,
    items: [{ name: "Test Jacket", price: 100, quantity: 2 }],
    cartSubtotal: 200,
    cartTotal: 200,
    contact: { email, firstName: name.split(" ")[0] },
    shippingAddress: { fullName: name },
    ...extra,
  });
  await AbandonedCart.collection.updateOne({ _id: cart._id }, { $set: { updatedAt: new Date(Date.now() - idleMinutes * 60 * 1000) } });
  return cart;
};

describe("admin API: abandoned-cart recovery emails", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pairo");
  });

  afterAll(async () => {
    const carts = await AbandonedCart.find({ sessionKey: { $regex: TAG } }).select("_id").lean();
    await AbandonedCartEmailLog.deleteMany({ $or: [{ email: { $regex: TAG } }, { cartId: { $in: carts.map((c) => c._id) } }] });
    await Discount.deleteMany({ specificCustomerEmails: { $regex: TAG } });
    await AbandonedCart.deleteMany({ sessionKey: { $regex: TAG } });
    await mongoose.connection.close();
  });

  it("every route needs a signed-in staff member", async () => {
    session = null;
    const list = await import("@/app/api/admin/abandoned-carts/emails/route");
    const settings = await import("@/app/api/admin/abandoned-carts/settings/route");
    const send = await import("@/app/api/admin/abandoned-carts/[id]/send/route");
    const scan = await import("@/app/api/admin/abandoned-carts/scan/route");
    const id = new mongoose.Types.ObjectId().toString();
    expect((await call(list.GET, "/api/admin/abandoned-carts/emails")).status).toBe(401);
    expect((await call(settings.GET, "/api/admin/abandoned-carts/settings")).status).toBe(401);
    expect((await call(settings.PUT, "/api/admin/abandoned-carts/settings", put({}))).status).toBe(401);
    expect((await call(send.POST, `/api/admin/abandoned-carts/${id}/send`, { method: "POST" }, { params: Promise.resolve({ id }) })).status).toBe(401);
    expect((await call(scan.POST, "/api/admin/abandoned-carts/scan", { method: "POST" })).status).toBe(401);
  });

  it("view-only staff can read the activity but cannot change settings, send, or scan", async () => {
    session = viewOnly;
    const list = await import("@/app/api/admin/abandoned-carts/emails/route");
    const settings = await import("@/app/api/admin/abandoned-carts/settings/route");
    const send = await import("@/app/api/admin/abandoned-carts/[id]/send/route");
    const scan = await import("@/app/api/admin/abandoned-carts/scan/route");
    const id = new mongoose.Types.ObjectId().toString();
    expect((await call(list.GET, `/api/admin/abandoned-carts/emails?search=${TAG}`)).status).toBe(200);
    expect((await call(settings.GET, "/api/admin/abandoned-carts/settings")).status).toBe(200);
    expect((await call(settings.PUT, "/api/admin/abandoned-carts/settings", put({ enabled: true, idleMinutes: 30, maxAgeHours: 72 }))).status).toBe(403);
    expect((await call(send.POST, `/api/admin/abandoned-carts/${id}/send`, { method: "POST" }, { params: Promise.resolve({ id }) })).status).toBe(403);
    expect((await call(scan.POST, "/api/admin/abandoned-carts/scan", { method: "POST" })).status).toBe(403);

    session = { user: { id: staffId, isStaff: true, role: { slug: "support", permissions: { products: ["view"] } } } };
    expect((await call(list.GET, "/api/admin/abandoned-carts/emails")).status).toBe(403);
  });

  it("lists the activity, adds emails sent before tracking existed exactly once, and reports status", async () => {
    session = superAdmin;
    vi.resetModules(); // the backfill runs once per server process: start this test like the first request after a deploy
    const legacyEmail = emailOf("legacy");
    const legacy = await makeCart("Lena Legacy", legacyEmail, { extra: { recoveryEmail: { sent: true, sentAt: new Date(Date.now() - 3 * 3600e3), voucherCode: "OLD15" } } });
    const waitingEmail = emailOf("waiting");
    await makeCart("Wendy Waiting", waitingEmail, { idleMinutes: 10 });
    await AbandonedCartEmailLog.create({ cartId: new mongoose.Types.ObjectId(), email: emailOf("tracked"), status: "sent", voucherCode: "TRACK15", voucherKind: "personal", cartTotal: 50, itemCount: 1 });

    let mod = await import("@/app/api/admin/abandoned-carts/emails/route");
    let res = await call(mod.GET, `/api/admin/abandoned-carts/emails?search=${TAG}&limit=100`);
    expect(res.status).toBe(200);
    let body = await json(res);
    expect(body.success).toBe(true);

    const legacyRow = body.items.find((r) => r.email === legacyEmail);
    expect(legacyRow).toMatchObject({ status: "sent", voucherCode: "OLD15", reason: "logged-before-activity-tracking", cartTotal: 200, itemCount: 2, firstName: "Lena" });
    expect(new Date(legacyRow.createdAt).getTime()).toBe(new Date(legacy.recoveryEmail.sentAt).getTime());
    expect(body.items.find((r) => r.email === emailOf("tracked"))).toMatchObject({ voucherCode: "TRACK15", voucherKind: "personal" });
    expect(body.pagination).toMatchObject({ total: body.items.length, currentPage: 1 });
    expect(body.counts.sent).toBeGreaterThanOrEqual(2);
    expect(body.counts.all).toBeGreaterThanOrEqual(body.counts.sent);
    expect(typeof body.sentLast24h).toBe("number");

    expect(body.mail).toMatchObject({ smtpConfigured: true });
    expect(body.mail.sender).toContain("test@example.invalid");
    expect(body.settings).toMatchObject({ enabled: expect.any(Boolean), idleMinutes: expect.any(Number), maxAgeHours: expect.any(Number) });
    expect(typeof body.scheduler.builtInScheduler).toBe("boolean");
    expect(body.diagnostics.carts).toMatchObject({ total: expect.any(Number), eligibleNow: expect.any(Number), gaveUp: expect.any(Number) });
    expect(body.waiting.find((w) => w.email === waitingEmail)).toMatchObject({ idleMinutes: expect.any(Number), cartTotal: 200, itemCount: 2 });

    // A fresh server process must not add the same legacy email twice.
    vi.resetModules();
    mod = await import("@/app/api/admin/abandoned-carts/emails/route");
    res = await call(mod.GET, `/api/admin/abandoned-carts/emails?search=${TAG}&limit=100`);
    body = await json(res);
    expect(body.items.filter((r) => r.email === legacyEmail)).toHaveLength(1);
    expect(await AbandonedCartEmailLog.countDocuments({ cartId: legacy._id })).toBe(1);
  });

  it("filters by result and searches by email, code or error, newest first and paged", async () => {
    session = superAdmin;
    const now = Date.now();
    const rows = [
      { email: emailOf("f1"), status: "failed", reason: "send-error", error: "550 mailbox full", createdAt: new Date(now - 1000) },
      { email: emailOf("g1"), status: "gave-up", reason: "send-error", error: "550 gone", createdAt: new Date(now - 2000) },
      { email: emailOf("s1"), status: "skipped", reason: "order-exists", createdAt: new Date(now - 3000) },
      { email: emailOf("ok1"), status: "sent", voucherCode: `${TAG}CODE`.toUpperCase(), createdAt: new Date(now - 4000) },
    ].map((r) => ({ cartId: new mongoose.Types.ObjectId(), ...r }));
    await AbandonedCartEmailLog.insertMany(rows);

    const { GET } = await import("@/app/api/admin/abandoned-carts/emails/route");
    const get = async (qs) => json(await call(GET, `/api/admin/abandoned-carts/emails?${qs}`));

    const failed = await get(`status=failed&search=${TAG}`);
    expect(failed.items.map((r) => r.email)).toEqual([emailOf("f1")]);
    expect((await get(`status=gave-up&search=${TAG}`)).items.map((r) => r.status)).toEqual(["gave-up"]);
    expect((await get(`status=skipped&search=${TAG}`)).items.map((r) => r.reason)).toEqual(["order-exists"]);

    expect((await get(`search=${TAG}CODE`)).items.map((r) => r.email)).toEqual([emailOf("ok1")]); // by voucher code (case-insensitive)
    expect((await get(`search=${encodeURIComponent("mailbox full")}`)).items.map((r) => r.email)).toContain(emailOf("f1")); // by error text

    // Newest first, and the paging counts add up.
    const page1 = await get(`status=all&search=${TAG}-&limit=2&page=1`);
    expect(page1.items).toHaveLength(2);
    expect(page1.pagination.pages).toBeGreaterThanOrEqual(2);
    const created = page1.items.map((r) => new Date(r.createdAt).getTime());
    expect(created[0]).toBeGreaterThanOrEqual(created[1]);

    // Regex characters in the search box are searched for literally, never interpreted.
    const odd = await get(`search=${encodeURIComponent(".*")}`);
    expect(odd.items.every((r) => [r.email, r.voucherCode, r.firstName, r.error, r.messageId].some((v) => String(v || "").includes(".*")))).toBe(true);
  });

  it("exports the matching activity as a spreadsheet-safe CSV", async () => {
    session = superAdmin;
    await AbandonedCartEmailLog.create({
      cartId: new mongoose.Types.ObjectId(), email: emailOf("csv"), firstName: "Cy, \"CSV\"", status: "failed",
      reason: "send-error", error: '=HYPERLINK("http://evil.invalid","click")', attempt: 2, cartTotal: 75.5, itemNames: ["Jacket", "Hat"],
    });
    const { GET } = await import("@/app/api/admin/abandoned-carts/emails/route");
    const res = await call(GET, `/api/admin/abandoned-carts/emails?format=csv&search=${TAG}-csv`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="abandoned-cart-emails-\d{4}-\d{2}-\d{2}\.csv"/);

    const text = await res.text();
    const [head, ...lines] = text.replace(/^﻿/, "").split("\r\n");
    expect(head).toBe("Date (UTC),Email,Name,Status,Reason,Trigger,Attempt,Voucher,Voucher type,Discount,Cart total,Items,Subject,Message ID,Mail server response,Error");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(emailOf("csv"));
    expect(lines[0]).toContain('"Cy, ""CSV"""'); // RFC 4180 quoting
    expect(lines[0]).toContain("Jacket | Hat");
    expect(lines[0]).toContain("75.5");
    expect(lines[0]).toContain("'=HYPERLINK("); // a spreadsheet must never run the cell as a formula
    expect(lines[0]).not.toMatch(/(^|,)"?=HYPERLINK/);
  });

  it("validates and saves the settings", async () => {
    session = superAdmin;
    const { GET, PUT } = await import("@/app/api/admin/abandoned-carts/settings/route");
    const path = "/api/admin/abandoned-carts/settings";

    for (const bad of [
      { enabled: true, idleMinutes: 2, maxAgeHours: 72 },
      { enabled: true, idleMinutes: 30.5, maxAgeHours: 72 },
      { enabled: true, idleMinutes: 30, maxAgeHours: 0 },
      { enabled: "yes", idleMinutes: 30, maxAgeHours: 72 },
      { enabled: true, idleMinutes: 600, maxAgeHours: 10 }, // max age must be longer than the idle time
      {},
    ]) {
      const res = await call(PUT, path, put(bad));
      expect(res.status, JSON.stringify(bad)).toBe(400);
      expect((await json(res)).error).toBeTruthy();
    }

    logAction.mockClear();
    const ok = await call(PUT, path, put({ enabled: false, idleMinutes: 45, maxAgeHours: 48 }));
    expect(ok.status).toBe(200);
    expect(await json(ok)).toMatchObject({ success: true, settings: { enabled: false, idleMinutes: 45, maxAgeHours: 48 } });
    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction.mock.calls[0][2]).toBe("UPDATE_ABANDONED_CART_SETTINGS");

    expect(await json(await call(GET, path))).toMatchObject({ settings: { enabled: false, idleMinutes: 45, maxAgeHours: 48 } });
  });

  it("Check now respects the on/off switch", async () => {
    session = superAdmin;
    const { PUT } = await import("@/app/api/admin/abandoned-carts/settings/route");
    const { POST } = await import("@/app/api/admin/abandoned-carts/scan/route");
    await call(PUT, "/api/admin/abandoned-carts/settings", put({ enabled: false, idleMinutes: 30, maxAgeHours: 72 }));
    sent.length = 0;
    const res = await call(POST, "/api/admin/abandoned-carts/scan", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ success: true, scanned: 0, sent: 0, disabled: true });
    expect(sent).toHaveLength(0);
  });

  it("Send now emails one cart, logs who pressed the button, and explains refusals", async () => {
    session = superAdmin;
    const { POST } = await import("@/app/api/admin/abandoned-carts/[id]/send/route");
    const send = (id) => call(POST, `/api/admin/abandoned-carts/${id}/send`, { method: "POST" }, { params: Promise.resolve({ id }) });

    expect((await send("not-an-id")).status).toBe(404);
    expect((await send(new mongoose.Types.ObjectId().toString())).status).toBe(404);

    const email = emailOf("now");
    const cart = await makeCart("Nina Now", email, { idleMinutes: 2 });
    sent.length = 0;
    const res = await send(cart._id.toString());
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toMatchObject({ success: true, result: { sent: true, status: "sent" } });
    expect(sent).toHaveLength(1);
    expect(sent[0].email).toBe(email);

    const log = await AbandonedCartEmailLog.findOne({ cartId: cart._id }).lean();
    expect(log).toMatchObject({ status: "sent", trigger: "manual", voucherCode: body.result.voucherCode });
    expect(String(log.triggeredBy)).toBe(staffId);

    // A failing mail server is reported with its message, as a gateway error.
    const { sendAbandonedCartEmail } = await import("@/lib/email");
    sendAbandonedCartEmail.mockImplementationOnce(async () => { throw new Error("535 authentication failed"); });
    const failed = await send(cart._id.toString());
    expect(failed.status).toBe(502);
    expect((await json(failed)).error).toContain("535 authentication failed");

    // Someone who already ordered is never emailed.
    await AbandonedCart.collection.updateOne({ _id: cart._id }, { $set: { status: "recovered" } });
    const recovered = await send(cart._id.toString());
    expect(recovered.status).toBe(409);
    expect((await json(recovered)).error).toMatch(/already placed an order/i);
  });
});
