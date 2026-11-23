import { permanentRedirect } from "next/navigation";
import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import ShopContentClient from "./ShopContentClient";
import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const categorySlug = resolvedSearchParams.category;
  
  if (categorySlug) {
    const params = new URLSearchParams(resolvedSearchParams);
    params.delete("category");
    const queryString = params.toString();
    const redirectUrl = queryString
      ? `/collections/${categorySlug}?${queryString}`
      : `/collections/${categorySlug}`;
    permanentRedirect(redirectUrl);
  }

  await dbConnect();
  const shopPage = await Page.findOne({ slug: "shop", isDeleted: { $ne: true } }).lean();
  const { metadata } = await resolveSEOMetadata({
    entity: shopPage || {},
    type: "page",
    fallbackTitle: "Shop All | Pairo Store",
    fallbackDesc: "Browse Pairo's handcrafted premium shearling jackets, coats, and accessories.",
    path: "/shop"
  });

  return metadata;
}

export default async function ShopPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const categorySlug = resolvedSearchParams.category;
  const typeSlug = resolvedSearchParams.type;

  // Redirect old query-param format to clean top-level path URL
  if (categorySlug) {
    const params = new URLSearchParams(resolvedSearchParams);
    params.delete("category");
    const queryString = params.toString();
    const redirectUrl = queryString
      ? `/collections/${categorySlug}?${queryString}`
      : `/collections/${categorySlug}`;
    permanentRedirect(redirectUrl);
  }

  const { getProductsForShop } = await import("@/lib/products-server");
  const products = await getProductsForShop();

  const shopPage = await Page.findOne({ slug: "shop", isDeleted: { $ne: true } }).lean();
  const { structuredData } = await resolveSEOMetadata({
    entity: shopPage || {},
    type: "shop",
    fallbackTitle: "Shop All | Pairo Store",
    fallbackDesc: "Browse Pairo's handcrafted premium shearling jackets, coats, and accessories.",
    path: "/shop"
  });

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(structuredData) }}
        />
      )}
      {/* No Suspense here: this route is force-dynamic and its products are loaded before rendering, so a
          "Loading Catalog..." fallback only ever flashed on screen before the real list streamed in. */}
      <ShopContentClient initialCategory={null} initialType={typeSlug} initialProducts={products} />
    </>
  );
}