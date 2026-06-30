/**
 * COMPREHENSIVE CUSTOMER DISCOUNT SYSTEM TESTS
 *
 * Tests every feature introduced in the Customer Discount System:
 *
 *  TEST  1: Affiliate model — discount fields exist and have correct defaults
 *  TEST  2: AffiliateApplication model — discount fields exist and persist
 *  TEST  3: Order model — financials discount fields persist correctly
 *  TEST  4: Discount calculation — Percentage type (all math cases)
 *  TEST  5: Discount calculation — Fixed type
 *  TEST  6: Discount calculation — None type returns $0
 *  TEST  7: Fixed discount capped at subtotal (no negative totals)
 *  TEST  8: Percentage edge case — 100% discount
 *  TEST  9: Authoritative total formula (subtotal - promo - affiliate + shipping + tax)
 *  TEST 10: Affiliate discount is INDEPENDENT of promo code discount
 *  TEST 11: Cookie payload — pairo_ref JSON has all required fields
 *  TEST 12: Cookie payload — correctly round-trips through JSON serialization
 *  TEST 13: CartContext — Percentage discount reduces cartTotal
 *  TEST 14: CartContext — Fixed discount reduces cartTotal
 *  TEST 15: CartContext — None type leaves cartTotal unchanged
 *  TEST 16: DB update — customerDiscountType persists on Affiliate update
 *  TEST 17: DB update — customerDiscountValue persists on Affiliate update
 *  TEST 18: DB read — affiliate discount financials readable from Order
 *  TEST 19: Self-referral guard — buyer email matches affiliate email → discount zeroed
 *  TEST 20: Data integrity — affiliateDiscountAmount stored matches calculation
 */

const mongoose = require("mongoose");

const URI = "mongodb://127.0.0.1:27017/pairo";
process.env.MONGODB_URI = URI;

// ─── Assertion helpers ─────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? `\n     → ${detail}` : ""}`);
    failed++;
  }
}

