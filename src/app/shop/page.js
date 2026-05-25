import { Suspense } from "react";
import dbConnect from "@/lib/db";
import Category from "@/models/Category";
import Page from "@/models/Page";
import ShopContentClient from "./ShopContentClient";
import { checkAndApplyRedirect } from "@/lib/redirect-resolver";
import { resolveSEOMetadata } from "@/lib/seo-resolver";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const categorySlug = resolvedSearchParams.category;

  await dbConnect();

  if (categorySlug) {
    const currentPath = `/shop?category=${categorySlug}`;
    await checkAndApplyRedirect(currentPath);

    const category = await Category.findOne({ slug: categorySlug, type: "product" }).lean();
    if (category) {
      const { metadata } = resolveSEOMetadata({
        entity: category,
        type: "category",
        path: currentPath
      });
      return metadata;
    }
  }

  // Check for dynamic shop page override from database
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

  if (categorySlug) {
    const currentPath = `/shop?category=${categorySlug}`;
    await checkAndApplyRedirect(currentPath);
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
      <ShopContentClient initialCategory={categorySlug} initialType={typeSlug} />
    </Suspense>
  );
}