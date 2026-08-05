import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "@/models/Product";
import Customer from "@/models/Customer";
import Order from "@/models/Order";
import Promotion from "@/models/Promotion";
import Engine from "@/lib/promotionEngine/Engine";

dotenv.config({ path: ".env.local" });

describe("Enterprise Promotion Engine — Complete Level-by-Level Verification Suite", () => {
  let prodA;
  let prodB;
  let prodC;
  let testCategory;
  let testCollection;
  let createdProducts = [];
  let createdPromotions = [];
  let createdOrders = [];
  let createdCustomers = [];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pairo");
    }

    testCategory = new mongoose.Types.ObjectId().toString();
    testCollection = new mongoose.Types.ObjectId().toString();

    // Create 3 temporary products
    prodA = await Product.create({
      tenantId: "DEFAULT_STORE",
      name: "Test Leather Jacket",
      slug: "test-leather-jacket-" + Date.now(),
      price: 200,
      categories: [testCategory],
      collections: [testCollection]
    });
    createdProducts.push(prodA._id);

    prodB = await Product.create({
      tenantId: "DEFAULT_STORE",
      name: "Test Slim Jeans",
      slug: "test-slim-jeans-" + Date.now(),
      price: 100,
      categories: [testCategory]
    });
    createdProducts.push(prodB._id);

    prodC = await Product.create({
      tenantId: "DEFAULT_STORE",
      name: "Test White T-Shirt",
      slug: "test-white-tshirt-" + Date.now(),
      price: 50,
      collections: [testCollection]
    });
    createdProducts.push(prodC._id);
  });

  afterAll(async () => {
    // Clean up created entities
    if (createdProducts.length > 0) {
      await Product.deleteMany({ _id: { $in: createdProducts } });
    }
    if (createdPromotions.length > 0) {
      await Promotion.deleteMany({ _id: { $in: createdPromotions } });
    }
    if (createdOrders.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrders } });
    }
    if (createdCustomers.length > 0) {
      await Customer.deleteMany({ _id: { $in: createdCustomers } });
    }
    await mongoose.connection.close();
  });

  // ----------------------------------------------------
  // LEVEL 1: FIXED PRODUCT PRICES
  // ----------------------------------------------------
  describe("Level 1: Fixed Product Prices", () => {
    it("should set target product price to a fixed lower value", async () => {
      const promo = {
        title: "Jacket Promo Price $149",
        isAutomatic: true,
        priority: 10,
        adminStatus: "Active",
        actions: [{
          type: "fixed_product_price",
          target: "product",
          targetIds: [prodA._id.toString()],
          value: 149
        }]
      };

      const cart = {
        subtotal: 200,
        items: [{ id: prodA._id.toString(), productId: prodA._id.toString(), price: 200, quantity: 1 }]
      };

      const results = await Engine.evaluate(cart, { activePromotions: [promo] });
      
      expect(results.appliedPromotions.length).toBe(1);
      expect(results.discountTotal).toBe(51); // 200 - 149 = 51 discount
      expect(results.cartTotal).toBe(149);
    });

    it("should not apply fixed product price if current price is already lower", async () => {
      const promo = {
        title: "Jeans Promo Price $120",
        isAutomatic: true,
        priority: 10,
        adminStatus: "Active",
        actions: [{
          type: "fixed_product_price",
          target: "product",
          targetIds: [prodB._id.toString()],
          value: 120
        }]
      };

      const cart = {
        subtotal: 100,
        items: [{ id: prodB._id.toString(), productId: prodB._id.toString(), price: 100, quantity: 1 }]
      };

      const results = await Engine.evaluate(cart, { activePromotions: [promo] });
      
      expect(results.discountTotal).toBe(0);
      expect(results.cartTotal).toBe(100);
    });
  });

  // ----------------------------------------------------
  // LEVEL 2: QUANTITY BREAKS / TIERED PRICING
  // ----------------------------------------------------
  describe("Level 2: Quantity Breaks & Tiered Pricing", () => {
    it("should apply per-unit price discount on meeting quantity tier threshold", async () => {
      const promo = {
        title: "Jeans Bulk Pricing",
        isAutomatic: true,
        priority: 10,
        adminStatus: "Active",
        actions: [{
          type: "quantity_tier",
          target: "product",
          targetIds: [prodB._id.toString()],
          quantityTiers: [
            { quantity: 2, priceType: "per_unit", value: 80 }, // 2+ Jeans for $80 each
            { quantity: 5, priceType: "per_unit", value: 70 }
          ]
        }]
      };

      const cart = {
        subtotal: 200,
        items: [{ id: prodB._id.toString(), productId: prodB._id.toString(), price: 100, quantity: 2 }]
      };

      const results = await Engine.evaluate(cart, { activePromotions: [promo] });
      
      expect(results.appliedPromotions.length).toBe(1);
      expect(results.discountTotal).toBe(40); // (100 - 80) * 2 = 40
      expect(results.cartTotal).toBe(160);
    });

    it("should apply total price discount for the tier quantity set", async () => {
      const promo = {
        title: "Jeans Buy 3 for $220 total",
        isAutomatic: true,
        priority: 10,
        adminStatus: "Active",
        actions: [{
          type: "quantity_tier",
          target: "product",
          targetIds: [prodB._id.toString()],
          quantityTiers: [
            { quantity: 3, priceType: "total", value: 220 }
          ]
        }]
      };

      const cart = {
        subtotal: 300,
        items: [{ id: prodB._id.toString(), productId: prodB._id.toString(), price: 100, quantity: 3 }]
      };

      const results = await Engine.evaluate(cart, { activePromotions: [promo] });
      
      expect(results.appliedPromotions.length).toBe(1);
      expect(results.discountTotal).toBe(80); // 300 - 220 = 80
      expect(results.cartTotal).toBe(220);
    });

    it("should fallback to lower matching tier if top tier threshold is not met", async () => {
      const promo = {
        title: "Jeans Multi Tier",
        isAutomatic: true,
        priority: 10,
        adminStatus: "Active",
        actions: [{
          type: "quantity_tier",
          target: "product",
          targetIds: [prodB._id.toString()],
          quantityTiers: [
            { quantity: 2, priceType: "per_unit", value: 90 },
            { quantity: 4, priceType: "per_unit", value: 75 }
          ]
        }]
      };

      const cart = {
        subtotal: 300,
        items: [{ id: prodB._id.toString(), productId: prodB._id.toString(), price: 100, quantity: 3 }]
      };

      const results = await Engine.evaluate(cart, { activePromotions: [promo] });
      
      expect(results.appliedPromotions.length).toBe(1);
      expect(results.discountTotal).toBe(30); // 3 Jeans * $90 each = 270 (30 discount)
      expect(results.cartTotal).toBe(270);
    });
  });

  // ----------------------------------------------------
  // LEVEL 3: BOGO (BUY X GET Y) PROMOTIONS
  // ----------------------------------------------------
  describe("Level 3: Buy X Get Y (BOGO) Options", () => {
    it("should discount same product correctly (Buy 1 Get 1 Free)", async () => {
      const promo = {
        title: "B1G1 Free Jacket",
        isAutomatic: true,
        priority: 10,
        adminStatus: "Active",
        actions: [{
          type: "bxgy",
          bxgyConfig: {
            buyType: "product",
            buyTargetIds: [prodA._id.toString()],
            buyQty: 1,
            getType: "product",
            getTargetIds: [prodA._id.toString()],
            getQty: 1,
            discountType: "free",
            mustBeSameProduct: true
          }
        }]
      };

      const cart = {
        subtotal: 400,
        items: [{ id: prodA._id.toString(), productId: prodA._id.toString(), price: 200, quantity: 2 }]
      };

      const results = await Engine.evaluate(cart, { activePromotions: [promo] });
      
      expect(results.appliedPromotions.length).toBe(1);
      expect(results.discountTotal).toBe(200); // 1 jacket free
      expect(results.cartTotal).toBe(200);
    });

    it("should discount cross-product correctly (Buy 2 Jackets, Get 1 Jeans Free)", async () => {
      const promo = {
        title: "Buy 2 Jackets, Get 1 Jeans Free",
        isAutomatic: true,
        priority: 10,
        adminStatus: "Active",
        actions: [{
          type: "bxgy",
          bxgyConfig: {
            buyType: "product",
            buyTargetIds: [prodA._id.toString()],
            buyQty: 2,
            getType: "product",
            getTargetIds: [prodB._id.toString()],
            getQty: 1,
            discountType: "free",
            mustBeSameProduct: false
          }
        }]
      };

      const cart = {
        subtotal: 500,
        items: [
          { id: prodA._id.toString(), productId: prodA._id.toString(), price: 200, quantity: 2 },
          { id: prodB._id.toString(), productId: prodB._id.toString(), price: 100, quantity: 1 }
        ]
      };

      const results = await Engine.evaluate(cart, { activePromotions: [promo] });
      
      expect(results.appliedPromotions.length).toBe(1);
      expect(results.discountTotal).toBe(100); // 1 Jeans free ($100)
      expect(results.cartTotal).toBe(400);
    });

    it("should discount the cheapest qualifying item in cross-product BOGO", async () => {
      const promo = {
        title: "Buy 1 Jacket, Get 1 Jeans or T-Shirt 50% Off (Cheapest Wins)",
        isAutomatic: true,
        priority: 10,
        adminStatus: "Active",
        actions: [{
          type: "bxgy",
          bxgyConfig: {
            buyType: "product",
            buyTargetIds: [prodA._id.toString()],
            buyQty: 1,
            getType: "all",
            getTargetIds: [], // Any product qualifies
            getQty: 1,
            discountType: "percentage",
            discountValue: 50,
            mustBeSameProduct: false,
            useCheapest: true
          }
        }]
      };

      const cart = {
        subtotal: 350,
        items: [
          { id: prodA._id.toString(), productId: prodA._id.toString(), price: 200, quantity: 1 }, // Jacket
          { id: prodB._id.toString(), productId: prodB._id.toString(), price: 100, quantity: 1 }, // Jeans ($100)
          { id: prodC._id.toString(), productId: prodC._id.toString(), price: 50, quantity: 1 }  // T-Shirt ($50)
        ]
      };

      const results = await Engine.evaluate(cart, { activePromotions: [promo] });
      
      expect(results.appliedPromotions.length).toBe(1);
      expect(results.discountTotal).toBe(25); // 50% off of the T-Shirt ($50) because it is cheaper than Jeans ($100)
      expect(results.cartTotal).toBe(325);
    });
  });

  // ----------------------------------------------------
  // LEVEL 4: BUNDLES
  // ----------------------------------------------------
  describe("Level 4: Product Bundles", () => {
    it("should discount when all required products are present (Jacket + Jeans Bundle for $250)", async () => {
      const promo = {
        title: "Jacket & Jeans Bundle",
        isAutomatic: true,
        priority: 10,
        adminStatus: "Active",
        actions: [{
          type: "bundle",
          bundleConfig: {
            products: [
              { productId: prodA._id.toString(), quantity: 1 },
              { productId: prodB._id.toString(), quantity: 1 }
            ],
            priceType: "fixed_price",
            value: 250
          }
        }]
      };

      const cart = {
        subtotal: 300,
        items: [
          { id: prodA._id.toString(), productId: prodA._id.toString(), price: 200, quantity: 1 },
          { id: prodB._id.toString(), productId: prodB._id.toString(), price: 100, quantity: 1 }
        ]
      };

      const results = await Engine.evaluate(cart, { activePromotions: [promo] });
      
      expect(results.appliedPromotions.length).toBe(1);
      expect(results.discountTotal).toBe(50); // (200 + 100) - 250 = 50
      expect(results.cartTotal).toBe(250);
    });

    it("should scale bundle discount based on number of complete sets present", async () => {
      const promo = {
        title: "Jacket & Jeans Bundle Multi",
        isAutomatic: true,
        priority: 10,
        adminStatus: "Active",
        actions: [{
          type: "bundle",
          bundleConfig: {
            products: [
              { productId: prodA._id.toString(), quantity: 1 },
              { productId: prodB._id.toString(), quantity: 1 }
            ],
            priceType: "fixed_price",
            value: 250
          }
        }]
      };

      const cart = {
        subtotal: 700,
        items: [
          { id: prodA._id.toString(), productId: prodA._id.toString(), price: 200, quantity: 2 },
          { id: prodB._id.toString(), productId: prodB._id.toString(), price: 100, quantity: 3 } // 3 Jeans, but only 2 Jackets, so 2 sets of bundle
        ]
      };

      const results = await Engine.evaluate(cart, { activePromotions: [promo] });
      
      expect(results.appliedPromotions.length).toBe(1);
      expect(results.discountTotal).toBe(100); // 2 sets * 50 discount = 100
      expect(results.cartTotal).toBe(600);
    });

    it("should not apply bundle discount if any required product is missing", async () => {
      const promo = {
        title: "Jacket & Jeans Bundle Missing",
        isAutomatic: true,
        priority: 10,
        adminStatus: "Active",
        actions: [{
          type: "bundle",
          bundleConfig: {
            products: [
              { productId: prodA._id.toString(), quantity: 1 },
              { productId: prodB._id.toString(), quantity: 1 }
            ],
            priceType: "fixed_price",
            value: 250
          }
        }]
      };

      const cart = {
        subtotal: 250,
        items: [
          { id: prodC._id.toString(), productId: prodC._id.toString(), price: 50, quantity: 1 },
          { id: prodA._id.toString(), productId: prodA._id.toString(), price: 200, quantity: 1 }
        ]
      };

      const results = await Engine.evaluate(cart, { activePromotions: [promo] });
      
      expect(results.discountTotal).toBe(0);
    });
  });

  // ----------------------------------------------------
  // LEVEL 5: CUSTOMER TARGETING & CONDITIONS AST
  // ----------------------------------------------------
  describe("Level 5: Customer Segments & Targeting Rules", () => {
    it("should match guest customers but block logged in users if rule specifies", async () => {
      const promo = {
        title: "New Guest Special",
        isAutomatic: true,
        priority: 10,
        adminStatus: "Active",
        conditions: {
          field: "customer_type",
          op: "==",
          value: "guest"
        },
        actions: [{
          type: "percentage_discount",
          target: "cart",
          value: 10
        }]
      };

      const cart = { subtotal: 100, items: [{ id: prodB._id.toString(), productId: prodB._id.toString(), price: 100, quantity: 1 }] };

      // Evaluate as guest
      const resultsGuest = await Engine.evaluate(cart, { activePromotions: [promo], customerType: "guest" });
      expect(resultsGuest.appliedPromotions.length).toBe(1);
      expect(resultsGuest.discountTotal).toBe(10);

      // Evaluate as returning logged_in
      const resultsUser = await Engine.evaluate(cart, { activePromotions: [promo], customerType: "returning" });
      expect(resultsUser.appliedPromotions.length).toBe(0);
      expect(resultsUser.discountTotal).toBe(0);
    });

    it("should evaluate complex recursive condition structures (AND / OR combinations)", async () => {
      const promo = {
        title: "Complex Bundle Rule",
        isAutomatic: true,
        priority: 15,
        adminStatus: "Active",
        conditions: {
          operator: "AND",
          rules: [
            { field: "subtotal", op: ">=", value: 150 },
            {
              operator: "OR",
              rules: [
                { field: "customer_type", op: "==", value: "returning" },
                { field: "items_count", op: ">=", value: 3 }
              ]
            }
          ]
        },
        actions: [{
          type: "percentage_discount",
          target: "cart",
          value: 15
        }]
      };

      const cart = { subtotal: 200, items: [
        { id: prodA._id.toString(), productId: prodA._id.toString(), price: 200, quantity: 1 }
      ] };

      // Case A: subtotal >= 150, but user is guest and qty < 3 -> should fail
      const resA = await Engine.evaluate(cart, { activePromotions: [promo], customerType: "guest" });
      expect(resA.appliedPromotions.length).toBe(0);

      // Case B: subtotal >= 150, user is returning -> should pass
      const resB = await Engine.evaluate(cart, { activePromotions: [promo], customerType: "returning" });
      expect(resB.appliedPromotions.length).toBe(1);
      expect(resB.discountTotal).toBe(30);

      // Case C: subtotal >= 150, user is guest, but quantity of items is 3 -> should pass
      const cartC = {
        subtotal: 150,
        items: [
          { id: prodC._id.toString(), productId: prodC._id.toString(), price: 50, quantity: 3 }
        ]
      };
      const resC = await Engine.evaluate(cartC, { activePromotions: [promo], customerType: "guest" });
      expect(resC.appliedPromotions.length).toBe(1);
      expect(resC.discountTotal).toBe(22.5);
    });
  });

  // ----------------------------------------------------
  // LEVEL 6: CONFLICT RESOLUTION, STACKING, PRIORITY
  // ----------------------------------------------------
  describe("Level 6: Stacking, Exclusivity, and Priorities", () => {
    it("should choose the higher priority promotion when exclusive is applied", async () => {
      const promo1 = {
        _id: new mongoose.Types.ObjectId(),
        title: "10% Automatic Regular Discount",
        isAutomatic: true,
        priority: 10,
        exclusive: false,
        adminStatus: "Active",
        actions: [{ type: "percentage_discount", value: 10 }]
      };

      const promo2 = {
        _id: new mongoose.Types.ObjectId(),
        title: "20% Exclusive High Priority Discount",
        isAutomatic: true,
        priority: 50,
        exclusive: true,
        adminStatus: "Active",
        actions: [{ type: "percentage_discount", value: 20 }]
      };

      const cart = { subtotal: 100, items: [{ id: prodB._id.toString(), productId: prodB._id.toString(), price: 100, quantity: 1 }] };

      const results = await Engine.evaluate(cart, { activePromotions: [promo1, promo2] });

      expect(results.appliedPromotions.length).toBe(1);
      expect(results.appliedPromotions[0].title).toBe("20% Exclusive High Priority Discount");
      expect(results.discountTotal).toBe(20);
    });

    it("should stack multiple non-exclusive promotions if allowed", async () => {
      const promo1 = {
        _id: new mongoose.Types.ObjectId(),
        title: "10% Member Discount",
        isAutomatic: true,
        priority: 10,
        stackable: true,
        adminStatus: "Active",
        actions: [{ type: "percentage_discount", value: 10 }]
      };

      const promo2 = {
        _id: new mongoose.Types.ObjectId(),
        title: "$15 Flat Coupon",
        isAutomatic: true,
        priority: 20,
        stackable: true,
        adminStatus: "Active",
        actions: [{ type: "fixed_discount", value: 15 }]
      };

      const cart = { subtotal: 100, items: [{ id: prodB._id.toString(), productId: prodB._id.toString(), price: 100, quantity: 1 }] };

      const results = await Engine.evaluate(cart, { activePromotions: [promo1, promo2] });

      expect(results.appliedPromotions.length).toBe(2);
      expect(results.discountTotal).toBe(25); // 10% of 100 = 10 + 15 = 25
      expect(results.cartTotal).toBe(75);
    });
  });
});
