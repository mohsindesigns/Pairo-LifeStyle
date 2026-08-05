import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import SiteConfig from "@/models/SiteConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();

    const siteConfig = await SiteConfig.findOne({ tenantId: "DEFAULT_STORE" }).lean();
    let domain = siteConfig?.domain || "https://pairolifestyle.com";
    if (!domain.startsWith("http")) {
      domain = `https://${domain}`;
    }
    if (domain.endsWith("/")) {
      domain = domain.slice(0, -1);
    }

    const currency = siteConfig?.commerce?.storeCurrency || "USD";

    // Only published/eligible products (not deleted, status is Published)
    const products = await Product.find({
      isDeleted: { $ne: true },
      status: "Published",
      "seo.noIndex": { $ne: true }
    }).populate('primaryCategory').lean();

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
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>${escapeXml(siteConfig?.siteName || "Pairo Lifestyle")}</title>
    <link>${domain}</link>
    <description>${escapeXml(siteConfig?.description || "Premium Handcrafted Outerwear")}</description>
`;

    for (const prod of products) {
      const id = prod._id.toString();
      const title = escapeXml(prod.name);
      
      // Clean HTML from description for Google Merchant compatibility
      let rawDesc = prod.shortDescription || prod.description || prod.name;
      const cleanDesc = rawDesc ? rawDesc.replace(/<[^>]*>/g, '').trim() : prod.name;
      const description = escapeXml(cleanDesc);
      
      const link = `${domain}/product/${prod.slug || prod._id}`;
      
      // Main image
      const mainImg = prod.image || (prod.images && prod.images[0]) || "";
      let mainImgUrl = "";
      if (mainImg) {
        mainImgUrl = mainImg.startsWith("http") ? mainImg : `${domain}${mainImg}`;
      }

      const availability = (prod.stock > 0 || prod.availabilityStatus === "In Stock") ? "in stock" : "out of stock";
      const brand = escapeXml(siteConfig?.siteName || "PAIRO");
      const sku = escapeXml(prod.sku || prod._id.toString());
      const gCategory = prod.primaryCategory?.name ? escapeXml(prod.primaryCategory.name) : "Apparel &amp; Accessories &gt; Clothing &gt; Outerwear";

      // Basic variant attributes extraction
      let colorValue = "";
      let sizeValue = "";
      if (prod.attributes && Array.isArray(prod.attributes)) {
        const colorAttr = prod.attributes.find(attr => attr.name?.toLowerCase() === "color");
        if (colorAttr && colorAttr.values && colorAttr.values.length > 0) {
          colorValue = colorAttr.values.map(v => v.label || v.value).join("/");
        }
        const sizeAttr = prod.attributes.find(attr => attr.name?.toLowerCase() === "size");
        if (sizeAttr && sizeAttr.values && sizeAttr.values.length > 0) {
          sizeValue = sizeAttr.values.map(v => v.label || v.value).join("/");
        }
      }

      xml += `    <item>
      <g:id>${id}</g:id>
      <g:title>${title}</g:title>
      <g:description>${description}</g:description>
      <g:link>${link}</g:link>
      <g:image_link>${mainImgUrl}</g:image_link>
`;

      // Additional images
      if (prod.images && Array.isArray(prod.images)) {
        const additional = prod.images.filter(img => img !== mainImg);
        for (const img of additional) {
          if (img) {
            const imgUrl = img.startsWith("http") ? img : `${domain}${img}`;
            xml += `      <g:additional_image_link>${imgUrl}</g:additional_image_link>\n`;
          }
        }
      }

      // Sale price vs regular price
      if (prod.compareAtPrice && prod.compareAtPrice > prod.price) {
        xml += `      <g:price>${prod.compareAtPrice.toFixed(2)} ${currency}</g:price>\n`;
        xml += `      <g:sale_price>${prod.price.toFixed(2)} ${currency}</g:sale_price>\n`;
      } else {
        xml += `      <g:price>${prod.price.toFixed(2)} ${currency}</g:price>\n`;
      }

      xml += `      <g:availability>${availability}</g:availability>
      <g:condition>new</g:condition>
      <g:brand>${brand}</g:brand>
      <g:mpn>${sku}</g:mpn>
      <g:google_product_category>${gCategory}</g:google_product_category>
`;

      if (colorValue) {
        xml += `      <g:color>${escapeXml(colorValue)}</g:color>\n`;
      }
      if (sizeValue) {
        xml += `      <g:size>${escapeXml(sizeValue)}</g:size>\n`;
      }

      xml += `    </item>\n`;
    }

    xml += `  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error generating feed.xml:", error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Pairo Lifestyle Product Feed Error</title>
    <link>https://pairolifestyle.com</link>
    <description>An error occurred generating the Google Merchant feed.</description>
  </channel>
</rss>`,
      {
        status: 500,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
        },
      }
    );
  }
}
