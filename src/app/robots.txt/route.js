import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import SiteConfig from "@/models/SiteConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  await dbConnect();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pairolifestyle.com";

  const siteConfig = await SiteConfig.findOne({ key: 'main' }).lean();
  const isGlobalNoIndex = siteConfig?.disableSearchEngineIndexing === true;

  let robots = "";
  if (isGlobalNoIndex) {
    robots = `User-agent: *
Disallow: /
`;
  } else {
    robots = `User-agent: *
Disallow: /admin
Disallow: /feed
Allow: /feed.xml
Disallow: /cart
Disallow: /orders
Disallow: /checkout
Disallow: /account
Disallow: /profile
Disallow: /?*
Disallow: /*?add-to-cart=

Sitemap: ${siteUrl}/sitemap.xml
`;
  }

  return new NextResponse(robots, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
    }
  });
}