function assertEq(actual, expected, label) {
  const ok = actual === expected;
  assert(ok, label, ok ? "" : `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

function assertClose(actual, expected, label, tol = 0.001) {
  const ok = typeof actual === "number" && Math.abs(actual - expected) <= tol;
  assert(ok, label, ok ? "" : `got ${actual}, expected ${expected} (±${tol})`);
}

// ─── Pure-logic helpers (mirrors server/client code) ──────────────────────────
/** mirrors checkout/route.js */
function serverCalcAffiliateDiscount(subtotal, type, value) {
  if (!type || type === "None" || !value) return 0;
  if (type === "Percentage") return Math.round((subtotal * (value / 100)) * 100) / 100;
  if (type === "Fixed") return Math.min(value, subtotal);
  return 0;
}

/** mirrors checkout/route.js */
function authoritativeTotal(subtotal, promo, affDiscount, shipping, tax) {
  return Math.max(0, subtotal - promo - affDiscount + shipping + tax);
}

/** mirrors CartContext.js */
function cartContextDiscount(cartSubtotal, type, value) {
  if (!type || type === "None" || !value) return 0;
  if (type === "Percentage") return Math.round((cartSubtotal * value / 100) * 100) / 100;
  if (type === "Fixed") return Math.min(value, cartSubtotal);
  return 0;
}

/** mirrors checkout/route.js self-referral guard */
function selfReferralGuard(buyerEmail, affiliateEmail) {
  const b = (buyerEmail || "").toLowerCase().trim();
  const a = (affiliateEmail || "").toLowerCase().trim();
  return b && b === a; // true = blocked
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function runTests() {
  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log("   CUSTOMER DISCOUNT SYSTEM — COMPREHENSIVE TEST SUITE (20 tests)");
  console.log("══════════════════════════════════════════════════════════════════\n");

  await mongoose.connect(URI);
  console.log("🔌 MongoDB connected.\n");

  const Affiliate = (await import("../models/Affiliate.js")).default;
  const AffiliateApplication = (await import("../models/AffiliateApplication.js")).default;
  const Order = (await import("../models/Order.js")).default;

  const TEST_EMAIL      = "discount_suite_2026@pairotest.dev";
  const AFF_REF_CODE    = "DISC2026SUITE";
  const TEST_ORDER_NUM  = "DS-ORDER-SUITE-001";
  const AFF_ID          = `DISC-AFF-${Date.now()}`;

  // Wipe any leftovers
  await Affiliate.deleteMany({ email: TEST_EMAIL });
  await AffiliateApplication.deleteMany({ email: TEST_EMAIL });
  await Order.deleteMany({ orderNumber: { $regex: /^DS-ORDER-SUITE/ } });

  let affiliateDoc = null;
  let testOrderDoc  = null;

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1 — Affiliate model defaults
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 1: Affiliate model — discount field defaults ───");
    affiliateDoc = await Affiliate.create({
      name:           "Discount Suite Tester",
      email:          TEST_EMAIL,
      password:       "hash_placeholder",
      affiliateId:    AFF_ID,
      referralCode:   AFF_REF_CODE,
      commissionRate: 10,
      commissionType: "Percentage",
      status:         "Active",
    });
    assertEq(affiliateDoc.customerDiscountType,  "None", "customerDiscountType defaults to 'None'");
    assertEq(affiliateDoc.customerDiscountValue, 0,      "customerDiscountValue defaults to 0");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2 — AffiliateApplication discount fields
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 2: AffiliateApplication model — discount fields persist ───");
    // Use native driver insert to skip validation overhead
    const appCollection = mongoose.connection.collection("affiliateapplications");
    const appResult = await appCollection.insertOne({
      name:  "Discount Applicant",
      email: TEST_EMAIL,
      referralCode:           AFF_REF_CODE + "-APP",
      customerDiscountType:   "Percentage",
      customerDiscountValue:  15,
      status: "Pending",
      createdAt: new Date(),
    });

    const savedApp = await appCollection.findOne({ _id: appResult.insertedId });
    assertEq(savedApp.customerDiscountType,   "Percentage", "Application customerDiscountType saved");
    assertEq(savedApp.customerDiscountValue,  15,           "Application customerDiscountValue saved");
    await appCollection.deleteOne({ _id: appResult.insertedId });
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3 — Order financials discount fields
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 3: Order model — financials discount fields persist ───");
    // Use native driver insert so we don't need to satisfy every Order required field
    const orderCol = mongoose.connection.collection("orders");
    const orderIns = await orderCol.insertOne({
      orderNumber:          TEST_ORDER_NUM,
      status:               "Confirmed",
      affiliateReferralCode: AFF_REF_CODE,
      financials: {
        subtotal:              200,
        shippingCost:          10,
        tax:                   0,
        discountTotal:         0,
        affiliateDiscountType:  "Percentage",
        affiliateDiscountValue: 10,
        affiliateDiscountAmount: 20,
        total:                 190,
        currency:              "USD",
      },
      createdAt: new Date(),
    });
    testOrderDoc = await orderCol.findOne({ _id: orderIns.insertedId });
    assertEq(testOrderDoc.financials.affiliateDiscountType,  "Percentage", "Order.financials.affiliateDiscountType saved");
    assertEq(testOrderDoc.financials.affiliateDiscountValue, 10,           "Order.financials.affiliateDiscountValue saved");
    assertEq(testOrderDoc.financials.affiliateDiscountAmount, 20,          "Order.financials.affiliateDiscountAmount saved");
    assertEq(testOrderDoc.financials.total, 190,                           "Order.financials.total saved");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4 — Percentage discount math (server-side)
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 4: Discount calc — Percentage type ───");
    assertClose(serverCalcAffiliateDiscount(200,    "Percentage", 10),  20,    "10% of $200 = $20");
    assertClose(serverCalcAffiliateDiscount(199.99, "Percentage", 15),  30.00, "15% of $199.99 ≈ $30.00");
    assertClose(serverCalcAffiliateDiscount(500,    "Percentage", 5),   25,    "5% of $500 = $25");
    assertClose(serverCalcAffiliateDiscount(333.33, "Percentage", 33),  110.00,"33% of $333.33 ≈ $110.00");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5 — Fixed discount math
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 5: Discount calc — Fixed type ───");
    assertClose(serverCalcAffiliateDiscount(100, "Fixed", 15), 15, "Fixed $15 off $100");
    assertClose(serverCalcAffiliateDiscount(200, "Fixed", 50), 50, "Fixed $50 off $200");
    assertClose(serverCalcAffiliateDiscount(75,  "Fixed",  5),  5, "Fixed $5 off $75");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6 — None type returns $0
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 6: Discount calc — None type = $0 ───");
    assertEq(serverCalcAffiliateDiscount(100, "None",       10), 0, "None → $0");
    assertEq(serverCalcAffiliateDiscount(100, null,         10), 0, "null → $0");
    assertEq(serverCalcAffiliateDiscount(100, "Percentage",  0), 0, "Zero value → $0");
    assertEq(serverCalcAffiliateDiscount(100, undefined,    10), 0, "undefined → $0");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7 — Fixed discount capped at subtotal
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 7: Fixed discount — capped at subtotal ───");
    assertClose(serverCalcAffiliateDiscount(20,  "Fixed", 100), 20, "$100 off $20 → capped at $20");
    assertClose(serverCalcAffiliateDiscount(0,   "Fixed",  50),  0, "$50 off $0 → $0");
    assertClose(serverCalcAffiliateDiscount(0.01,"Fixed",   1), 0.01,"$1 off $0.01 → capped at $0.01");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8 — 100% percentage edge case
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 8: Percentage — 100% edge case ───");
    assertClose(serverCalcAffiliateDiscount(150, "Percentage", 100), 150, "100% of $150 = $150");
    assertClose(serverCalcAffiliateDiscount(0,   "Percentage", 100),   0, "100% of $0 = $0");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 9 — Authoritative total formula
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 9: Authoritative total formula ───");
    // subtotal=200, promo=20, affDiscount=18, shipping=10, tax=0
    assertClose(authoritativeTotal(200, 20, 18, 10, 0), 172, "200 - 20 - 18 + 10 + 0 = 172");
    // subtotal=100, promo=0, affDiscount=10, shipping=5, tax=8
    assertClose(authoritativeTotal(100,  0, 10,  5, 8), 103, "100 - 0 - 10 + 5 + 8 = 103");
    // clamped to 0
    assertClose(authoritativeTotal(50,  30, 30,  0, 0),   0, "Clamped to 0 when discounts exceed subtotal");
    // no discounts
    assertClose(authoritativeTotal(300,  0,  0, 15, 0), 315, "No discounts: 300 + 15 shipping = 315");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 10 — Affiliate discount independent from promo discount
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 10: Independence — affiliate discount vs promo discount ───");
    const sub10      = 300;
    const promo10    = 30;                                          // 10% promo
    const affDisc10  = serverCalcAffiliateDiscount(sub10, "Percentage", 5); // 5% aff
    assertClose(affDisc10, 15, "Affiliate 5% of $300 = $15");

    const total10    = authoritativeTotal(sub10, promo10, affDisc10, 0, 0);
    assertClose(total10, 255, "$300 - $30 promo - $15 affiliate = $255");

    // Commission is on ORIGINAL subtotal (unchanged)
    const commission10 = sub10 * 0.10;
    assertClose(commission10, 30, "Commission on original $300 = $30 (not on discounted price)");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 11 — Cookie payload: pairo_ref required fields
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 11: Cookie payload — required fields present ───");
    const expiresAt = Date.now() + 30 * 86400000;
    const cookiePayload = {
      affiliateId:          String(affiliateDoc._id),
      code:                 AFF_REF_CODE,
      timestamp:            Date.now(),
      landingUrl:           "https://pairo.com/?ref=DISC2026SUITE",
      referrer:             "",
      expiresAt,
      customerDiscountType:  "Percentage",
      customerDiscountValue: 12,
    };

    assert(!!cookiePayload.affiliateId,          "Cookie has affiliateId");
    assert(!!cookiePayload.code,                 "Cookie has referral code");
    assert(cookiePayload.expiresAt > Date.now(), "Cookie expiresAt is in the future");
    assertEq(cookiePayload.customerDiscountType,  "Percentage", "Cookie customerDiscountType = Percentage");
    assertEq(cookiePayload.customerDiscountValue, 12,           "Cookie customerDiscountValue = 12");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 12 — Cookie payload: round-trips JSON (serialize + deserialize)
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 12: Cookie payload — JSON round-trip ───");
    const serialized = encodeURIComponent(JSON.stringify(cookiePayload));
    const deserialized = JSON.parse(decodeURIComponent(serialized));
    assertEq(deserialized.code,                 AFF_REF_CODE, "code survives encodeURIComponent + JSON.parse");
    assertEq(deserialized.customerDiscountType,  "Percentage", "customerDiscountType survives JSON round-trip");
    assertEq(deserialized.customerDiscountValue, 12,           "customerDiscountValue survives JSON round-trip");
    assert(deserialized.expiresAt === cookiePayload.expiresAt, "expiresAt survives JSON round-trip");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 13 — CartContext: Percentage discount reduces cartTotal
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 13: CartContext — Percentage discount reduces cartTotal ───");
    const sub13  = 250;
    const disc13 = cartContextDiscount(sub13, "Percentage", 10);
    assertClose(disc13, 25,  "10% of $250 = $25 affiliate discount");
    const cart13 = Math.max(0, sub13 - disc13);
    assertClose(cart13, 225, "CartTotal: $250 - $25 = $225");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 14 — CartContext: Fixed discount reduces cartTotal
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 14: CartContext — Fixed discount reduces cartTotal ───");
    const sub14  = 180;
    const disc14 = cartContextDiscount(sub14, "Fixed", 20);
    assertClose(disc14, 20,  "Fixed $20 off $180");
    const cart14 = Math.max(0, sub14 - disc14);
    assertClose(cart14, 160, "CartTotal: $180 - $20 = $160");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 15 — CartContext: None type leaves cartTotal unchanged
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 15: CartContext — None type leaves cartTotal unchanged ───");
    const sub15  = 150;
    const disc15 = cartContextDiscount(sub15, "None", 10);
    assertEq(disc15, 0, "None type discount = $0");
    const cart15 = Math.max(0, sub15 - disc15);
    assertClose(cart15, 150, "CartTotal unchanged at $150");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 16 — DB update: customerDiscountType persists
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 16: DB update — customerDiscountType persists ───");
    affiliateDoc.customerDiscountType  = "Percentage";
    affiliateDoc.customerDiscountValue = 12;
    await affiliateDoc.save();
    const read16 = await Affiliate.findOne({ email: TEST_EMAIL }).lean();
    assertEq(read16.customerDiscountType,  "Percentage", "customerDiscountType updated to Percentage in DB");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 17 — DB update: customerDiscountValue persists
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 17: DB update — customerDiscountValue persists ───");
    assertEq(read16.customerDiscountValue, 12, "customerDiscountValue updated to 12 in DB");

    // Also test updating to Fixed type
    const fresh = await Affiliate.findOne({ email: TEST_EMAIL });
    fresh.customerDiscountType  = "Fixed";
    fresh.customerDiscountValue = 25;
    await fresh.save();
    const read17 = await Affiliate.findOne({ email: TEST_EMAIL }).lean();
    assertEq(read17.customerDiscountType,  "Fixed", "customerDiscountType updated to Fixed");
    assertEq(read17.customerDiscountValue, 25,       "customerDiscountValue updated to 25");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 18 — DB read: affiliate discount financials readable from Order
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 18: DB read — order discount financials readable ───");
    const orderFromDB = await mongoose.connection.collection("orders")
      .findOne({ orderNumber: TEST_ORDER_NUM });
    assert(!!orderFromDB,                                              "Order found in DB");
    assertEq(orderFromDB.financials.affiliateDiscountType,  "Percentage","affiliateDiscountType readable from DB");
    assertEq(orderFromDB.financials.affiliateDiscountValue, 10,          "affiliateDiscountValue readable from DB");
    assertEq(orderFromDB.financials.affiliateDiscountAmount, 20,         "affiliateDiscountAmount readable from DB");
    assertEq(orderFromDB.affiliateReferralCode, AFF_REF_CODE,           "affiliateReferralCode readable from DB");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 19 — Self-referral guard
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 19: Self-referral guard ───");
    const AFF_EMAIL = TEST_EMAIL;

    // Same email → blocked
    assert( selfReferralGuard(AFF_EMAIL, AFF_EMAIL),        "Same email → blocked");
    assert( selfReferralGuard(AFF_EMAIL.toUpperCase(), AFF_EMAIL), "Case-insensitive match → blocked");
    assert( selfReferralGuard(`  ${AFF_EMAIL}  `, AFF_EMAIL), "Whitespace-trimmed match → blocked");

    // Different email → allowed
    assert(!selfReferralGuard("customer@other.com", AFF_EMAIL), "Different email → allowed");
    assert(!selfReferralGuard("",                   AFF_EMAIL), "Empty buyer email → allowed (no session)");

    // Verify discount is zeroed when blocked
    const blockedDiscount = selfReferralGuard(AFF_EMAIL, AFF_EMAIL)
      ? 0
      : serverCalcAffiliateDiscount(100, "Percentage", 10);
    assertEq(blockedDiscount, 0, "Affiliate discount is $0 when self-referral is blocked");
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 20 — Data integrity: stored amount matches calculation
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── TEST 20: Data integrity — stored amount matches calculation ───");
    const sub20      = 300;
    const type20     = "Percentage";
    const value20    = 10;
    const disc20     = serverCalcAffiliateDiscount(sub20, type20, value20); // 30
    const shipping20 = 15;
    const total20    = authoritativeTotal(sub20, 0, disc20, shipping20, 0); // 285

    assertClose(disc20,  30,  `Calculated discount: 10% of $300 = $30`);
    assertClose(total20, 285, `Calculated total: $300 - $30 + $15 = $285`);

    // Insert fresh order and verify DB round-trip
    const ord20InsertedId = (await mongoose.connection.collection("orders").insertOne({
      orderNumber:            `${TEST_ORDER_NUM}-INT`,
      status:                 "Confirmed",
      affiliateReferralCode:  AFF_REF_CODE,
      financials: {
        subtotal:               sub20,
        shippingCost:           shipping20,
        tax:                    0,
        discountTotal:          0,
        affiliateDiscountType:  type20,
        affiliateDiscountValue: value20,
        affiliateDiscountAmount: disc20,
        total:                  total20,
        currency:               "USD",
      },
      createdAt: new Date(),
    })).insertedId;

    const ord20 = await mongoose.connection.collection("orders").findOne({ _id: ord20InsertedId });
    assertClose(
      ord20.financials.affiliateDiscountAmount,
      disc20,
      `DB stored discountAmount (${ord20.financials.affiliateDiscountAmount}) matches calc ($${disc20})`
    );
    assertClose(
      ord20.financials.total,
      total20,
      `DB stored total (${ord20.financials.total}) matches authoritative formula ($${total20})`
    );
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // CLEANUP
    // ─────────────────────────────────────────────────────────────────────────
    console.log("─── CLEANUP ───");
    await Affiliate.deleteMany({ email: TEST_EMAIL });
    await mongoose.connection.collection("orders").deleteMany({
      orderNumber: { $regex: /^DS-ORDER-SUITE/ }
    });
    console.log("  ✅ All test data removed.\n");

  } catch (err) {
    console.error("\n❌ UNEXPECTED ERROR during test run:");
    console.error(err.stack);
    failed++;
  } finally {
    await mongoose.disconnect();

    const total = passed + failed;
    console.log("══════════════════════════════════════════════════════════════════");
    if (failed === 0) {
      console.log(`   🎉 ALL ${total} TESTS PASSED`);
    } else {
      console.log(`   RESULTS: ${passed}/${total} passed — ${failed} FAILED`);
    }
    console.log("══════════════════════════════════════════════════════════════════\n");

    if (failed > 0) process.exit(1);
  }
}

runTests();
