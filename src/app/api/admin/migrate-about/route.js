import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import siteData from "@/lib/data.json";

export async function GET() {
  try {
    await dbConnect();
    const { about } = siteData;

    const aboutPageData = {
      title: "About Pairo",
      slug: "about",
      status: "Published",
      sections: [
        {
          id: crypto.randomUUID(),
          type: "about_hero",
          enabled: true,
          order: 0,
          config: {
            title: about.hero.title,
            subtitle: about.hero.subtitle,
            label: about.hero.label,
            image: about.hero.image,
            buttonText: about.hero.buttonText,
            link: "/shop",
            marqueeEnabled: "true"
          }
        },
        {
          id: crypto.randomUUID(),
          type: "story_section",
          enabled: true,
          order: 1,
          config: {
            title: about.story.title,
            label: about.story.label,
            description: about.story.description,
            image: about.story.image,
            features: about.story.features.map(f => ({
              title: f.title,
              desc: f.desc
            }))
          }
        },
        {
          id: crypto.randomUUID(),
          type: "studio_gallery",
          enabled: true,
          order: 2,
          config: {
            title: about.studio.title,
            label: about.studio.label,
            images: about.studio.images.map(img => ({ url: img }))
          }
        },
        {
          id: crypto.randomUUID(),
          type: "promise_section",
          enabled: true,
          order: 3,
          config: {
            title: about.promise.title,
            label: about.promise.label,
            description: about.promise.description,
            image: about.promise.image,
            items: about.promise.items.map(item => ({
              title: item.title,
              desc: item.desc
            })),
            stats: about.promise.stats.map(stat => ({
              label: stat.label,
              value: stat.value
            }))
          }
        },
        {
          id: crypto.randomUUID(),
          type: "cta_section",
          enabled: true,
          order: 4,
          config: {
            title: about.cta.title,
            primaryBtnLabel: about.cta.shopNow,
            primaryBtnLink: "/shop",
            secondaryBtnLabel: about.cta.contactUs,
            secondaryBtnLink: "/contact"
          }
        }
      ],
      seo: {
        title: "About Us | Pairo - Premium Shearling Jackets",
        description: about.hero.subtitle,
        noIndex: false
      }
    };

    // Upsert the About page
    await Page.findOneAndUpdate(
      { slug: "about" },
      aboutPageData,
      { upsert: true, new: true }
    );

    return NextResponse.json({ message: "About page migrated successfully", data: aboutPageData });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ error: "Failed to migrate About page" }, { status: 500 });
  }
}
