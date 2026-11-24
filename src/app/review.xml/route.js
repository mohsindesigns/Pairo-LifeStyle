import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Review from "@/models/Review";
import Product from "@/models/Product";
import SiteConfig from "@/models/SiteConfig";
import { requireMerchantFeedAuth } from "@/lib/merchantFeedAuth";

export const dynamic = "force-dynamic";

// Google Merchant Center "Product Ratings and Reviews" self-hosted feed, schema 2.3.
// https://support.google.com/merchants/answer/7045492
const FEED_XMLNS = "http://www.google.com/shopping/reviews/schema/product/2.3";

export async function GET(req) {
  const authError = requireMerchantFeedAuth(req);
  if (authError) return authError;

  try {
    await dbConnect();

    const siteConfig = await SiteConfig.findOne({}).lean();
    let domain = siteConfig?.domain || "https://pairolifestyle.com";
    if (!domain.startsWith("http")) {
      domain = `https://${domain}`;
    }
    if (domain.endsWith("/")) {
      domain = domain.slice(0, -1);
    }
    const publisherName = siteConfig?.siteName || "Pairo Lifestyle";

    // Only published/eligible products (not deleted, status is Published, not noIndex) — the
    // same catalogue feed.xml publishes, so every review here matches an entry Merchant Center
    // already has from the products feed. A review whose product no longer qualifies is skipped.
    const products = await Product.find({
      isDeleted: { $ne: true },
      status: "Published",
      "seo.noIndex": { $ne: true },
    })
      .select("name slug sku")
      .lean();
    const productsById = new Map(products.map((p) => [String(p._id), p]));

    // Same safe/public query shape as src/app/api/reviews/verified/route.js: approved, not
    // deleted, not shadow-banned. Select ONLY the fields this feed needs — never customerEmail,
    // ipAddress, userAgent, fingerprint, voters or reporters, which stay private.
    const reviews = await Review.find({
      status: "Approved",
      isDeleted: { $ne: true },
      shadowBanned: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(2000)
      .select("rating title comment customerName createdAt verifiedPurchase productId")
      .lean();

    const escapeXml = (str) => {
      if (!str) return "";
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    };

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="${FEED_XMLNS}">
  <version>2.3</version>
  <publisher>
    <name>${escapeXml(publisherName)}</name>
  </publisher>
`;

    for (const review of reviews) {
      // A review entry without content is invalid per the feed spec — skip rather than publish
      // an empty <content> element.
      const comment = review.comment ? String(review.comment).trim() : "";
      if (!comment) continue;

      const product = productsById.get(String(review.productId));
      if (!product) continue; // product deleted / unpublished / noIndex since the review was written

      const reviewId = review._id.toString();
      const timestamp = new Date(review.createdAt).toISOString();
      const isVerified = review.verifiedPurchase ? "true" : "false";
      // Mirrors feed.xml's <g:mpn> exactly, so a review matches the same catalogue entry
      // Merchant Center already has from the products feed.
      const mpn = escapeXml(product.sku || product._id.toString());
      const productUrl = `${domain}/product/${product.slug || product._id}`;
      const title = review.title ? String(review.title).trim() : "";

      xml += `  <review>
    <review_id>${reviewId}</review_id>
    <reviewer>
      <name>${escapeXml(review.customerName)}</name>
    </reviewer>
    <review_timestamp>${timestamp}</review_timestamp>
`;

      if (title) {
        xml += `    <title>${escapeXml(title)}</title>\n`;
      }

      xml += `    <content>${escapeXml(comment)}</content>
    <is_verified>${isVerified}</is_verified>
    <ratings>
      <overall min="1" max="5">${review.rating}</overall>
    </ratings>
    <products>
      <product>
        <product_ids>
          <mpns>
            <mpn>${mpn}</mpn>
          </mpns>
        </product_ids>
        <product_name>${escapeXml(product.name)}</product_name>
        <product_url>${productUrl}</product_url>
      </product>
    </products>
  </review>
`;
    }

    xml += `</feed>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        // Re-run against the live DB on every request; an explicit no-store also stops a
        // CDN/reverse proxy in front of the app from serving a stale copy of its own accord.
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Error generating review.xml:", error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="${FEED_XMLNS}">\n  <version>2.3</version>\n</feed>`,
      {
        status: 500,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
