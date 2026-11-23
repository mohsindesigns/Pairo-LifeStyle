// One-time backfill: populates `specificCustomerEmails`/`notifiedCustomerEmails` on any
// existing Discount that already restricts itself to specific customers via the older
// `specificCustomers` (Customer ObjectId) field, from before that was paired with a raw
// email list. Required so the new diff-based "only email genuinely new recipients" logic
// in src/app/api/admin/discounts/route.js has an accurate baseline to compare against —
// without this, the very next edit to any pre-existing customer-restricted coupon would
// treat its already-known customers as newly added and re-send them the "gift code" email.
// Marks them as already-notified (not freshly notified) since they presumably already know
// about/have used a coupon that already existed. Safe to re-run — skips anything already
// backfilled.
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DiscountSchema = new mongoose.Schema({}, { strict: false });
const CustomerSchema = new mongoose.Schema({}, { strict: false });
const Discount = mongoose.models.Discount || mongoose.model('Discount', DiscountSchema);
const Customer = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not found');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const discounts = await Discount.find({
    specificCustomers: { $exists: true, $not: { $size: 0 } },
  });
  console.log(`Found ${discounts.length} coupon(s) with a specificCustomers restriction`);

  let backfilled = 0;
  let skipped = 0;
  for (const discount of discounts) {
    if (Array.isArray(discount.specificCustomerEmails) && discount.specificCustomerEmails.length > 0) {
      skipped++;
      continue;
    }
    const customers = await Customer.find({ _id: { $in: discount.specificCustomers } }).select('email');
    const emails = [...new Set(customers.map((c) => String(c.email || '').toLowerCase().trim()).filter(Boolean))];
    if (emails.length === 0) {
      skipped++;
      continue;
    }
    discount.specificCustomerEmails = emails;
    discount.notifiedCustomerEmails = emails;
    await discount.save();
    backfilled++;
    console.log(`  Backfilled "${discount.code}": ${emails.join(', ')}`);
  }

  console.log(`\nDone. Backfilled: ${backfilled}, skipped (already had data or no resolvable emails): ${skipped}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
