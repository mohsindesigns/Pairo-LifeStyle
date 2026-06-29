import { permanentRedirect } from "next/navigation";
import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import ShopContentClient from "./ShopContentClient";
import { resolveSEOMetadata } from "@/lib/seo-resolver";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const categorySlug = resolvedSearchParams.category;
  
  if (categorySlug) {
    const params = new URLSearchParams(resolvedSearchParams);
    params.delete("category");
    const queryString = params.toString();
    const redirectUrl = queryString
      ? `/${categorySlug}?${queryString}`
      : `/${categorySlug}`;
    permanentRedirect(redirectUrl);
  }

  await dbConnect();
  const shopPage = await Page.findOne({ slug: "shop" }).lean();
  const { metadata } = resolveSEOMetadata({
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
      ? `/${categorySlug}?${queryString}`
      : `/${categorySlug}`;
    permanentRedirect(redirectUrl);
  }

  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-40 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          <p className="font-bold text-xl uppercase text-black/40 mt-4">Loading Catalog...</p>
        </div>
      </div>
    }>
      <ShopContentClient initialCategory={null} initialType={typeSlug} />
    </Suspense>
  );
}