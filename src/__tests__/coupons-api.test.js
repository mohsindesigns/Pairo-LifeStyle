import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "@/models/Product";
import Promotion from "@/models/Promotion";
import Discount from "@/models/Discount";
import Order from "@/models/Order";
import Customer from "@/models/Customer";

// Mock next-auth to avoid calling NextJS Request Store headers() outside a request context
vi.mock("next-auth", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: () => () => {},
    getServerSession: vi.fn(() => Promise.resolve(null))
  };
});

import { POST as validateCouponRoute } from "@/app/api/coupons/validate/route";

dotenv.config({ path: ".env.local" });

describe("Coupons Validate API Route — E2E Integration Suite", () => {
  let prodA;
  let testCollection;
  let createdProducts = [];
  let createdPromotions = [];
  let createdDiscounts = [];
  let createdOrders = [];
  let createdCustomers = [];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pairo");
    }

    testCollection = new mongoose.Types.ObjectId().toString();

    // Create a mock product
    prodA = await Product.create({
      tenantId: "DEFAULT_STORE",
      name: "API Test Shirt",
      slug: "api-test-shirt-" + Date.now(),
      price: 100,
      collections: [testCollection]
    });
    createdProducts.push(prodA._id);
  });

  afterEach(async () => {
    if (createdPromotions.length > 0) {
      await Promotion.deleteMany({ _id: { $in: createdPromotions } });
      createdPromotions = [];
    }
    if (createdDiscounts.length > 0) {
      await Discount.deleteMany({ _id: { $in: createdDiscounts } });
      createdDiscounts = [];
    }
    if (createdOrders.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrders } });
      createdOrders = [];
    }
    if (createdCustomers.length > 0) {
      await Customer.deleteMany({ _id: { $in: createdCustomers } });
      createdCustomers = [];
    }
  });

  afterAll(async () => {
    if (createdProducts.length > 0) {
      await Product.deleteMany({ _id: { $in: createdProducts } });
    }
    await mongoose.connection.close();
  });

  const createMockRequest = (body) => {
    return new Request("http://localhost/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  };

  it("should return automatic promotions even if no coupon code is supplied", async () => {
    const promo = await Promotion.create({
      tenantId: "DEFAULT_STORE",
      title: "Automatic $10 Off",
      isAutomatic: true,
      priority: 10,
      adminStatus: "Active",
      actions: [{
        type: "fixed_discount",
        target: "cart",
        value: 10
      }]
    });
    createdPromotions.push(promo._id);

    const req = createMockRequest({
      code: "",
      cartSubtotal: 100,
      items: [{ id: prodA._id.toString(), productId: prodA._id.toString(), price: 100, quantity: 1 }]
    });

    const res = await validateCouponRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.discountAmount).toBe(10);
    expect(data.isEnterprise).toBe(true);
    expect(data.appliedPromotions.length).toBe(1);
    expect(data.appliedPromotions[0].title).toBe("Automatic $10 Off");
  });

  it("should validate and apply an enterprise coupon code", async () => {
    const codeName = "ENTERPRISE20";
    const promo = await Promotion.create({
      tenantId: "DEFAULT_STORE",
      title: "20% Enterprise Coupon",
      isAutomatic: false,
      code: codeName,
      priority: 10,
      adminStatus: "Active",
      actions: [{
        type: "percentage_discount",
        target: "cart",
        value: 20
      }]
    });
    createdPromotions.push(promo._id);

    const req = createMockRequest({
      code: codeName,
      cartSubtotal: 100,
      items: [{ id: prodA._id.toString(), productId: prodA._id.toString(), price: 100, quantity: 1 }]
    });

    const res = await validateCouponRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.discountAmount).toBe(20);
    expect(data.isEnterprise).toBe(true);
  });

  it("should fallback to legacy discount validation when legacy code is entered", async () => {
    const legacyCode = "LEGACY15";
    const discount = await Discount.create({
      code: legacyCode,
      type: "fixed",
      value: 15,
      isActive: true,
      isDeleted: false
    });
    createdDiscounts.push(discount._id);

    const req = createMockRequest({
      code: legacyCode,
      cartSubtotal: 100,
      items: [{ id: prodA._id.toString(), productId: prodA._id.toString(), price: 100, quantity: 1 }]
    });

    const res = await validateCouponRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.discountAmount).toBe(15);
    expect(data.isLegacy).toBe(true);
  });

  it("should return a 404 error when an invalid coupon code is supplied", async () => {
    const req = createMockRequest({
      code: "INVALID_CODE_XYZ",
      cartSubtotal: 100,
      items: [{ id: prodA._id.toString(), productId: prodA._id.toString(), price: 100, quantity: 1 }]
    });

    const res = await validateCouponRoute(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("Invalid or expired");
  });

  it("should correctly resolve returning customerType and apply matching segments promotions", async () => {
    const email = "api-returning-customer@test.com";

    // Create a segment promotion for returning customers
    const promo = await Promotion.create({
      tenantId: "DEFAULT_STORE",
      title: "Welcome Back $30 Off",
      isAutomatic: true,
      priority: 20,
      adminStatus: "Active",
      conditions: {
        field: "customer_type",
        op: "==",
        value: "returning"
      },
      actions: [{
        type: "fixed_discount",
        target: "cart",
        value: 30
      }]
    });
    createdPromotions.push(promo._id);

    // 1. Request as a guest / new email (0 orders)
    const reqNew = createMockRequest({
      code: "",
      cartSubtotal: 100,
      email: email,
      items: [{ id: prodA._id.toString(), productId: prodA._id.toString(), price: 100, quantity: 1 }]
    });

    const resNew = await validateCouponRoute(reqNew);
    const dataNew = await resNew.json();
    expect(dataNew.discountAmount || 0).toBe(0); // Should not apply

    // 2. Insert a mock completed order for this email
    const order = await Order.create({
      tenantId: "DEFAULT_STORE",
      orderNumber: "API-ORD-" + Math.floor(Math.random() * 1000000),
      idempotencyKey: "api_key_" + Date.now(),
      status: "Confirmed",
      items: [{ productId: prodA._id, name: "Shirt", priceAtPurchase: 100, quantity: 1 }],
      financials: { subtotal: 100, total: 100 },
      customer: { email, isGuest: true }
    });
    createdOrders.push(order._id);

    // 3. Request again now that email is a returning customer
    const reqReturning = createMockRequest({
      code: "",
      cartSubtotal: 100,
      email: email,
      items: [{ id: prodA._id.toString(), productId: prodA._id.toString(), price: 100, quantity: 1 }]
    });

    const resReturning = await validateCouponRoute(reqReturning);
    const dataReturning = await resReturning.json();

    expect(dataReturning.success).toBe(true);
    expect(dataReturning.discountAmount).toBe(30); // Welcomed back!
  });
});
