import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Capture outgoing emails instead of sending them.
const sent = [];
vi.mock("@/lib/email", () => ({
  isSmtpConfigured: () => true,
  sendAbandonedCartEmail: vi.fn(async (email, cart, code, opts) => {
    sent.push({ email, code, opts });
    return { messageId: `<test-${sent.length}@example.invalid>`, subject: "You left something behind", accepted: [email], rejected: [], response: "250 2.0.0 OK" };
  }),
}));

import Discount from "@/models/Discount";
import Order from "@/models/Order";
import Promotion from "@/models/Promotion";
import AbandonedCart from "@/models/AbandonedCart";
import AbandonedCartEmailLog from "@/models/AbandonedCartEmailLog";
import SiteConfig from "@/models/SiteConfig";
import {
  getOrCreatePersonalVoucher,
  personalCodeBase,
  sendAbandonedCartRecoveryEmails,
  sendRecoveryEmailNow,
  getAbandonedCartDiagnostics,
  getWaitingCarts,
} from "@/lib/abandonedCartService";
import { saveAbandonedCartSettings, getAbandonedCartSettings } from "@/lib/abandonedCartSettings";
import { validateLegacyDiscount } from "@/lib/couponValidator";

const TAG = `vtest${Date.now()}`;
const emailOf = (n) => `${TAG}-${n}@example.invalid`;
const inAWeek = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const createdCodes = [];
const orderIds = [];
let previousSettings; // undefined = the config document did not exist

// Only look at the carts this file created, so a developer's own local carts are never emailed or changed.
const scan = (opts = {}) => sendAbandonedCartRecoveryEmails({ windowMinutes: 60, limit: 200, filter: { sessionKey: { $regex: TAG } }, ...opts });
const cartOf = (email) => AbandonedCart.findOne({ sessionKey: `${TAG}-${email}` }).lean();
const logsOf = (cartId) => AbandonedCartEmailLog.find({ cartId }).sort({ createdAt: 1 }).lean();

const makeCart = async (name, email, idleMinutes = 120) => {
  const cart = await AbandonedCart.create({
    sessionKey: `${TAG}-${email}`,
    items: [{ name: "Test Jacket", price: 100, quantity: 1 }],
    cartSubtotal: 100,
    cartTotal: 100,
    contact: { email, firstName: name.split(" ")[0] },
    shippingAddress: { fullName: name },
  });
  // Pretend it went quiet `idleMinutes` ago (bypasses timestamps).
  await AbandonedCart.collection.updateOne(
    { _id: cart._id },
    { $set: { updatedAt: new Date(Date.now() - idleMinutes * 60 * 1000) } }
  );
  return cart;
};

