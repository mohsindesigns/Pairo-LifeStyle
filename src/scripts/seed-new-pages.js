/**
 * seed-new-pages.js
 * Seeds 3 new system pages: Custom Jacket, Gallery, Size Chart
 *
 * Run: node src/scripts/seed-new-pages.js
 * Or trigger via: GET /api/admin/seed-new-pages (from browser/dashboard)
 *
 * Idempotent: checks existing slug before inserting.
 */

import mongoose from "mongoose";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { createRequire } from "module";

// Load env
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not set in .env.local");
  process.exit(1);
}

const NEW_PAGES = [
  {
    title: "Custom Jacket",
    slug: "custom-jacket",
    template: "custom-jacket",
    status: "Published",
    isSystem: true,
    isHomePage: false,
    sections: [
      {
        id: "cj-hero-1",
        type: "custom_jacket_hero",
        config: {
          title: "CRAFT YOUR PERFECT JACKET",
          subtitle: "Every jacket is a story. Tell us yours — and we'll bring it to life with premium leather, expert craftsmanship, and timeless style.",
          label: "BESPOKE SERVICE",
          buttonText: "Start Your Journey",
          buttonLink: "#inquiry-form",
          breadcrumb: "Custom Jacket"
        }
      },
      {
        id: "cj-process-1",
        type: "custom_jacket_process",
        config: {
          sectionTitle: "HOW IT WORKS",
          sectionLabel: "THE PROCESS",
          sectionDescription: "We've streamlined the bespoke jacket experience into four elegant steps — from your first idea to your finished masterpiece."
        }
      },
      {
        id: "cj-form-1",
        type: "custom_jacket_form",
        config: {
          formTitle: "START YOUR BESPOKE INQUIRY",
          formSubtitle: "Complete the form below and our expert team will contact you within 24 hours to discuss your vision."
        }
      }
    ],
    seo: {
      title: "Custom Jacket | Bespoke Leather Jackets — PAIRO",
      description: "Design your dream leather jacket with PAIRO's bespoke service. Submit your specifications and our master craftsmen will bring your vision to life.",
      ogImage: ""
    }
  },
  {
    title: "Gallery",
    slug: "gallery",
    template: "gallery",
    status: "Published",
    isSystem: true,
    isHomePage: false,
    sections: [
      {
        id: "gallery-grid-1",
        type: "gallery_grid",
        config: {
          sectionTitle: "OUR WORK",
          sectionLabel: "FEATURED PIECES",
          sectionDescription: "A carefully curated selection of our finest pieces — each one a testament to premium leather craftsmanship.",
          emptyText: "Gallery coming soon. Check back for our latest work."
        }
      }
    ],
    seo: {
      title: "Gallery | PAIRO Leather Jackets Collection",
      description: "Browse our curated gallery of premium leather jackets and accessories. Each piece is handcrafted with the finest materials.",
      ogImage: ""
    }
  },
  {
    title: "Size Chart",
    slug: "size-chart",
    template: "size-chart",
    status: "Published",
    isSystem: true,
    isHomePage: false,
    sections: [
      {
        id: "sc-display-1",
        type: "size_chart_display",
        config: {
          sectionTitle: "SIZE CHARTS",
          sectionLabel: "MEASUREMENTS",
          sectionDescription: "Use these detailed size charts to find your perfect fit. Click any chart to zoom in for a closer look."
        }
      }
    ],
    seo: {
      title: "Size Chart | Find Your Perfect Fit — PAIRO",
      description: "Use our comprehensive size charts to find your perfect leather jacket fit. Available for men's and women's styles.",
      ogImage: ""
    }
  }
];

async function seedPages() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const pagesCollection = db.collection("pages");

    let created = 0;
    let skipped = 0;

    for (const pageData of NEW_PAGES) {
      await pagesCollection.deleteOne({ slug: pageData.slug });

      await pagesCollection.insertOne({
        ...pageData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`✅ Seeded: /${pageData.slug} — "${pageData.title}"`);
      created++;
    }

    console.log(`\n✨ Done! Created: ${created}, Skipped: ${skipped}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  }
}

seedPages();
