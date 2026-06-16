import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Discount from "@/models/Discount";
import Product from "@/models/Product";
import Order from "@/models/Order";
import Subscriber from "@/models/Subscriber";
import Customer from "@/models/Customer";
import { validateLegacyDiscount, calculateEligibleSubtotal } from "@/lib/couponValidator";

dotenv.config({ path: ".env.local" });

describe("Legacy Discount Verification and Validation Suite", () => {
  let tempProduct1;
  let tempProduct2;
  let tempCategory1;
  let tempCategory2;
  let tempSubscriber;
  let tempUser;
  let createdDiscounts = [];
  let createdOrders = [];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Create temp categories
    tempCategory1 = new mongoose.Types.ObjectId();
    tempCategory2 = new mongoose.Types.ObjectId();

    // Create temp products
    tempProduct1 = await Product.create({
      tenantId: "DEFAULT_STORE",
      id: 9991,
      name: "Discount Test Hoodie",
      slug: "discount-test-hoodie-" + Date.now(),
      price: 100,
      categories: [tempCategory1]
    });

    tempProduct2 = await Product.create({
      tenantId: "DEFAULT_STORE",
      id: 9992,
      name: "Discount Test Jacket",
      slug: "discount-test-jacket-" + Date.now(),
      price: 200,
      categories: [tempCategory2]
    });

    // Create temp subscriber
    tempSubscriber = await Subscriber.create({
      email: "subscribed@test.com",
      status: "Subscribed"
    });

    // Create temp user
    tempUser = await Customer.create({
      name: "Discount Tester",
      email: "registered-user@test.com",
      password: "password123",
      role: "customer"
    });
  });

  afterAll(async () => {
    // Cleanup products
    if (tempProduct1) await Product.deleteOne({ _id: tempProduct1._id });
    if (tempProduct2) await Product.deleteOne({ _id: tempProduct2._id });

    // Cleanup subscriber
    if (tempSubscriber) await Subscriber.deleteOne({ _id: tempSubscriber._id });

    // Cleanup user
    if (tempUser) await Customer.deleteOne({ _id: tempUser._id });

    // Cleanup discounts
    if (createdDiscounts.length > 0) {
      await Discount.deleteMany({ _id: { $in: createdDiscounts } });
    }

    // Cleanup orders
    if (createdOrders.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrders } });
    }

    await mongoose.connection.close();
  });

  const registerDiscount = async (data) => {
    const d = await Discount.create({
      code: "TEST_" + Math.random().toString(36).substring(2, 9).toUpperCase(),
      type: "percentage",
      value: 10,
      ...data
    });
    createdDiscounts.push(d._id);
    return d;
  };

  it("should validate minimum purchase subtotal limit", async () => {
    const discount = await registerDiscount({ minPurchase: 150 });
    
    // Fails because subtotal is $100
    const failRes = await validateLegacyDiscount(discount, {
      cartSubtotal: 100,
      items: [{ id: tempProduct1._id, price: 100, quantity: 1 }]
    });
    expect(failRes.valid).toBe(false);
    expect(failRes.error).toContain("Minimum purchase");

    // Passes because subtotal is $200
    const passRes = await validateLegacyDiscount(discount, {
      cartSubtotal: 200,
      items: [{ id: tempProduct2._id, price: 200, quantity: 1 }]
    });
    expect(passRes.valid).toBe(true);
  });

  it("should validate user login requirements", async () => {
    const discount = await registerDiscount({ userRegistrationRequired: true });

    // Fails for guest (no userId context)
    const failRes = await validateLegacyDiscount(discount, {
      cartSubtotal: 100,
      items: [{ id: tempProduct1._id, price: 100, quantity: 1 }],
      userId: null
    });
    expect(failRes.valid).toBe(false);
    expect(failRes.error).toContain("register or log in");

    // Passes when userId is present
    const passRes = await validateLegacyDiscount(discount, {
      cartSubtotal: 100,
      items: [{ id: tempProduct1._id, price: 100, quantity: 1 }],
      userId: tempUser._id.toString()
    });
    expect(passRes.valid).toBe(true);
  });

  it("should validate newsletter subscriber requirements", async () => {
    const discount = await registerDiscount({ newsletterSubscribedOnly: true });

    // Fails for unsubscribed email
    const failRes = await validateLegacyDiscount(discount, {
      cartSubtotal: 100,
      items: [{ id: tempProduct1._id, price: 100, quantity: 1 }],
      email: "unsubscribed@test.com"
    });
    expect(failRes.valid).toBe(false);
    expect(failRes.error).toContain("newsletter subscribers only");

    // Passes for subscribed email
    const passRes = await validateLegacyDiscount(discount, {
      cartSubtotal: 100,
      items: [{ id: tempProduct1._id, price: 100, quantity: 1 }],
      email: "subscribed@test.com"
    });
    expect(passRes.valid).toBe(true);
  });

  it("should validate first-order only restriction", async () => {
    const discount = await registerDiscount({ firstOrderOnly: true });

    // Guest with no previous orders is allowed
    const passGuest = await validateLegacyDiscount(discount, {
      cartSubtotal: 100,
      items: [{ id: tempProduct1._id, price: 100, quantity: 1 }],
      email: "new-customer@test.com"
    });
    expect(passGuest.valid).toBe(true);

    // Create a mock order for an existing email
    const existingEmail = "repeat-customer@test.com";
    const order = await Order.create({
      tenantId: "DEFAULT_STORE",
      orderNumber: "TEST-ORD-" + Math.floor(Math.random() * 1000000),
      idempotencyKey: "test_key_" + Date.now() + "_" + Math.random(),
      status: "Confirmed",
      items: [{ productId: tempProduct1._id, name: "Item", priceAtPurchase: 100, quantity: 1 }],
      financials: { subtotal: 100, total: 100 },
      customer: { email: existingEmail, isGuest: true }
    });
    createdOrders.push(order._id);

    // Fails for this email
    const failRepeat = await validateLegacyDiscount(discount, {
      cartSubtotal: 100,
      items: [{ id: tempProduct1._id, price: 100, quantity: 1 }],
      email: existingEmail
    });
    expect(failRepeat.valid).toBe(false);
    expect(failRepeat.error).toContain("first order");
  });

  it("should calculate eligible subtotal correctly and cap discounts to restricted products", async () => {
    const discount = await registerDiscount({
      type: "percentage",
      value: 20, // 20% off
      specificProducts: [tempProduct1._id]
    });

    const items = [
      { id: tempProduct1._id.toString(), price: 100, quantity: 1 }, // Eligible
      { id: tempProduct2._id.toString(), price: 200, quantity: 1 }  // Ineligible
    ];

    // Compute eligible subtotal (only tempProduct1)
    const eligibleSubtotal = await calculateEligibleSubtotal(discount, items);
    expect(eligibleSubtotal).toBe(100);

    // Calculate discount amount (20% of eligibleSubtotal = $20)
    const amount = (eligibleSubtotal * discount.value) / 100;
    expect(amount).toBe(20);
  });

  it("should calculate eligible subtotal correctly for category restrictions", async () => {
    const discount = await registerDiscount({
      type: "percentage",
      value: 10, // 10% off
      specificCategories: [tempCategory2]
    });

    const items = [
      { id: tempProduct1._id.toString(), price: 100, quantity: 1 }, // Category 1: Ineligible
      { id: tempProduct2._id.toString(), price: 200, quantity: 2 }  // Category 2: Eligible ($400)
    ];

    const eligibleSubtotal = await calculateEligibleSubtotal(discount, items);
    expect(eligibleSubtotal).toBe(400);

    const amount = (eligibleSubtotal * discount.value) / 100;
    expect(amount).toBe(40);
  });

  it("should calculate eligible subtotal and validate restrictions when items use WooCommerce numeric IDs", async () => {
    const discount = await registerDiscount({
      type: "percentage",
      value: 20, // 20% off
      specificProducts: [tempProduct1._id]
    });

    // Cart items using numeric IDs: tempProduct1 has id: 9991, tempProduct2 has id: 9992
    const items = [
      { id: "9991", price: 100, quantity: 1 }, // Eligible product (resolves to tempProduct1._id)
      { id: "9992", price: 200, quantity: 1 }  // Ineligible product
    ];

    // Verify validation passes because eligible item 9991 is present
    const validation = await validateLegacyDiscount(discount, {
      cartSubtotal: 300,
      items
    });
    expect(validation.valid).toBe(true);

    // Compute eligible subtotal (resolves 9991 to tempProduct1.price * quantity = 100)
    const eligibleSubtotal = await calculateEligibleSubtotal(discount, items);
    expect(eligibleSubtotal).toBe(100);

    // Calculate discount amount (20% of eligibleSubtotal = $20)
    const amount = (eligibleSubtotal * discount.value) / 100;
    expect(amount).toBe(20);
  });
});
