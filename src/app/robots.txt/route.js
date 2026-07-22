import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pairolifestyle.com";

  const robots = `User-agent: *
Disallow: /admin
Disallow: /feed
Disallow: /cart
Disallow: /orders
Disallow: /checkout
Disallow: /account
Disallow: /profile
Disallow: /?*
Disallow: /*?add-to-cart=

Sitemap: https://pairolifestyle.com/sitemap.xml
`;

  return new NextResponse(robots, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600"
    }
  });
}
