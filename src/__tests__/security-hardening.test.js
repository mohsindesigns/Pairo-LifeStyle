import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Several tests load whole route modules for the first time, which is slow when the machine is busy.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

// The signed-in user for the next request (null = signed out). Shaped exactly like what next-auth hands to the routes.
let session = null;
vi.mock("next-auth", () => ({ default: () => () => {}, getServerSession: () => Promise.resolve(session) }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: async () => ({ success: true }), getClientIp: () => "203.0.113.7" }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstileToken: async () => ({ success: true }) }));
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal()),
  sendQuestionConfirmationEmail: vi.fn(async () => {}),
  sendAdminQuestionNotification: vi.fn(async () => {}),
}));
// Cancelling an order dispatches an event that emails the customer: nothing is sent from a test.
vi.mock("@/lib/events", () => ({ default: { dispatch: vi.fn() } }));

import Order from "@/models/Order";
import Product from "@/models/Product";
import Review from "@/models/Review";
import ProductQuestion from "@/models/ProductQuestion";
import Customer from "@/models/Customer";
import Affiliate from "@/models/Affiliate";
import AuditLog from "@/models/AuditLog";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redactSecrets, logAction, REDACTED } from "@/lib/audit";
import { staffRestoreError } from "@/app/api/admin/staff/helpers";
import { toPublicReview, toPublicQuestion, viewerOwnsReview } from "@/lib/publicReviewData";

const TAG = `sec${Date.now()}`;
const oid = () => new mongoose.Types.ObjectId();
const call = (handler, path, init, ctx) => handler(new Request(`http://localhost${path}`, init), ctx);
const ctxOf = (id) => ({ params: Promise.resolve({ id: String(id) }) });
const post = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const GHOST = { user: { name: "Ghost", email: "ghost@example.invalid" } }; // what next-auth used to return for a revoked login
const superAdmin = () => ({ user: { id: String(oid()), isStaff: true, role: { slug: "super-admin" } } });
const staffWith = (permissions) => ({ user: { id: String(oid()), isStaff: true, role: { slug: "custom", permissions } } });

const orderDoc = (n, extra = {}) => ({
  orderNumber: `T-${TAG}-${n}`, status: "Pending", isDeleted: false, createdAt: new Date(), items: [],
  financials: { subtotal: 100, total: 100 }, shippingAddress: { fullName: "Some Customer", street: "1 Street", city: "Austin", country: "US", phone: "+1 555 0100" },
  customer: { userId: null, email: `${TAG}-${n}@example.invalid`, isGuest: true }, ...extra,
});

