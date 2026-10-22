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
  }),
}));

import Discount from "@/models/Discount";
import AbandonedCart from "@/models/AbandonedCart";
import {
  findOngoingCampaignVoucher,
  getOrCreatePersonalVoucher,
  personalCodeBase,
  sendAbandonedCartRecoveryEmails,
  getAbandonedCartDiagnostics,
} from "@/lib/abandonedCartService";
import { validateLegacyDiscount } from "@/lib/couponValidator";

const TAG = `vtest${Date.now()}`;
const emailOf = (n) => `${TAG}-${n}@example.invalid`;
const createdCodes = [];
let pausedCampaignIds = [];

const makeCart = async (name, email) => {
  const cart = await AbandonedCart.create({
    sessionKey: `${TAG}-${email}`,
    items: [{ name: "Test Jacket", price: 100, quantity: 1 }],
    cartSubtotal: 100,
    cartTotal: 100,
    contact: { email, firstName: name.split(" ")[0] },
    shippingAddress: { fullName: name },
  });
  // Pretend it went quiet 2 hours ago (bypasses timestamps).
  await AbandonedCart.collection.updateOne(
    { _id: cart._id },
    { $set: { updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } }
  );
  return cart;
};

describe("abandoned-cart voucher: ongoing campaign or personal one-time code", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pairo");
    // Park any real running campaigns so the "no campaign" path is deterministic; restored afterwards.
    const running = await Discount.find({ isActive: true, isDeleted: { $ne: true } }).select("_id").lean();
    pausedCampaignIds = running.map((d) => d._id);
    if (pausedCampaignIds.length) await Discount.updateMany({ _id: { $in: pausedCampaignIds } }, { $set: { isActive: false } });
  });

  afterAll(async () => {
    await Discount.deleteMany({ $or: [{ code: { $in: createdCodes } }, { specificCustomerEmails: { $regex: TAG } }] });
    await AbandonedCart.deleteMany({ sessionKey: { $regex: TAG } });
    if (pausedCampaignIds.length) await Discount.updateMany({ _id: { $in: pausedCampaignIds } }, { $set: { isActive: true } });
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

  it("with no campaign running, the recovery email carries a personal one-time code", async () => {
    expect(await findOngoingCampaignVoucher()).toBeNull();
    sent.length = 0;
    const email = emailOf("flow1");
    await makeCart("Donald Spanton", email);

    const res = await sendAbandonedCartRecoveryEmails({ windowMinutes: 60, limit: 200 });
    const mine = res.results.find((r) => r.email === email);
    expect(mine).toMatchObject({ sent: true, personal: true });
    createdCodes.push(mine.voucherCode);

    const mail = sent.find((m) => m.email === email);
    expect(mail.code).toMatch(/^DONALD15[A-Z]?$/);
    expect(mail.opts).toMatchObject({ discountLabel: "15% off", oneTime: true });

    const cart = await AbandonedCart.findOne({ sessionKey: `${TAG}-${email}` }).lean();
    expect(cart.recoveryEmail).toMatchObject({ sent: true, voucherCode: mail.code });
  });

  it("with a campaign running, it sends that campaign's code and creates no personal code", async () => {
    const campaignCode = `${TAG}CAMP`.toUpperCase();
    await Discount.create({ code: campaignCode, type: "percentage", value: 10, isActive: true });
    createdCodes.push(campaignCode);

    expect(await findOngoingCampaignVoucher()).toMatchObject({ code: campaignCode, label: "10% off" });

    sent.length = 0;
    const email = emailOf("flow2");
    await makeCart("Mary Jones", email);
    const res = await sendAbandonedCartRecoveryEmails({ windowMinutes: 60, limit: 200 });
    const mine = res.results.find((r) => r.email === email);
    expect(mine).toMatchObject({ sent: true, voucherCode: campaignCode, personal: false });

    const mail = sent.find((m) => m.email === email);
    expect(mail.opts).toMatchObject({ discountLabel: "10% off", oneTime: false });
    expect(await Discount.countDocuments({ specificCustomerEmails: email })).toBe(0);
  });

  it("a failed send is reported as an error and retried next run, not marked as sent", async () => {
    await Discount.updateMany({ code: `${TAG}CAMP`.toUpperCase() }, { $set: { isActive: true } });
    const { sendAbandonedCartEmail } = await import("@/lib/email");
    sendAbandonedCartEmail.mockImplementationOnce(async () => { throw new Error("SMTP is not configured"); });

    const email = emailOf("fail1");
    await makeCart("Sam Fail", email);
    const res = await sendAbandonedCartRecoveryEmails({ windowMinutes: 60, limit: 200 });
    expect(res.results.find((r) => r.email === email)).toMatchObject({ sent: false, reason: "error" });

    const cart = await AbandonedCart.findOne({ sessionKey: `${TAG}-${email}` }).lean();
    expect(cart.recoveryEmail.sent).toBe(false); // claim reverted, so the next run tries again

    const retry = await sendAbandonedCartRecoveryEmails({ windowMinutes: 60, limit: 200 });
    expect(retry.results.find((r) => r.email === email)).toMatchObject({ sent: true });
  });

  it("half-typed addresses are never queued, and diagnostics explain the counts", async () => {
    const bad = `${TAG}-halftyped@gm`;
    await makeCart("Half Typed", bad);
    const res = await sendAbandonedCartRecoveryEmails({ windowMinutes: 60, limit: 200 });
    expect(res.results.find((r) => r.email === bad)).toBeUndefined();

    const d = await getAbandonedCartDiagnostics({ windowMinutes: 60 });
    expect(typeof d.smtpConfigured).toBe("boolean");
    expect(d.carts.invalidEmail).toBeGreaterThanOrEqual(1);
  });

  it("a restricted code is never treated as a campaign", async () => {
    await Discount.updateMany({ code: `${TAG}CAMP`.toUpperCase() }, { $set: { isActive: false } });
    const restricted = `${TAG}MIN`.toUpperCase();
    await Discount.create({ code: restricted, type: "percentage", value: 30, isActive: true, minPurchase: 500 });
    createdCodes.push(restricted);
    expect(await findOngoingCampaignVoucher()).toBeNull();
  });
});
