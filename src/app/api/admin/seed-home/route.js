import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import SiteConfig from "@/models/SiteConfig";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  try {
    const siteConfig = await SiteConfig.findOne({ key: 'main' }).lean();
    if (!siteConfig) return NextResponse.json({ error: "SiteConfig not found" }, { status: 404 });

    const homePage = {
      title: "Homepage",
      slug: "home",
      status: "Published",
      isSystem: true,
      sections: [
        {
          id: "hero-1",
          type: "hero_slider",
          enabled: true,
          order: 0,
          config: {
            slides: siteConfig.hero.slides,
            brand: siteConfig.brand,
            labels: siteConfig.hero.labels
          }
        },
        {
          id: "new-arrivals-1",
          type: "product_grid",
          enabled: true,
          order: 1,
          config: {
            title: "NEW ARRIVALS",
            seriesLabel: siteConfig.products?.labels?.seriesLabel || "Collection",
            ctaLabel: "Explore Collection",
            limit: 8,
            layout: "carousel"
          }
        },
        {
          id: "marquee-1",
          type: "feature_marquee",
          enabled: true,
          order: 2,
          config: {
            items: [
              { text: "20% Off First" },
              { text: "Express Ship" },
              { text: "Premium Pelt" },
              { text: "30-Day Policy" },
              { text: "Global Reach" },
              { text: "Direct Desk" }
            ],
            speed: 40
          }
        },
        {
          id: "top-selling-1",
          type: "product_grid",
          enabled: true,
          order: 3,
          config: {
            title: "TOP SELLING",
            seriesLabel: siteConfig.products?.labels?.seriesLabel || "Collection",
            ctaLabel: "Shop Top Sellers",
            limit: 8,
            layout: "carousel"
          }
        },
        {
          id: "banner-1",
          type: "banner_feature",
          enabled: true,
          order: 4,
          config: {
             title: "Limited Edition Shearling",
             description: "Premium handcrafted jackets for the modern pioneer.",
             badge1: "Limited Edition",
             badge2: "Winter '24"
          }
        },
        {
          id: "categories-1",
          type: "category_showcase",
          enabled: true,
          order: 5,
          config: {
            title: siteConfig.categories?.title || "Our Collections",
            label: siteConfig.categories?.label || "Pairo Studio",
            viewAll: "Explore All",
            categoryIds: [] 
          }
        },
        {
          id: "blogs-1",
          type: "blog_grid",
          enabled: true,
          order: 6,
          config: {
            title: "OUR JOURNAL",
            label: "BLOG",
            limit: 6,
            readMore: "READ MORE"
          }
        },
        {
          id: "testimonials-1",
          type: "testimonials",
          enabled: true,
          order: 7,
          config: {
            title: siteConfig.testimonials?.title || "CUSTOMER LOVE",
            label: siteConfig.testimonials?.label || "REVIEWS",
            buttonText: siteConfig.testimonials?.buttonText || "WRITE A REVIEW",
            reviews: siteConfig.testimonials?.reviews || []
          }
        }
      ],
      template: "home",
      seo: {
        title: "Pairo | Premium Shearling Jackets",
        description: "Experience the ultimate warmth and luxury with Pairo's handcrafted shearling jackets."
      }
    };

    const updated = await Page.findOneAndUpdate(
      { slug: 'home', tenantId: 'DEFAULT_STORE' },
      { ...homePage, updatedBy: session.user.id },
      { upsert: true, new: true, runValidators: true }
    );

    return NextResponse.json({ message: "Home page seeded", page: updated });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
