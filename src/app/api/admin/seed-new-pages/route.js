import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";

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
          sectionDescription: "We've streamlined the bespoke jacket experience into four elegant steps."
        }
      },
      {
        id: "cj-form-1",
        type: "custom_jacket_form",
        config: {
          formTitle: "START YOUR BESPOKE INQUIRY",
          formSubtitle: "Complete the form below and our expert team will contact you within 24 hours."
        }
      }
    ],
    seo: {
      title: "Custom Jacket | Bespoke Leather Jackets — PAIRO",
      description: "Design your dream leather jacket with PAIRO's bespoke service.",
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
          sectionDescription: "A carefully curated selection of our finest pieces.",
          emptyText: "Gallery coming soon."
        }
      }
    ],
    seo: {
      title: "Gallery | PAIRO Leather Jackets Collection",
      description: "Browse our curated gallery of premium leather jackets and accessories.",
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
          sectionDescription: "Use these detailed size charts to find your perfect fit."
        }
      }
    ],
    seo: {
      title: "Size Chart | Find Your Perfect Fit — PAIRO",
      description: "Use our comprehensive size charts to find your perfect leather jacket fit.",
      ogImage: ""
    }
  }
];

export async function POST(req) {
  // Admin only
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "pages.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await dbConnect();
    const db = mongoose.connection.db;
    const pagesCollection = db.collection("pages");

    const results = [];

    for (const pageData of NEW_PAGES) {
      await pagesCollection.deleteOne({ slug: pageData.slug });

      await pagesCollection.insertOne({
        ...pageData,
        tenantId: "DEFAULT_STORE",
        createdAt: new Date(),
        updatedAt: new Date()
      });

      results.push({ slug: pageData.slug, status: "seeded", title: pageData.title });
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("[Seed New Pages Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
