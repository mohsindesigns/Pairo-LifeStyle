/**
 * seed-corporate-gifting-page.js
 * Creates the Corporate Gifting CMS page (/customize-corporate-gifting) with sample content.
 *
 * Run: node src/scripts/seed-corporate-gifting-page.js
 *
 * Safe: if a page with this slug already exists it is left untouched (never overwritten).
 * Everything seeded here is editable afterwards in Admin → Pages → the page builder.
 */

import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set in .env.local");
  process.exit(1);
}

const SLUG = "customize-corporate-gifting";

const section = (type, config = {}) => ({
  id: Math.random().toString(36).slice(2, 11),
  type,
  enabled: true,
  config,
  overrides: { padding: "py-0", background: "transparent", customClasses: "" },
});

const sections = [
  section("corporate_gifting_hero"),
  section("feature_marquee", {
    items: [
      { text: "Free shipping worldwide", icon: "Truck" },
      { text: "Made to order", icon: "Scissors" },
      { text: "Logo embossing", icon: "Stamp" },
      { text: "Bulk pricing", icon: "Tag" },
      { text: "Premium gift boxes", icon: "Gift" },
    ],
  }),
  section("corporate_gifting_process"),
  section("corporate_gifting_form"),
  section("trust_badges", {
    items: [
      { title: "Free worldwide", description: "Shipping", icon: "Globe" },
      { title: "100% secure", description: "Checkout", icon: "Lock" },
      { title: "32-day", description: "Return policy", icon: "RefreshCw" },
    ],
  }),
].map((s, i) => ({ ...s, order: i }));

async function run() {
  await mongoose.connect(MONGODB_URI);
  const pages = mongoose.connection.db.collection("pages");

  const existing = await pages.findOne({ slug: SLUG });
  if (existing) {
    console.log(`/${SLUG} already exists - left untouched.`);
    process.exit(0);
  }

  await pages.insertOne({
    title: "Customize Corporate Gifting",
    slug: SLUG,
    description: "Design custom corporate gift packs with premium leather items and your logo.",
    template: "corporate-gifting",
    status: "Published",
    isSystem: false,
    sections,
    seo: {
      title: "Customize Corporate Gifting | Pairo Lifestyle",
      description:
        "Design custom corporate gift packs with premium leather items, logo embossing, and branded packaging. Get a quote within 24 hours from Pairo Lifestyle.",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`Created /${SLUG}`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