describe("security hardening", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pairo");
    vi.stubEnv("CRM_API_KEY", "test-crm-key");
  });

  afterAll(async () => {
    await Order.collection.deleteMany({ orderNumber: { $regex: `^T-${TAG}` } });
    await Review.deleteMany({ customerName: { $regex: TAG } });
    await ProductQuestion.deleteMany({ customerName: { $regex: TAG } });
    await Product.deleteMany({ slug: { $regex: TAG } });
    await Customer.deleteMany({ email: { $regex: TAG } });
    await Affiliate.deleteMany({ email: { $regex: TAG } });
    await AuditLog.collection.deleteMany({ "details.message": { $regex: TAG } });
    vi.unstubAllEnvs();
    await mongoose.connection.close();
  });

  // ── sessions that were signed out must stay signed out ───────────────────────────────────────────
  describe("revoked (ghost) sessions", () => {
    const userSession = { user: { name: "A", email: "a@example.invalid" }, expires: "later" };

    it("the session callback returns an empty session when the token was cleared", async () => {
      const make = authOptions.callbacks.session;
      expect(await make({ session: structuredClone(userSession), token: {} })).toEqual({});
      expect(await make({ session: structuredClone(userSession), token: undefined })).toEqual({});
      expect(await make({ session: structuredClone(userSession), token: { id: "" } })).toEqual({});
    });

    it("the session callback still builds a normal session for a real login", async () => {
      const result = await authOptions.callbacks.session({ session: structuredClone(userSession), token: { id: "abc123", isStaff: true, role: { slug: "support" } } });
      expect(result.user).toMatchObject({ id: "abc123", isStaff: true, isAffiliate: false, role: { slug: "support" } });
      const customer = await authOptions.callbacks.session({ session: structuredClone(userSession), token: { id: "cust1", isStaff: false, isAffiliate: false } });
      expect(customer.user).toMatchObject({ id: "cust1", isStaff: false });
      expect(customer.user.role).toBeUndefined();
    });

    it("an expired staff session is still cleared by the jwt callback", async () => {
      const cleared = await authOptions.callbacks.jwt({ token: { id: "s1", isStaff: true, staffExpiresAt: Date.now() - 1000 } });
      expect(cleared).toEqual({});
    });

    it("a ghost session cannot list, read or cancel anyone's orders (these used to match every guest order)", async () => {
      const guest = await Order.collection.insertOne(orderDoc("ghost"));
      session = GHOST;
      const list = await import("@/app/api/profile/orders/route");
      const one = await import("@/app/api/profile/orders/[id]/route");
      const cancel = await import("@/app/api/profile/orders/[id]/cancel/route");
      expect((await call(list.GET, "/api/profile/orders")).status).toBe(401);
      expect((await call(one.GET, `/api/profile/orders/${guest.insertedId}`, undefined, ctxOf(guest.insertedId))).status).toBe(401);
      expect((await call(cancel.PATCH, `/api/profile/orders/${guest.insertedId}/cancel`, { method: "PATCH" }, ctxOf(guest.insertedId))).status).toBe(401);
      expect((await Order.collection.findOne({ _id: guest.insertedId })).status).toBe("Pending"); // not cancelled
    });

    it("a ghost session gets nothing from the profile API either", async () => {
      session = GHOST;
      const profile = await import("@/app/api/user/profile/route");
      expect((await call(profile.GET, "/api/user/profile")).status).toBe(401);
      expect((await call(profile.POST, "/api/user/profile", post({ action: "updateInfo", data: { name: "x" } }))).status).toBe(401);
    });

    it("a real customer sees only their own orders, never guest orders", async () => {
      const customerId = oid();
      const mine = await Order.collection.insertOne(orderDoc("mine", { customer: { userId: customerId, email: `${TAG}-mine@example.invalid`, isGuest: false } }));
      await Order.collection.insertOne(orderDoc("someoneelse"));
      session = { user: { id: String(customerId), email: `${TAG}-mine@example.invalid`, isStaff: false } };
      const list = await import("@/app/api/profile/orders/route");
      const body = await (await call(list.GET, "/api/profile/orders")).json();
      expect(body.orders.map((o) => String(o._id))).toEqual([String(mine.insertedId)]);
      const one = await import("@/app/api/profile/orders/[id]/route");
      const other = await Order.collection.findOne({ orderNumber: `T-${TAG}-someoneelse` });
      expect((await call(one.GET, "/x", undefined, ctxOf(other._id))).status).toBe(404);
    });

    it("a ghost session does not own a guest-written review", async () => {
      session = GHOST;
      const { PUT } = await import("@/app/api/products/[id]/reviews/route");
      const res = await call(PUT, "/api/products/x/reviews", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewId: String(oid()), rating: 5 }) }, ctxOf(oid()));
      expect(res.status).toBe(401);
    });
  });

  // ── the public order lookup ──────────────────────────────────────────────────────────────────────
  describe("public order tracking", () => {
    let tracked;
    let GET;

    beforeAll(async () => {
      ({ GET } = await import("@/app/api/order-tracking/[id]/route"));
      tracked = await Order.collection.insertOne(orderDoc("track", {
        payment: { method: "Card", status: "Paid", stripePaymentIntentId: "pi_secret_123", stripeChargeId: "ch_secret_456", receiptUrl: "https://receipt.example.invalid/r", provider: "stripe" },
        financials: { subtotal: 90, shippingCost: 10, tax: 0, discountTotal: 0, total: 100, currency: "USD", promoCode: "SAVE", appliedPromotions: [{ code: "SAVE", rulesSnapshot: { internal: true } }] },
        timeline: [
          { status: "Pending", message: "Order placed successfully.", source: "System", timestamp: new Date() },
          { status: "Pending", message: "Invoice sent to buyer@example.invalid by Jane (staff)", source: "Admin", timestamp: new Date() },
        ],
      }));
    });

    it("refuses to look an order up by its sequential order number", async () => {
      for (const key of [`T-${TAG}-track`, "PAI-1001", "1001", "../x"]) {
        const res = await call(GET, `/api/order-tracking/${encodeURIComponent(key)}`, undefined, ctxOf(key));
        expect(res.status, key).toBe(404);
      }
    });

    it("shows the buyer their order by its own id, without payment-provider ids or staff-only notes", async () => {
      const res = await call(GET, "/x", undefined, ctxOf(tracked.insertedId));
      expect(res.status).toBe(200);
      const { order } = await res.json();
      expect(order.orderNumber).toBe(`T-${TAG}-track`);
      expect(order.shippingAddress).toMatchObject({ fullName: "Some Customer", phone: "+1 555 0100" });
      expect(order.payment).toMatchObject({ method: "Card", status: "Paid", receiptUrl: "https://receipt.example.invalid/r" });
      const text = JSON.stringify(order);
      expect(text).not.toMatch(/pi_secret_123|ch_secret_456|stripe|rulesSnapshot|appliedPromotions|buyer@example/);
      expect(order.timeline.map((t) => t.source)).toEqual(["System"]);
      expect(order.financials).toMatchObject({ subtotal: 90, shippingCost: 10, total: 100, promoCode: "SAVE" });
    });

    it("does not show an order that was moved to the Trash", async () => {
      await Order.collection.updateOne({ _id: tracked.insertedId }, { $set: { isDeleted: true } });
      expect((await call(GET, "/x", undefined, ctxOf(tracked.insertedId))).status).toBe(404);
      await Order.collection.updateOne({ _id: tracked.insertedId }, { $set: { isDeleted: false } });
    });
  });

  // ── what the audit log may hold ──────────────────────────────────────────────────────────────────
  describe("audit log secrets", () => {
    it("redactSecrets hides passwords and tokens at any depth and keeps everything else", () => {
      const id = oid();
      const when = new Date("2026-01-02T03:04:05Z");
      const out = redactSecrets({
        before: { _id: id, name: "Jane", password: "$2a$10$abcdefghijklmnopqrstuv", security: { passwordChangedAt: when }, resetPasswordToken: "tok", list: [{ apiKey: "k", ok: 1 }] },
        newPassword: "hunter2", empty: { password: "" }, nothing: { password: null },
      });
      expect(out.before.password).toBe(REDACTED);
      expect(out.before.resetPasswordToken).toBe(REDACTED);
      expect(out.before.list[0]).toEqual({ apiKey: REDACTED, ok: 1 });
      expect(out.newPassword).toBe(REDACTED);
      expect(out.before.name).toBe("Jane");
      expect(out.before._id).toBe(id); // ObjectId kept as an ObjectId
      expect(out.before.security.passwordChangedAt).toBe(when); // a timestamp is not a secret
      expect(out.empty.password).toBe(""); // nothing to hide
      expect(out.nothing.password).toBeNull();
    });

    it("converts Mongoose documents and never mutates its input", () => {
      const input = { after: { password: "hash", name: "x" } };
      const copy = redactSecrets(input);
      expect(input.after.password).toBe("hash");
      expect(copy.after.password).toBe(REDACTED);
    });

    it("logAction stores a redacted entry", async () => {
      const message = `${TAG} write`;
      await logAction(new Request("http://localhost/x", { headers: { "user-agent": "test" } }), { user: { id: String(oid()) } }, "UPDATE_STAFF", "staff", {
        before: { password: "$2a$10$oldhasholdhasholdhash", name: "A" }, after: { password: "$2a$10$newhashnewhashnewhash", name: "B" }, message,
      });
      const saved = await AuditLog.collection.findOne({ "details.message": message });
      expect(saved.details.before).toEqual({ password: REDACTED, name: "A" });
      expect(saved.details.after).toEqual({ password: REDACTED, name: "B" });
    });

    it("the audit-log API cleans entries that were stored before this fix", async () => {
      const message = `${TAG} legacy`;
      await AuditLog.collection.insertOne({
        staffId: oid(), action: "UPDATE_STAFF", resource: "staff", timestamp: new Date(), ip: "x", userAgent: "x",
        details: { before: { password: "$2a$10$legacyhashlegacyhash" }, after: { password: "$2a$10$legacyhashlegacyhash2" }, message },
      });
      session = superAdmin();
      const { GET } = await import("@/app/api/admin/audit-logs/route");
      const body = await (await call(GET, "/api/admin/audit-logs?page=1&limit=100&q=")).json();
      const row = body.logs.find((l) => l.details?.message === message);
      expect(row).toBeTruthy();
      expect(JSON.stringify(row)).not.toMatch(/legacyhash/);
      expect(row.details.before.password).toBe(REDACTED);
    });
  });

  // ── staff ────────────────────────────────────────────────────────────────────────────────────────
  describe("restoring staff from the Trash", () => {
    const superAdminTarget = { _id: "1", roleId: { slug: "super-admin" } };
    it("only a Super Admin may restore a Super Admin", () => {
      expect(staffRestoreError({ actorRoleSlug: "admin", target: superAdminTarget })).toMatch(/Only a Super Admin/);
      expect(staffRestoreError({ actorRoleSlug: null, target: superAdminTarget })).toMatch(/Only a Super Admin/);
      expect(staffRestoreError({ actorRoleSlug: "super-admin", target: superAdminTarget })).toBeNull();
    });
    it("anyone allowed to restore users may restore an ordinary user", () => {
      expect(staffRestoreError({ actorRoleSlug: "admin", target: { _id: "2", roleId: { slug: "editor" } } })).toBeNull();
      expect(staffRestoreError({ actorRoleSlug: "admin", target: null })).toMatch(/not found/);
    });
  });

  // ── permissions that could never be granted ──────────────────────────────────────────────────────
  describe("permissions a role can really hold", () => {
    it("an Order Manager (orders: view + update) may change an order's status; a viewer may not", async () => {
      const { PATCH } = await import("@/app/api/admin/orders/[id]/route");
      const patch = (id) => call(PATCH, "/x", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Confirmed" }) }, ctxOf(id));
      session = staffWith({ orders: ["view", "update"] });
      expect((await patch(oid())).status).toBe(404); // got past the permission check: only the (made-up) order is missing
      session = staffWith({ orders: ["view"] });
      expect((await patch(oid())).status).toBe(403);
    });

    it("media.manage (the only media permission that exists) opens the media library", async () => {
      const { GET } = await import("@/app/api/admin/media/route");
      session = staffWith({ media: ["manage"] });
      expect((await call(GET, "/api/admin/media?counts=true")).status).toBe(200);
      session = staffWith({ products: ["view"] });
      expect((await call(GET, "/api/admin/media?counts=true")).status).toBe(403);
    });
  });

  // ── credentials in admin responses ───────────────────────────────────────────────────────────────
  describe("no credentials in admin responses", () => {
    it("the affiliate list never contains password hashes or reset tokens, and bank details only for managers", async () => {
      const email = `${TAG}-aff@example.invalid`;
      await Affiliate.create({
        name: "Aff Test", email, password: "$2a$10$affiliatehashaffiliatehash", affiliateId: `AFF-${TAG}`, referralCode: `REF${TAG}`.toUpperCase(),
        resetPasswordToken: "reset-token-value", resetPasswordExpires: new Date(Date.now() + 3600e3),
        bankingInfo: { accountHolder: "Aff Test", bankName: "Test Bank", accountNumber: "123456789012", iban: "GB82WEST12345698765432" },
      });
      const { GET } = await import("@/app/api/admin/affiliates/list/route");
      const find = async (s) => { session = s; const body = await (await call(GET, "/api/admin/affiliates/list")).json(); return body.affiliates?.find((a) => a.email === email); };

      const viewer = await find(staffWith({ affiliates: ["view"] }));
      expect(viewer).toBeTruthy();
      expect(JSON.stringify(viewer)).not.toMatch(/affiliatehash|reset-token-value|123456789012|GB82WEST/);
      expect(viewer.bankingInfo).toBeUndefined();

      const manager = await find(staffWith({ affiliates: ["view", "manage"] }));
      expect(JSON.stringify(manager)).not.toMatch(/affiliatehash|reset-token-value/);
      expect(manager.password).toBeUndefined();
      expect(manager.bankingInfo).toMatchObject({ accountNumber: "123456789012", iban: "GB82WEST12345698765432" });
    });

    it("the admin customer APIs never contain password hashes or one-time tokens", async () => {
      const email = `${TAG}-cust@example.invalid`;
      const customer = await Customer.create({
        name: `Cust ${TAG}`, email, password: "$2a$10$customerhashcustomerhash",
        verificationToken: "verify-token-1", pendingEmail: `${TAG}-new@example.invalid`, pendingEmailToken: "pending-token-2", resetPasswordToken: "reset-token-3",
      });
      session = superAdmin();
      const one = await import("@/app/api/admin/customers/[id]/route");
      const list = await import("@/app/api/admin/customers/route");
      const detail = await (await call(one.GET, "/x", undefined, ctxOf(customer._id))).text();
      expect(detail).toContain(email);
      expect(detail).not.toMatch(/customerhash|verify-token-1|pending-token-2|reset-token-3/);
      const listed = await (await call(list.GET, `/api/admin/customers?search=${encodeURIComponent(email)}&page=1`)).text();
      expect(listed).toContain(email);
      expect(listed).not.toMatch(/customerhash|verify-token-1|pending-token-2|reset-token-3/);
    });
  });

  // ── duplicated draft orders ──────────────────────────────────────────────────────────────────────
  describe("cancelling a duplicated draft order", () => {
    it("does not put back stock that was never taken, while a normal order still does", async () => {
      const product = await Product.create({ id: 5_000_000 + Math.floor(Math.random() * 900_000), name: `Stock Test ${TAG}`, slug: `stock-test-${TAG}`, price: 50, manageStock: true, stock: 10 });
      const customerId = oid();
      const line = { productId: product._id, name: "Stock Test", quantity: 2, priceAtPurchase: 50 };
      const draft = await Order.collection.insertOne(orderDoc("draft", { stockDeducted: false, items: [line], customer: { userId: customerId, email: `${TAG}-draft@example.invalid`, isGuest: false } }));
      const normal = await Order.collection.insertOne(orderDoc("normal", { items: [line], customer: { userId: customerId, email: `${TAG}-normal@example.invalid`, isGuest: false } }));
      session = { user: { id: String(customerId), email: `${TAG}@example.invalid`, isStaff: false } };
      const { PATCH } = await import("@/app/api/profile/orders/[id]/cancel/route");
      const cancel = (id) => call(PATCH, "/x", { method: "PATCH" }, ctxOf(id));
      const stock = async () => (await Product.findById(product._id).lean()).stock;

      expect((await cancel(draft.insertedId)).status).toBe(200);
      expect(await stock()).toBe(10); // nothing invented

      expect((await cancel(normal.insertedId)).status).toBe(200);
      expect(await stock()).toBe(12); // a real order gives its stock back
    });

    it("the duplicate builder marks the copy, and ordinary orders default to having taken stock", async () => {
      const { buildDuplicateOrderDoc } = await import("@/app/api/admin/orders/duplicateOrder");
      expect(buildDuplicateOrderDoc({ orderNumber: "PAI-1", items: [{ name: "x", quantity: 1, priceAtPurchase: 1 }] }, { orderNumber: "PAI-2" }).stockDeducted).toBe(false);
      expect(new Order({ orderNumber: "PAI-3" }).stockDeducted).toBe(true);
    });
  });

  // ── trashed orders over the CRM API ──────────────────────────────────────────────────────────────
  describe("CRM orders API", () => {
    const headers = { "x-api-key": "test-crm-key", "Content-Type": "application/json" };

    it("does not list or change an order that was moved to the Trash", async () => {
      await Order.collection.insertOne(orderDoc("crmlive"));
      await Order.collection.insertOne(orderDoc("crmtrash", { isDeleted: true }));
      const { GET, PATCH } = await import("@/app/api/crm/orders/route");

      const listed = await (await call(GET, `/api/crm/orders?orderNumber=${encodeURIComponent(`T-${TAG}-crm`)}&limit=50`, { headers })).json();
      expect(listed.orders.map((o) => o.orderNumber)).toEqual([`T-${TAG}-crmlive`]);

      const trashed = await call(PATCH, "/api/crm/orders", { method: "PATCH", headers, body: JSON.stringify({ orderNumber: `T-${TAG}-crmtrash`, status: "Confirmed" }) });
      expect(trashed.status).toBe(404);
      expect((await Order.collection.findOne({ orderNumber: `T-${TAG}-crmtrash` })).status).toBe("Pending");

      const live = await call(PATCH, "/api/crm/orders", { method: "PATCH", headers, body: JSON.stringify({ orderNumber: `T-${TAG}-crmlive`, adminNote: "ok" }) });
      expect(live.status).toBe(200);
    });
  });

  // ── public reviews and questions ─────────────────────────────────────────────────────────────────
  describe("public reviews and questions do not expose the author's private data", () => {
    const FORBIDDEN = /customerEmail|ipAddress|userAgent|spamScore|fingerprint|voters|reporters|shadowBanned|customerId|orderId|staffId|"email"/;
    let product;
    const ownerId = oid();

    beforeAll(async () => {
      product = await Product.create({ id: 6_000_000 + Math.floor(Math.random() * 900_000), name: `Review Test ${TAG}`, slug: `review-test-${TAG}`, price: 100 });
      await Review.create({
        productId: product._id, customerId: ownerId, orderId: oid(), rating: 5, title: "Great", comment: "Loved it", customerName: `Owner ${TAG}`,
        customerEmail: `${TAG}-owner@example.invalid`, status: "Approved", ipAddress: "198.51.100.9", userAgent: "Mozilla/5.0 secret", spamScore: 3,
        fingerprint: "fp-secret", voters: ["voter-hash"], reporters: ["reporter-hash"], helpfulVotes: 2,
        replies: [{ staffId: oid(), staffName: "Pairo Team", comment: "Thank you" }],
      });
      await Review.create({
        productId: product._id, orderId: oid(), rating: 4, comment: "Guest review", customerName: `Guest ${TAG}`,
        customerEmail: `${TAG}-guest@example.invalid`, status: "Approved", ipAddress: "198.51.100.10", userAgent: "ua",
      });
      await ProductQuestion.create({
        productId: product._id, customerName: `Asker ${TAG}`, customerEmail: `${TAG}-asker@example.invalid`, question: "Does it run large?", status: "Approved",
        replies: [{ staffId: oid(), staffName: "Pairo Team", answer: "Yes, true to size." }],
      });
    });

    it("GET reviews sends only public fields, and tells each viewer which review is theirs", async () => {
      const { GET } = await import("@/app/api/products/[id]/reviews/route");
      const get = async () => (await call(GET, `/api/products/${product._id}/reviews?limit=10`, undefined, ctxOf(product._id))).json();

      session = null;
      let body = await get();
      expect(body.reviews).toHaveLength(2);
      expect(JSON.stringify(body)).not.toMatch(FORBIDDEN);
      expect(JSON.stringify(body)).not.toMatch(/example\.invalid|198\.51\.100|secret/);
      expect(body.reviews.every((r) => r.isOwner === false)).toBe(true);
      const owned = body.reviews.find((r) => r.customerName === `Owner ${TAG}`);
      expect(owned).toMatchObject({ rating: 5, title: "Great", comment: "Loved it", helpfulVotes: 2, verifiedPurchase: true });
      expect(owned.replies).toEqual([expect.objectContaining({ staffName: "Pairo Team", comment: "Thank you" })]);

      session = { user: { id: String(ownerId), email: "someone-else@example.invalid", isStaff: false } }; // owns it by account id
      body = await get();
      expect(body.reviews.filter((r) => r.isOwner).map((r) => r.customerName)).toEqual([`Owner ${TAG}`]);

      session = { user: { id: String(oid()), email: `${TAG}-guest@example.invalid`, isStaff: false } }; // owns the guest one by email
      body = await get();
      expect(body.reviews.filter((r) => r.isOwner).map((r) => r.customerName)).toEqual([`Guest ${TAG}`]);
    });

    it("GET questions sends only the question and its answers", async () => {
      const { GET } = await import("@/app/api/products/[id]/questions/route");
      const body = await (await call(GET, `/api/products/${product._id}/questions`, undefined, ctxOf(product._id))).json();
      expect(body.questions).toHaveLength(1);
      expect(body.questions[0]).toMatchObject({ question: "Does it run large?", replies: [expect.objectContaining({ answer: "Yes, true to size." })] });
      expect(JSON.stringify(body)).not.toMatch(/customerEmail|example\.invalid|staffId|Asker/);
    });

    it("submitting a review or a question does not echo the stored record back", async () => {
      session = null;
      const reviews = await import("@/app/api/products/[id]/reviews/route");
      const questions = await import("@/app/api/products/[id]/questions/route");
      const r = await (await call(reviews.POST, "/x", post({ rating: 5, customerName: `New ${TAG}`, guestEmail: `${TAG}-new@example.invalid`, comment: "nice" }), ctxOf(product._id))).json();
      expect(r.success).toBe(true);
      expect(Object.keys(r.review).sort()).toEqual(["_id", "status"]);
      expect(await Review.countDocuments({ customerEmail: `${TAG}-new@example.invalid` })).toBe(1); // still stored, for moderation

      const q = await (await call(questions.POST, "/x", post({ turnstileToken: "t", customerName: `Ask ${TAG}`, customerEmail: `${TAG}-ask@example.invalid`, question: "Is it warm?" }), ctxOf(product._id))).json();
      expect(q.success).toBe(true);
      expect(Object.keys(q.question).sort()).toEqual(["_id", "status"]);
    });

    it("the mappers list public fields explicitly", () => {
      const review = { _id: "r1", rating: 5, customerName: "N", customerEmail: "e@x.test", customerId: "c1", ipAddress: "1.1.1.1", userAgent: "ua", spamScore: 9, voters: ["v"], newSecretField: "x", media: [{ url: "u", type: "image", _id: "m" }] };
      const out = toPublicReview(review, { id: "c1" });
      expect(Object.keys(out)).not.toContain("newSecretField");
      expect(JSON.stringify(out)).not.toMatch(/e@x\.test|1\.1\.1\.1|spamScore|voters/);
      expect(out.isOwner).toBe(true);
      expect(out.media).toEqual([{ url: "u", type: "image" }]);
      expect(viewerOwnsReview(review, null)).toBe(false);
      expect(viewerOwnsReview({ customerEmail: "E@X.test" }, { id: "z", email: " e@x.TEST " })).toBe(true);
      expect(viewerOwnsReview({ customerEmail: "" }, { id: "z", email: "" })).toBe(false);
      expect(toPublicQuestion({ _id: "q", question: "?", customerEmail: "e@x.test", replies: [{ staffId: "s", staffName: "T", answer: "a" }] })).toEqual({
        _id: "q", question: "?", replies: [{ _id: undefined, staffName: "T", answer: "a", createdAt: undefined }], createdAt: undefined,
      });
    });
  });
});
