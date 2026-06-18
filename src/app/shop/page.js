import { Suspense } from "react";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import ShopContentClient from "./ShopContentClient";
import { resolveSEOMetadata } from "@/lib/seo-resolver";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  // If old ?category= format, metadata will be handled by the new /shop/[category] route after redirect
  if (resolvedSearchParams.category) return {};

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

  // Redirect old query-param format to clean path-based URL
  if (categorySlug) {
    const redirectUrl = typeSlug
      ? `/shop/${categorySlug}?type=${typeSlug}`
      : `/shop/${categorySlug}`;
    redirect(redirectUrl);
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