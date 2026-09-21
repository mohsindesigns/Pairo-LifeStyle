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
    const adminDisallows = `Disallow: /admin
Disallow: /admin/
Disallow: /admin-login
Disallow: /api/admin
Disallow: /api/admin/`;

    robots = `User-agent: *
Allow: /feed.xml
${adminDisallows}
Disallow: /feed
Disallow: /cart
Disallow: /orders
Disallow: /checkout
Disallow: /account
Disallow: /profile
Disallow: /?*
Disallow: /*?add-to-cart=

User-agent: Googlebot
Allow: /
${adminDisallows}

User-agent: Google-Extended
Allow: /
${adminDisallows}

User-agent: GoogleOther
Allow: /
${adminDisallows}

User-agent: AhrefsBot
Allow: /
${adminDisallows}

User-agent: GPTBot
Allow: /
${adminDisallows}

User-agent: ChatGPT-User
Allow: /
${adminDisallows}

User-agent: OAI-SearchBot
Allow: /
${adminDisallows}

User-agent: ClaudeBot
Allow: /
${adminDisallows}

User-agent: Claude-Web
Allow: /
${adminDisallows}

User-agent: PerplexityBot
Allow: /
${adminDisallows}

User-agent: Perplexity-User
Allow: /
${adminDisallows}

User-agent: Applebot
Allow: /
${adminDisallows}

User-agent: Applebot-Extended
Allow: /
${adminDisallows}

User-agent: Bytespider
Allow: /
${adminDisallows}

User-agent: Meta-ExternalAgent
Allow: /
${adminDisallows}

User-agent: Meta-ExternalFetcher
Allow: /
${adminDisallows}

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