describe("abandoned-cart voucher: every shopper gets their own one-time code, made from their name", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pairo");
    // Settings live on the shared config document: remember them and put them back at the end.
    const main = await SiteConfig.collection.findOne({ key: "main" }, { projection: { "commerce.abandonedCart": 1 } });
    previousSettings = main?.commerce?.abandonedCart ?? null;
    await saveAbandonedCartSettings({ enabled: true, idleMinutes: 30, maxAgeHours: 72 });
  });

  afterAll(async () => {
    const carts = await AbandonedCart.find({ sessionKey: { $regex: TAG } }).select("_id").lean();
    await AbandonedCartEmailLog.deleteMany({ $or: [{ email: { $regex: TAG } }, { cartId: { $in: carts.map((c) => c._id) } }] });
    await Discount.deleteMany({ $or: [{ code: { $in: createdCodes } }, { specificCustomerEmails: { $regex: TAG } }] });
    await Promotion.deleteMany({ title: { $regex: TAG } });
    await AbandonedCart.deleteMany({ sessionKey: { $regex: TAG } });
    if (orderIds.length) await Order.collection.deleteMany({ _id: { $in: orderIds } });
    if (previousSettings) await SiteConfig.collection.updateOne({ key: "main" }, { $set: { "commerce.abandonedCart": previousSettings } });
    else await SiteConfig.collection.updateOne({ key: "main" }, { $unset: { "commerce.abandonedCart": "" } });
    await mongoose.disconnect();
  });

  it("builds the code base from the customer's name", () => {
    expect(personalCodeBase({ contact: { firstName: "Donald" } }, "x@y.z")).toBe("DONALD");
    expect(personalCodeBase({ shippingAddress: { fullName: "Donald Spanton" } }, "x@y.z")).toBe("DONALD");
    expect(personalCodeBase({ contact: { firstName: "José-Luis" } }, "x@y.z")).toBe("JOSELUIS");
    expect(personalCodeBase({}, "anna.k99@mail.com")).toBe("ANNAK");
    expect(personalCodeBase({}, "")).toBe("WELCOME");
  });

  it("creates DONALD15: 15% off, single use, locked to that email", async () => {
    const email = emailOf("donald");
    const v = await getOrCreatePersonalVoucher({ shippingAddress: { fullName: "Donald Spanton" } }, email);
    createdCodes.push(v.code);
    expect(v.code).toMatch(/^DONALD15[A-Z]?$/);
    expect(v.oneTime).toBe(true);

    const doc = await Discount.findOne({ code: v.code }).lean();
    expect(doc).toMatchObject({ type: "percentage", value: 15, usageLimit: 1, usagePerUserLimit: 1, source: "abandoned-cart" });
    expect(doc.specificCustomerEmails).toEqual([email]);

    // Same customer abandons again before using it: same code is reused, not a new one.
    const again = await getOrCreatePersonalVoucher({ shippingAddress: { fullName: "Donald Spanton" } }, email);
    expect(again.code).toBe(v.code);
  });

  it("gives a different person with the same first name a distinct code", async () => {
    const a = await getOrCreatePersonalVoucher({ contact: { firstName: "Donald" } }, emailOf("d2"));
    createdCodes.push(a.code);
    const b = await getOrCreatePersonalVoucher({ contact: { firstName: "Donald" } }, emailOf("d3"));
    createdCodes.push(b.code);
    expect(a.code).not.toBe(b.code);
    expect(b.code).toMatch(/^DONALD15[A-Z]$/);
  });

  it("only validates for its owner, and only once", async () => {
    const email = emailOf("owner");
    const v = await getOrCreatePersonalVoucher({ contact: { firstName: "Olivia" } }, email);
    createdCodes.push(v.code);
    const doc = await Discount.findOne({ code: v.code });

    expect((await validateLegacyDiscount(doc, { cartSubtotal: 100, email })).valid).toBe(true);
    expect((await validateLegacyDiscount(doc, { cartSubtotal: 100, email: emailOf("someone-else") })).valid).toBe(false);

    doc.usageCount = 1; // redeemed once
    expect((await validateLegacyDiscount(doc, { cartSubtotal: 100, email })).valid).toBe(false);
  });

  it("the recovery email carries the shopper's own one-time code and is logged", async () => {
    sent.length = 0;
    const email = emailOf("flow1");
    const created = await makeCart("Donald Spanton", email);

    const res = await scan();
    const mine = res.results.find((r) => r.email === email);
    expect(mine).toMatchObject({ sent: true, personal: true, status: "sent" });
    createdCodes.push(mine.voucherCode);

    const mail = sent.find((m) => m.email === email);
    expect(mail.code).toMatch(/^DONALD15[A-Z]?$/);
    expect(mail.opts).toMatchObject({ discountLabel: "15% off", oneTime: true });

    const cart = await cartOf(email);
    expect(cart.recoveryEmail).toMatchObject({ sent: true, voucherCode: mail.code, attempts: 1, gaveUp: false });
    expect(cart.recoveryEmail.messageId).toMatch(/^<test-\d+@example\.invalid>$/);

    // The activity log has the full record of what happened.
    const logs = await logsOf(created._id);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      status: "sent", email, firstName: "Donald", trigger: "scheduler", attempt: 1,
      voucherCode: mail.code, voucherKind: "personal", discountLabel: "15% off",
      cartTotal: 100, itemCount: 1, subject: "You left something behind", smtpResponse: "250 2.0.0 OK",
    });
    expect(logs[0].itemNames).toEqual(["Test Jacket"]);
    expect(logs[0].accepted).toEqual([email]);
    expect(logs[0].messageId).toBe(cart.recoveryEmail.messageId);

    // Running again must not email the same person twice.
    sent.length = 0;
    await scan();
    expect(sent.filter((m) => m.email === email)).toHaveLength(0);
    expect(await logsOf(created._id)).toHaveLength(1);
  });

  it("each shopper gets a different code made from their own name, locked to their own email", async () => {
    sent.length = 0;
    const people = [["Mary Jones", "mary", /^MARY15[A-Z]?$/], ["Anna Karenina", "anna", /^ANNA15[A-Z]?$/], ["José Álvarez", "jose", /^JOSE15[A-Z]?$/]];
    for (const [name, key] of people) await makeCart(name, emailOf(key));
    const res = await scan();
    const codes = [];
    for (const [, key, pattern] of people) {
      const mine = res.results.find((r) => r.email === emailOf(key));
      expect(mine, key).toMatchObject({ sent: true, personal: true });
      expect(mine.voucherCode).toMatch(pattern);
      createdCodes.push(mine.voucherCode);
      codes.push(mine.voucherCode);
      const doc = await Discount.findOne({ code: mine.voucherCode }).lean();
      expect(doc).toMatchObject({ type: "percentage", value: 15, usageLimit: 1, source: "abandoned-cart" });
      expect(doc.specificCustomerEmails).toEqual([emailOf(key)]);
    }
    expect(new Set(codes).size).toBe(3);
  });

  it("never mails a shared code: a running campaign, an evergreen code and the old COMEBACK15 promotion are all ignored", async () => {
    const campaign = `${TAG}CAMP`.toUpperCase();
    const evergreen = `${TAG}EVER`.toUpperCase();
    const comeback = `COMEBACK15${TAG}`.toUpperCase();
    await Discount.create({ code: campaign, type: "percentage", value: 10, isActive: true, endDate: inAWeek() });
    await Discount.create({ code: evergreen, type: "percentage", value: 25, isActive: true });
    const promo = await Promotion.create({
      title: `Abandoned Cart Win-Back ${TAG}`, description: "auto-abandoned-cart-voucher", code: comeback,
      adminStatus: "Active", endDate: inAWeek(), actions: [{ type: "percentage_discount", target: "cart", value: 15 }],
    });
    createdCodes.push(campaign, evergreen);
    try {
      sent.length = 0;
      const email = emailOf("flow2");
      const created = await makeCart("Mary Jones", email);
      const res = await scan();
      const mine = res.results.find((r) => r.email === email);
      expect(mine).toMatchObject({ sent: true, personal: true });
      createdCodes.push(mine.voucherCode);
      expect(mine.voucherCode).toMatch(/^MARY15[A-Z]?$/);
      expect([campaign, evergreen, comeback]).not.toContain(sent.find((m) => m.email === email).code);
      expect((await logsOf(created._id))[0]).toMatchObject({ status: "sent", voucherKind: "personal" });
    } finally {
      await Discount.deleteMany({ code: { $in: [campaign, evergreen] } });
      await Promotion.deleteOne({ _id: promo._id });
    }
  });

  it("a shopper who never typed a name still gets a personal code (made from the email)", async () => {
    sent.length = 0;
    const email = emailOf("noname");
    await makeCart("", email);
    const res = await scan();
    const mine = res.results.find((r) => r.email === email);
    expect(mine).toMatchObject({ sent: true, personal: true });
    expect(mine.voucherCode).toMatch(/^[A-Z]+15[A-Z]?$/);
    createdCodes.push(mine.voucherCode);
  });

  it("a failed send is logged, not marked as sent, backed off, and retried once the back-off has passed", async () => {
    const { sendAbandonedCartEmail } = await import("@/lib/email");
    // A reply about THIS address (550 = mailbox does not exist) is a real failure that counts towards giving up.
    sendAbandonedCartEmail.mockImplementationOnce(async () => { throw Object.assign(new Error("550 no such mailbox"), { responseCode: 550 }); });

    const email = emailOf("fail1");
    const created = await makeCart("Sam Fail", email);
    const res = await scan();
    expect(res.results.find((r) => r.email === email)).toMatchObject({ sent: false, status: "failed", reason: "error" });
    expect(res.failed).toBeGreaterThanOrEqual(1);

    let cart = await cartOf(email);
    expect(cart.recoveryEmail.sent).toBe(false);
    expect(cart.recoveryEmail.sendingSince).toBeNull(); // the claim was released
    expect(cart.recoveryEmail).toMatchObject({ attempts: 1, gaveUp: false, lastError: "550 no such mailbox" });
    expect(new Date(cart.recoveryEmail.nextAttemptAt).getTime()).toBeGreaterThan(Date.now());

    // Right away it is NOT retried (back-off), so a broken mailbox is never hammered every scan.
    sent.length = 0;
    await scan();
    expect(sent.filter((m) => m.email === email)).toHaveLength(0);

    // Once the back-off has passed it is tried again and succeeds.
    await AbandonedCart.collection.updateOne({ _id: created._id }, { $set: { "recoveryEmail.nextAttemptAt": new Date(Date.now() - 1000) } });
    const retry = await scan();
    expect(retry.results.find((r) => r.email === email)).toMatchObject({ sent: true });
    createdCodes.push(retry.results.find((r) => r.email === email).voucherCode);

    cart = await cartOf(email);
    expect(cart.recoveryEmail).toMatchObject({ sent: true, attempts: 2, lastError: null });
    const logs = await logsOf(created._id);
    expect(logs.map((l) => l.status)).toEqual(["failed", "sent"]);
    expect(logs[0]).toMatchObject({ reason: "send-error", error: "550 no such mailbox", attempt: 1 });
    expect(logs[1].attempt).toBe(2);
  });

  it("a mail-server outage never gives up a cart: it keeps waiting and is sent once the server is back", async () => {
    const { sendAbandonedCartEmail } = await import("@/lib/email");
    const email = emailOf("outage");
    const created = await makeCart("Olivia Outage", email);
    const outages = [
      Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }),
      Object.assign(new Error("Invalid login"), { code: "EAUTH", responseCode: 535 }),
      new Error("SMTP is not configured (SMTP_USER / SMTP_PASS missing) - email was not sent"),
      Object.assign(new Error("421 service not available"), { responseCode: 421 }),
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    ];
    for (const error of outages) {
      sendAbandonedCartEmail.mockImplementationOnce(async () => { throw error; });
      const res = await scan();
      expect(res.results.find((r) => r.email === email)).toMatchObject({ sent: false, status: "failed", temporary: true });
      const cart = await cartOf(email);
      expect(cart.recoveryEmail).toMatchObject({ sent: false, gaveUp: false, attempts: 0 }); // nothing counted against the cart
      expect(new Date(cart.recoveryEmail.nextAttemptAt).getTime()).toBeGreaterThan(Date.now());
      await AbandonedCart.collection.updateOne({ _id: created._id }, { $set: { "recoveryEmail.nextAttemptAt": new Date(Date.now() - 1000) } }); // let the back-off pass
    }
    const logs = await logsOf(created._id);
    expect(logs).toHaveLength(5);
    expect(logs.every((l) => l.status === "failed" && l.reason === "mail-server-problem")).toBe(true);

    const recovered = await scan(); // the mail server is back
    expect(recovered.results.find((r) => r.email === email)).toMatchObject({ sent: true });
    createdCodes.push(recovered.results.find((r) => r.email === email).voucherCode);
    expect((await cartOf(email)).recoveryEmail).toMatchObject({ sent: true, attempts: 1 });
  });

  it("a send that was interrupted (the process died) is picked up again once its claim has run out, but not before", async () => {
    sent.length = 0;
    const fresh = emailOf("claim-fresh");
    const stale = emailOf("claim-stale");
    const a = await makeCart("Fiona Fresh", fresh);
    const b = await makeCart("Stan Stale", stale);
    await AbandonedCart.collection.updateOne({ _id: a._id }, { $set: { "recoveryEmail.sendingSince": new Date(Date.now() - 60 * 1000) } }); // another process is sending right now
    await AbandonedCart.collection.updateOne({ _id: b._id }, { $set: { "recoveryEmail.sendingSince": new Date(Date.now() - 20 * 60 * 1000) } }); // that process died long ago

    const res = await scan();
    expect(res.results.find((r) => r.email === fresh)).toBeUndefined();
    expect(sent.filter((m) => m.email === fresh)).toHaveLength(0);
    const resent = res.results.find((r) => r.email === stale);
    expect(resent).toMatchObject({ sent: true });
    createdCodes.push(resent.voucherCode);
    expect((await cartOf(stale)).recoveryEmail).toMatchObject({ sent: true, sendingSince: null });
    expect((await cartOf(fresh)).recoveryEmail.sent).toBe(false); // untouched
  });

  it("a failed send never marks the cart as sent, so a crash before the end cannot fake a sent email", async () => {
    const { sendAbandonedCartEmail } = await import("@/lib/email");
    const email = emailOf("neversent");
    const created = await makeCart("Nora Never", email);
    sendAbandonedCartEmail.mockImplementationOnce(async () => { throw Object.assign(new Error("550 gone"), { responseCode: 550 }); });
    await scan();
    const cart = await cartOf(email);
    expect(cart.recoveryEmail.sent).toBe(false);
    expect(cart.recoveryEmail.sentAt ?? null).toBeNull();
    expect((await logsOf(created._id)).map((l) => l.status)).toEqual(["failed"]);
  });

  it("gives up after 3 failed attempts and never tries that cart again", async () => {
    const { sendAbandonedCartEmail } = await import("@/lib/email");
    const email = emailOf("giveup");
    const created = await makeCart("Gus Giveup", email);
    await AbandonedCart.collection.updateOne({ _id: created._id }, { $set: { "recoveryEmail.attempts": 2 } });
    sendAbandonedCartEmail.mockImplementationOnce(async () => { throw new Error("550 mailbox unavailable"); });

    const res = await scan();
    expect(res.results.find((r) => r.email === email)).toMatchObject({ sent: false, status: "gave-up" });
    const cart = await cartOf(email);
    expect(cart.recoveryEmail).toMatchObject({ sent: false, attempts: 3, gaveUp: true });
    expect((await logsOf(created._id)).at(-1)).toMatchObject({ status: "gave-up", attempt: 3, error: "550 mailbox unavailable" });

    sent.length = 0;
    await scan();
    expect(sent.filter((m) => m.email === email)).toHaveLength(0);
    expect((await getAbandonedCartDiagnostics({ windowMinutes: 60 })).carts.gaveUp).toBeGreaterThanOrEqual(1);

    // A cart that was given up on is still listed for the admin, and "Send now" can still reach it.
    const waiting = (await getWaitingCarts({ limit: 500 })).find((w) => w.email === email);
    expect(waiting).toMatchObject({ gaveUp: true });
    const manual = await sendRecoveryEmailNow(created._id);
    expect(manual).toMatchObject({ sent: true });
    createdCodes.push(manual.voucherCode);
    expect((await cartOf(email)).recoveryEmail).toMatchObject({ sent: true, gaveUp: false });
  });

  it("a very common first name never runs out of personal codes", async () => {
    const base = "ZOE15";
    const taken = [base, ...["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"].map((s) => base + s)];
    await Discount.deleteMany({ code: { $in: taken } });
    await Discount.insertMany(taken.map((code) => ({ code, type: "percentage", value: 15, isActive: true })));
    createdCodes.push(...taken);
    const voucher = await getOrCreatePersonalVoucher({ contact: { firstName: "Zoe" } }, emailOf("zoe26"));
    createdCodes.push(voucher.code);
    expect(taken).not.toContain(voucher.code);
    expect(voucher.code).toMatch(/^ZOE15[A-HJ-NP-Z2-9]{2,3}$/);
    expect(voucher.oneTime).toBe(true);
    expect((await Discount.findOne({ code: voucher.code }).lean()).specificCustomerEmails).toEqual([emailOf("zoe26")]);
  });

  it("does not email someone who already ordered, and records why", async () => {
    sent.length = 0;
    const email = emailOf("ordered");
    const created = await makeCart("Olga Ordered", email);
    const order = await Order.collection.insertOne({ orderNumber: `T-${TAG}-ordered`, customer: { email }, createdAt: new Date() }); // raw insert: skips the big Order validation
    orderIds.push(order.insertedId);

    const res = await scan();
    expect(res.results.find((r) => r.email === email)).toMatchObject({ sent: false, status: "skipped", reason: "order-exists" });
    expect(sent.filter((m) => m.email === email)).toHaveLength(0);
    expect((await cartOf(email)).status).toBe("recovered");
    expect((await logsOf(created._id))[0]).toMatchObject({ status: "skipped", reason: "order-exists" });
  });

  it("half-typed addresses are never queued, and diagnostics explain the counts", async () => {
    const bad = `${TAG}-halftyped@gm`;
    await makeCart("Half Typed", bad);
    const res = await scan();
    expect(res.results.find((r) => r.email === bad)).toBeUndefined();

    const d = await getAbandonedCartDiagnostics({ windowMinutes: 60 });
    expect(typeof d.smtpConfigured).toBe("boolean");
    expect(d.carts.invalidEmail).toBeGreaterThanOrEqual(1);
  });

  it("Send now emails one cart immediately, records who did it, and can send again", async () => {
    sent.length = 0;
    const email = emailOf("manual1");
    const created = await makeCart("Mia Manual", email, 1); // idle only 1 minute: the scheduler would not touch it
    const staffId = new mongoose.Types.ObjectId();

    expect((await scan()).results.find((r) => r.email === email)).toBeUndefined();

    const first = await sendRecoveryEmailNow(created._id, { staffId });
    expect(first).toMatchObject({ sent: true, status: "sent" });
    createdCodes.push(first.voucherCode);
    expect(sent.filter((m) => m.email === email)).toHaveLength(1);

    const again = await sendRecoveryEmailNow(created._id, { staffId });
    expect(again).toMatchObject({ sent: true });
    expect(sent.filter((m) => m.email === email)).toHaveLength(2);

    const logs = await logsOf(created._id);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ trigger: "manual", status: "sent" });
    expect(String(logs[0].triggeredBy)).toBe(String(staffId));

    // A failing forced send must not erase the earlier successful one (nor its real send time).
    const { sendAbandonedCartEmail } = await import("@/lib/email");
    const sentAtBefore = (await cartOf(email)).recoveryEmail.sentAt.getTime();
    await new Promise((resolve) => setTimeout(resolve, 20));
    sendAbandonedCartEmail.mockImplementationOnce(async () => { throw new Error("boom"); });
    expect(await sendRecoveryEmailNow(created._id, { staffId })).toMatchObject({ sent: false, status: "failed" });
    const after = (await cartOf(email)).recoveryEmail;
    expect(after.sent).toBe(true);
    expect(after.sentAt.getTime()).toBe(sentAtBefore);
  });

  it("recognises an earlier order even when its email was written with different capitals", async () => {
    sent.length = 0;
    const mixed = `${TAG}-MiXeD@example.invalid`;
    const created = await makeCart("Cara Case", mixed);
    const order = await Order.collection.insertOne({ orderNumber: `T-${TAG}-case`, customer: { email: mixed.toLowerCase() }, createdAt: new Date() });
    orderIds.push(order.insertedId);

    const res = await scan();
    expect(res.results.find((r) => r.email === mixed)).toMatchObject({ sent: false, status: "skipped", reason: "order-exists" });
    expect(sent.filter((m) => m.email === mixed)).toHaveLength(0);
    expect((await logsOf(created._id))[0]).toMatchObject({ status: "skipped", reason: "order-exists" });
  });

  it("never emails a cart that was moved to the Trash", async () => {
    sent.length = 0;
    const email = emailOf("trashed");
    const created = await makeCart("Tess Trashed", email);
    await AbandonedCart.collection.updateOne({ _id: created._id }, { $set: { isDeleted: true, deletedAt: new Date() } });
    const res = await scan();
    expect(res.results.find((r) => r.email === email)).toBeUndefined();
    expect(sent.filter((m) => m.email === email)).toHaveLength(0);
    expect(await sendRecoveryEmailNow(created._id)).toMatchObject({ sent: false, reason: "not-found" });
  });

  it("Send now refuses carts that were recovered or do not exist", async () => {
    const email = emailOf("manual2");
    const created = await makeCart("Rita Recovered", email);
    await AbandonedCart.collection.updateOne({ _id: created._id }, { $set: { status: "recovered" } });
    expect(await sendRecoveryEmailNow(created._id)).toMatchObject({ sent: false, reason: "order-exists" });
    expect(await sendRecoveryEmailNow(new mongoose.Types.ObjectId())).toMatchObject({ sent: false, reason: "not-found" });
  });

  it("lists the carts waiting for their email with how long is left", async () => {
    const email = emailOf("waiting");
    await makeCart("Wendy Waiting", email, 10);
    const waiting = await getWaitingCarts({ limit: 500 });
    const mine = waiting.find((w) => w.email === email);
    expect(mine).toBeTruthy();
    expect(mine.idleMinutes).toBeGreaterThanOrEqual(10);
    expect(mine.dueInMinutes).toBeGreaterThan(0); // default idle time is 30 minutes
    expect(mine.dueInMinutes).toBeLessThanOrEqual(20);
  });

  it("uses the idle time from the settings, and sends nothing when switched off", async () => {
    await saveAbandonedCartSettings({ enabled: true, idleMinutes: 30, maxAgeHours: 72 });
    sent.length = 0;
    const early = emailOf("idle20");
    const due = emailOf("idle40");
    await makeCart("Ian Early", early, 20);
    await makeCart("Dana Due", due, 40);

    // No windowMinutes override: the saved setting (30 min) decides.
    const res = await sendAbandonedCartRecoveryEmails({ limit: 200, filter: { sessionKey: { $regex: TAG } } });
    expect(res.results.find((r) => r.email === due)).toMatchObject({ sent: true });
    createdCodes.push(res.results.find((r) => r.email === due).voucherCode);
    expect(res.results.find((r) => r.email === early)).toBeUndefined();

    await saveAbandonedCartSettings({ enabled: false, idleMinutes: 30, maxAgeHours: 72 });
    sent.length = 0;
    const off = emailOf("off");
    await makeCart("Olive Off", off, 90);
    const disabled = await sendAbandonedCartRecoveryEmails({ limit: 200, filter: { sessionKey: { $regex: TAG } } });
    expect(disabled).toMatchObject({ disabled: true, scanned: 0, sent: 0 });
    expect(sent).toHaveLength(0);
    expect((await getAbandonedCartSettings()).enabled).toBe(false);
  });
});
