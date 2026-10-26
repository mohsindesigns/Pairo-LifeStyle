import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

let session = null;
const mail = vi.hoisted(() => ({ send: null }));
vi.mock("next-auth", () => ({ default: () => () => {}, getServerSession: () => Promise.resolve(session) }));
vi.mock("@/lib/audit", () => ({ logAction: vi.fn(async () => {}), redactSecrets: (v) => v }));
vi.mock("@/lib/email", async (importOriginal) => {
  const real = await importOriginal();
  mail.send = vi.fn(async () => ({ messageId: "<reward@example.invalid>" }));
  return { ...real, sendReviewRewardEmail: mail.send };
});

import Review from "@/models/Review";
import Order from "@/models/Order";
import Discount from "@/models/Discount";
import { maybeRewardVideoReview } from "@/lib/reviewReward";

const TAG = `vrr${Date.now()}`;
const oid = () => new mongoose.Types.ObjectId();
const emailOf = (n) => `${TAG}-${n}@example.invalid`;
const video = [{ url: "/uploads/review-abc.mp4", type: "video" }];
const make = (n, extra = {}) =>
  Review.create({ productId: oid(), orderId: oid(), rating: 5, customerName: `Dana ${TAG}`, customerEmail: emailOf(n), status: "Approved", media: video, ...extra });
const deliver = (n, status = "Delivered") =>
  Order.collection.insertOne({ orderNumber: `T-${TAG}-${n}`, status, isDeleted: false, customer: { email: emailOf(n).toUpperCase() }, createdAt: new Date() });

describe("video review thank-you code", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pairo");
  });
  afterAll(async () => {
    await Review.deleteMany({ customerEmail: { $regex: TAG } });
    await Order.collection.deleteMany({ orderNumber: { $regex: `^T-${TAG}` } });
    await Discount.deleteMany({ specificCustomerEmails: { $regex: TAG } });
    await mongoose.connection.close();
  });
  beforeEach(() => { mail.send.mockClear(); mail.send.mockImplementation(async () => ({ messageId: "<reward@example.invalid>" })); });

  it("rewards an approved video review once, with a 10% code locked to the customer's email", async () => {
    await deliver("a");
    const review = await make("a");
    const res = await maybeRewardVideoReview(review);
    expect(res.rewarded).toBe(true);
    expect(res.code).toMatch(/^DANA10[A-Z0-9]*$/);
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0].slice(0, 2)).toEqual([emailOf("a"), "Dana"]);
    const doc = await Discount.findOne({ code: res.code }).lean();
    expect(doc).toMatchObject({ type: "percentage", value: 10, usageLimit: 1, source: "review-reward" });
    expect(doc.specificCustomerEmails).toEqual([emailOf("a")]);
    const saved = await Review.findById(review._id).lean();
    expect(saved.reward).toMatchObject({ code: res.code, percent: 10, messageId: "<reward@example.invalid>" });
    // a second approval of the same review sends nothing
    await maybeRewardVideoReview(await Review.findById(review._id));
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it("gives no code without a delivered order, and says why", async () => {
    await deliver("b", "Pending");
    const review = await make("b");
    expect((await maybeRewardVideoReview(review)).rewarded).toBe(false);
    expect(mail.send).not.toHaveBeenCalled();
    expect((await Review.findById(review._id).lean()).reward.note).toMatch(/no delivered order/);
  });

  it("ignores reviews without a video, and reviews that are not approved", async () => {
    await deliver("c");
    const photo = await make("c", { media: [{ url: "/uploads/p.jpg", type: "image" }] });
    const pending = await make("c", { status: "Pending" });
    expect((await maybeRewardVideoReview(photo)).rewarded).toBe(false);
    expect((await maybeRewardVideoReview(pending)).rewarded).toBe(false);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("rewards a customer only once even with several video reviews", async () => {
    await deliver("d");
    expect((await maybeRewardVideoReview(await make("d"))).rewarded).toBe(true);
    const second = await make("d");
    expect((await maybeRewardVideoReview(second)).rewarded).toBe(false);
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect((await Review.findById(second._id).lean()).reward.note).toBe("already rewarded");
  });

  it("an email failure never breaks anything and is recorded", async () => {
    await deliver("e");
    mail.send.mockImplementation(async () => { throw new Error("smtp down"); });
    const review = await make("e");
    const res = await maybeRewardVideoReview(review);
    expect(res.rewarded).toBe(false);
    expect((await Review.findById(review._id).lean()).reward.note).toMatch(/smtp down/);
  });

  it("the admin approving a pending video review triggers the reward and the approval still succeeds", async () => {
    await deliver("f");
    const review = await make("f", { status: "Pending" });
    session = { user: { id: String(oid()), isStaff: true, role: { slug: "super-admin" } } };
    const { PUT } = await import("@/app/api/admin/reviews/[id]/route");
    const res = await PUT(new Request("http://localhost/x", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Approved" }) }), { params: Promise.resolve({ id: String(review._id) }) });
    expect(res.status).toBe(200);
    const saved = await Review.findById(review._id).lean();
    expect(saved.status).toBe("Approved");
    expect(saved.reward.code).toMatch(/^DANA10/);
    expect(mail.send).toHaveBeenCalledTimes(1);
  });
});
