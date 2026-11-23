import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

vi.mock("@/lib/email", () => ({
  sendCustomOrderConfirmation: vi.fn(async () => {}),
  sendAdminCustomOrderNotification: vi.fn(async () => {}),
}));

import Order from "@/models/Order";
import Counter from "@/models/Counter";
import { getNextOrderNumber } from "@/lib/orderNumber";
import { getNextOrderNumber as reExported } from "@/lib/checkoutFulfillment";

// The counter is shared by the whole database, so this file parks it at a number no real order will ever reach,
// and puts the original value back afterwards.
const BASE = 800_000_000 + Math.floor(Math.random() * 900_000);
const numberOf = (n) => `PAI-${n}`;
const takenNumbers = [];
let savedCounter;

const park = (seq) => Counter.collection.updateOne({ _id: "order:global" }, { $set: { seq } }, { upsert: true });
const takeNumber = async (n) => {
  await Order.collection.insertOne({ orderNumber: numberOf(n), status: "Pending", isDeleted: false, createdAt: new Date() });
  takenNumbers.push(numberOf(n));
};

describe("order numbers", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pairo");
    savedCounter = await Counter.collection.findOne({ _id: "order:global" });
  });

  afterAll(async () => {
    await Order.deleteMany({ orderNumber: { $in: takenNumbers } });
    if (savedCounter) await Counter.collection.updateOne({ _id: "order:global" }, { $set: { seq: savedCounter.seq } });
    else await Counter.collection.deleteOne({ _id: "order:global" });
    await mongoose.connection.close();
  });

  it("is still exported from the checkout module for the admin order routes", () => {
    expect(reExported).toBe(getNextOrderNumber);
  });

  it("hands out consecutive PAI- numbers", async () => {
    await park(BASE);
    expect(await getNextOrderNumber()).toBe(numberOf(BASE + 1));
    expect(await getNextOrderNumber()).toBe(numberOf(BASE + 2));
  });

  it("never hands out the same number twice, even for simultaneous orders", async () => {
    await park(BASE + 100);
    const numbers = await Promise.all(Array.from({ length: 12 }, () => getNextOrderNumber()));
    expect(new Set(numbers).size).toBe(12);
    expect(numbers.every((n) => /^PAI-\d+$/.test(n))).toBe(true);
  });

  it("skips numbers that are already taken instead of failing with a duplicate key, and moves the counter past them", async () => {
    await park(BASE + 200);
    await takeNumber(BASE + 201); // what the old count-based code used to leave ahead of the counter
    await takeNumber(BASE + 202);
    expect(await getNextOrderNumber()).toBe(numberOf(BASE + 203));
    const after = await Counter.collection.findOne({ _id: "order:global" });
    expect(after.seq).toBe(BASE + 203);
    expect(await getNextOrderNumber()).toBe(numberOf(BASE + 204));
  });

  it("a customization request no longer collides with a number the counter is about to give out (it used to answer 500 with E11000)", async () => {
    await park(BASE + 300);
    await takeNumber(BASE + 301);
    const { POST } = await import("@/app/api/customization-requests/route");
    const res = await POST(new Request("http://localhost/api/customization-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer: { name: "Test Person", email: "order-number-test@example.invalid" }, product: { name: "Custom Jacket", price: 500 }, customizations: {} }),
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.orderNumber).toBe(numberOf(BASE + 302));
    takenNumbers.push(body.orderNumber);
    expect(await Order.countDocuments({ orderNumber: body.orderNumber })).toBe(1);
  });
});
