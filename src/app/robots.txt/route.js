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
Allow: /feed.xml
Disallow: /admin
Disallow: /feed
Disallow: /cart
Disallow: /orders
Disallow: /checkout
Disallow: /account
Disallow: /profile
Disallow: /?*
Disallow: /*?add-to-cart=

User-agent: AhrefsBot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: GoogleOther
Allow: /

User-agent: Applebot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Bytespider
Allow: /

User-agent: Meta-ExternalAgent
Allow: /

User-agent: Meta-ExternalFetcher
Allow: /

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
