const mongoose = require('mongoose');

const URI = "mongodb://127.0.0.1:27017/pairo";
process.env.MONGODB_URI = URI;

async function runTests() {
  console.log("==========================================================");
  console.log("   STARTING COMPREHENSIVE AFFILIATE PRODUCTION TESTS      ");
  console.log("==========================================================\n");

  await mongoose.connect(URI);
  console.log("Connected to MongoDB successfully.\n");

  // Dynamically import ESM modules
  const Affiliate = (await import('../models/Affiliate.js')).default;
  const AffiliateApplication = (await import('../models/AffiliateApplication.js')).default;
  const AffiliateClick = (await import('../models/AffiliateClick.js')).default;
  const AffiliateCommission = (await import('../models/AffiliateCommission.js')).default;
  const AffiliatePayout = (await import('../models/AffiliatePayout.js')).default;
  const AffiliateLedger = (await import('../models/AffiliateLedger.js')).default;
  const Order = (await import('../models/Order.js')).default;
  const { CommissionEngine } = await import('../lib/affiliate/CommissionEngine.js');
  const { encrypt, decrypt } = await import('../lib/affiliate/encryption.js');
  const clickQueue = (await import('../lib/affiliate/ClickQueue.js')).default;
  const { can } = await import('../lib/rbac.js');

  const testEmail = "comprehensive_test_partner@pairolifestyle.com";

  // Clean old run records
  await Affiliate.deleteMany({ email: testEmail });
  await AffiliateApplication.deleteMany({ email: testEmail });
  await AffiliateClick.deleteMany({ referralCode: "COMPREHENSIVE" });
  await AffiliateCommission.deleteMany({ orderNumber: "COMP-ORDER-999" });
  await Order.deleteMany({ orderNumber: "COMP-ORDER-999" });
  await mongoose.connection.collection("affiliateledgers").deleteMany({ description: /COMPREHENSIVE|COMP-ORDER-999/ });

  try {
    // -------------------------------------------------------------
    // TEST 1: FIELD-LEVEL ENCRYPTION AND DECRYPTION
    // -------------------------------------------------------------
    console.log("--- TEST 1: FIELD-LEVEL ENCRYPTION & DECRYPTION ---");
    const accountNum = "123-456-789-0";
    const encryptedAcc = encrypt(accountNum);
    const decryptedAcc = decrypt(encryptedAcc);

    if (decryptedAcc !== accountNum) {
      throw new Error(`[FAIL] Encryption mismatch. Decrypted: ${decryptedAcc}, Expected: ${accountNum}`);
    }
    console.log("✅ Symmetric encryption & decryption matches exactly.");

    // Validate legacy plaintext pass-through fallback
    const legacyPlaintext = "PlaintextValue123";
    const processedLegacy = decrypt(legacyPlaintext);
    if (processedLegacy !== legacyPlaintext) {
      throw new Error(`[FAIL] Plaintext fallback failed. Expected original text, got: ${processedLegacy}`);
    }
    console.log("✅ Transparent plaintext fallback for legacy fields verified.\n");


    // -------------------------------------------------------------
    // TEST 2: BANK ROUTING & SWIFT FORMATS VALIDATION
    // -------------------------------------------------------------
    console.log("--- TEST 2: BANK ROUTING & SWIFT FORMATS VALIDATION ---");
    // Invalid Routing Number (not 9 digits)
    let invalidRoutingThrown = false;
    try {
      await Affiliate.create({
        name: "Test User",
        email: testEmail,
        password: "password123",
        affiliateId: "AFF-TEST-ROUTING",
        referralCode: "ROUTINGFAIL",
        bankingInfo: {
          accountHolder: "Test User",
          bankName: "Chase",
          accountNumber: "123",
          routingNumber: "12345" // Invalid (should be 9 digits)
        }
      });
    } catch (e) {
      invalidRoutingThrown = true;
      console.log(`✅ US routing number format validated: caught expected error: "${e.message}"`);
    }
    if (!invalidRoutingThrown) throw new Error("[FAIL] Invalid routing number was saved without error!");

    // Invalid SWIFT Code format
    let invalidSwiftThrown = false;
    try {
      await Affiliate.create({
        name: "Test User",
        email: testEmail,
        password: "password123",
        affiliateId: "AFF-TEST-SWIFT",
        referralCode: "SWIFTFAIL",
        bankingInfo: {
          accountHolder: "Test User",
          bankName: "Chase",
          accountNumber: "123",
          swiftCode: "INVALIDSWIFT" // Invalid (must be 8 or 11 SWIFT character pattern)
        }
      });
    } catch (e) {
      invalidSwiftThrown = true;
      console.log(`✅ SWIFT/BIC code format validated: caught expected error: "${e.message}"\n`);
    }
    if (!invalidSwiftThrown) throw new Error("[FAIL] Invalid SWIFT code was saved without error!");


    // -------------------------------------------------------------
    // TEST 3: IMMUTABLE FINANCIAL LEDGER & IMMUTABILITY GUARDS
    // -------------------------------------------------------------
    console.log("--- TEST 3: IMMUTABLE FINANCIAL LEDGER ENFORCEMENT ---");
    // Create affiliate for ledger checks
    const affiliate = await Affiliate.create({
      name: "Comp Partner",
      email: testEmail,
      password: "password123",
      affiliateId: "AFF-COMP-101",
      referralCode: "COMPREHENSIVE",
      commissionRate: 10,
      balance: 100.00,
      lifetimeEarnings: 100.00,
      bankingInfo: {
        accountHolder: "Comp Partner",
        bankName: "Partner Bank",
        accountNumber: "99887766",
        swiftCode: "BOPUUS33XXX",
        routingNumber: "987654321"
      }
    });

    // Record credit transaction
    const ledgerEntry = await AffiliateLedger.record({
      affiliateId: affiliate._id,
      tenantId: "default",
      type: "Credit",
      amount: 50.00,
      source: "Adjustment",
      description: "COMPREHENSIVE test adjustments"
    });

    const updatedAff = await Affiliate.findById(affiliate._id);
    if (updatedAff.balance !== 150.00) {
      throw new Error(`[FAIL] Ledger balance update misaligned. Balance: ${updatedAff.balance}, Expected: 150.00`);
    }
    console.log("✅ Ledger credit transaction verified. Available balance correctly adjusted: $100 -> $150.");

    // Verify Immutability Hooks (throws error on update)
    let ledgerUpdateBlockThrown = false;
    try {
      await AffiliateLedger.updateOne({ _id: ledgerEntry._id }, { amount: 999.00 });
    } catch (e) {
      ledgerUpdateBlockThrown = true;
      console.log(`✅ Immutability update guard verified: caught expected error: "${e.message}"`);
    }
    if (!ledgerUpdateBlockThrown) throw new Error("[FAIL] Ledger entry updated successfully! Immutability broken.");

    // Verify Immutability Hooks (throws error on delete)
    let ledgerDeleteBlockThrown = false;
    try {
      await AffiliateLedger.deleteOne({ _id: ledgerEntry._id });
    } catch (e) {
      ledgerDeleteBlockThrown = true;
      console.log(`✅ Immutability delete guard verified: caught expected error: "${e.message}"\n`);
    }
    if (!ledgerDeleteBlockThrown) throw new Error("[FAIL] Ledger entry deleted successfully! Immutability broken.");


    // -------------------------------------------------------------
    // TEST 4: COMMISSION LIFECYCLE ENGINE & PRO-RATA REVERSALS
    // -------------------------------------------------------------
    console.log("--- TEST 4: COMMISSION LIFECYCLE & REVERSALS ---");
    const mockOrder = await Order.create({
      orderNumber: "COMP-ORDER-999",
      status: "Confirmed",
      affiliateId: affiliate._id,
      affiliateReferralCode: affiliate.referralCode,
      financials: { subtotal: 500.00 },
      tenantId: "default"
    });

    // A. Calculate Pending Commission
    const pendingComm = await CommissionEngine.calculateCommission(mockOrder, affiliate);
    if (pendingComm.commissionAmount !== 50.00 || pendingComm.status !== 'Pending') {
      throw new Error(`[FAIL] Pending commission calculation failed. Amount: ${pendingComm.commissionAmount}, Status: ${pendingComm.status}`);
    }
    console.log("✅ Pending commission calculated correctly (10% on $500 = $50).");

    // B. Approve Commission -> Credits Balance
    await CommissionEngine.approveCommission(pendingComm._id);
    const postApproveAff = await Affiliate.findById(affiliate._id);
    // Prev balance was 150.00 (updated during ledger credit check), new should be 200.00
    if (postApproveAff.balance !== 200.00) {
      throw new Error(`[FAIL] Approve balance credit failed. Balance: ${postApproveAff.balance}, Expected: 200.00`);
    }
    console.log("✅ Commission approval credited balance correctly ($150 -> $200).");

    // C. Partial Return Pro-Rata Reversal -> Debits Balance
    // Refund $200 out of $500 total order. Pro-rata reversal = $50 * (200 / 500) = $20.00 debit.
    await CommissionEngine.reverseCommission(mockOrder._id, "Refunded", 200.00);
    const postReversalAff = await Affiliate.findById(affiliate._id);
    if (postReversalAff.balance !== 180.00) {
      throw new Error(`[FAIL] Pro-rata partial refund reversal failed. Balance: ${postReversalAff.balance}, Expected: 180.00`);
    }
    console.log("✅ Pro-rata partial refund reversed correctly ($200 refund of $500 order debited -$20 commission. Balance: $180).\n");


    // -------------------------------------------------------------
    // TEST 5: CLICK BATCH BUFFERING (CLICKQUEUE) & telemetry
    // -------------------------------------------------------------
    console.log("--- TEST 5: TELEMETRY CLICKQUEUE BATCH BUFFERING ---");
    // Verify ClickQueue enqueues clicks and batch-writes to DB
    const clickData = {
      affiliateId: affiliate._id,
      referralCode: affiliate.referralCode,
      landingPage: "/shop",
      referrer: "google.com",
      ip: "10.0.0.1",
      userAgent: "TestBrowser",
      tenantId: "default",
      utmParameters: { source: "test" }
    };

    await clickQueue.enqueue(clickData);
    
    // Check if immediately saved (should not be saved yet since batch size is 100 and timer is 5s)
    let immediateCheck = await AffiliateClick.findOne({ referralCode: affiliate.referralCode, ip: "10.0.0.1" });
    if (immediateCheck) {
      throw new Error("[FAIL] Click persisted immediately. Buffering not active!");
    }
    console.log("✅ Click enqueued inside memory queue buffer.");

    // Force flush
    await clickQueue.flush();

    let flushedCheck = await AffiliateClick.findOne({ referralCode: affiliate.referralCode, ip: "10.0.0.1" });
    if (!flushedCheck) {
      throw new Error("[FAIL] Click was not persisted after manual queue flush!");
    }
    console.log("✅ Click successfully written to database in batch write flush.\n");


    // -------------------------------------------------------------
    // TEST 6: OPTIMISTIC CONCURRENCY CONTROL (OCC)
    // -------------------------------------------------------------
    console.log("--- TEST 6: OPTIMISTIC CONCURRENCY CONTROL (OCC) ---");
    const doc1 = await Affiliate.findById(affiliate._id);
    const doc2 = await Affiliate.findById(affiliate._id);

    // Save doc1 -> Increments version
    doc1.name = "First Update";
    await doc1.save();

    // Save doc2 (loaded at same initial version) -> must fail
    doc2.name = "Concurrent Update";
    let occSuccess = false;
    try {
      await doc2.save();
      occSuccess = true;
    } catch (e) {
      console.log(`✅ OCC conflict lock verified: concurrent write blocked with VersionError: "${e.message}"\n`);
    }
    if (occSuccess) {
      throw new Error("[FAIL] Concurrent database write was allowed! OCC broken.");
    }


    // -------------------------------------------------------------
    // TEST 7: RBAC MATRIX GRIDS
    // -------------------------------------------------------------
    console.log("--- TEST 7: ROLE-BASED ACCESS CONTROL (RBAC) MATRICES ---");
    // Mock user roles conforming to role schemas
    const superAdmin = { role: { slug: "super-admin" }, isStaff: true };
    const customStaff = { role: { slug: "affiliate-manager", permissions: { affiliates: ["view", "manage"] } }, isStaff: true };
    const guestUser = { role: { slug: "guest", permissions: {} }, isStaff: false };
    
    const adminView = can(superAdmin, "affiliates.view");
    const adminManage = can(superAdmin, "affiliates.manage");
    const staffView = can(customStaff, "affiliates.view");
    const staffManage = can(customStaff, "affiliates.manage");
    const guestView = can(guestUser, "affiliates.view");

    if (!adminView || !adminManage || !staffView || !staffManage || guestView) {
      throw new Error(`[FAIL] RBAC verification failed. adminView=${adminView}, adminManage=${adminManage}, staffView=${staffView}, guestView=${guestView}`);
    }
    console.log("✅ RBAC module permissions matrix checked and verified successfully.\n");


    // -------------------------------------------------------------
    // CLEANUP AND FINALIZE
    // -------------------------------------------------------------
    console.log("--- INTEGRATION TESTS CLEANUP ---");
    await Affiliate.deleteMany({ email: testEmail });
    await AffiliateApplication.deleteMany({ email: testEmail });
    await AffiliateClick.deleteMany({ referralCode: affiliate.referralCode });
    await AffiliateCommission.deleteMany({ affiliateId: affiliate._id });
    await Order.deleteMany({ orderNumber: mockOrder.orderNumber });
    // Manually delete ledger entries by disabling pre-delete validation bypass or bypassing hooks.
    // In mongoose, we can use direct mongodb native collection driver deletes to bypass schema hooks for test cleanup!
    await mongoose.connection.collection("affiliateledgers").deleteMany({ affiliateId: affiliate._id });
    console.log("✅ Test data cleaned up successfully.");

    console.log("\n==========================================================");
    console.log("   🎉 ALL AFFILIATE PRODUCTION TESTS COMPLETED SUCCESSFULLY!  ");
    console.log("==========================================================");

  } catch (err) {
    console.error("\n❌ COMPREHENSIVE PRODUCTION TEST RUN FAILED!");
    console.error(err.stack);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
