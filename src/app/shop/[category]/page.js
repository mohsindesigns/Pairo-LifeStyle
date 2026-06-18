import { Suspense } from "react";
import dbConnect from "@/lib/db";
import Category from "@/models/Category";
import Page from "@/models/Page";
import ShopContentClient from "../ShopContentClient";
import { resolveSEOMetadata } from "@/lib/seo-resolver";
import { checkAndApplyRedirect } from "@/lib/redirect-resolver";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const categorySlug = resolvedParams.category;

  await dbConnect();

  const currentPath = `/shop/${categorySlug}`;
  await checkAndApplyRedirect(currentPath);

  const mongoose = require("mongoose");
  let category;
  if (mongoose.Types.ObjectId.isValid(categorySlug)) {
    category = await Category.findOne({ _id: categorySlug, type: "product" }).lean();
  } else {
    category = await Category.findOne({ slug: categorySlug, type: "product" }).lean();
  }

  if (category) {
    const { metadata } = resolveSEOMetadata({
      entity: category,
      type: "category",
      path: currentPath
    });
    return metadata;
  }

  // Fallback to generic shop metadata
  const shopPage = await Page.findOne({ slug: "shop" }).lean();
  const { metadata } = resolveSEOMetadata({
    entity: shopPage || {},
    type: "page",
    fallbackTitle: "Shop All | Pairo Store",
    fallbackDesc: "Browse Pairo's handcrafted premium shearling jackets, coats, and accessories.",
    path: currentPath
  });

  return metadata;
}

export default async function ShopCategoryPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const categorySlug = resolvedParams.category;
  const typeSlug = resolvedSearchParams?.type;

  const currentPath = `/shop/${categorySlug}`;
  await checkAndApplyRedirect(currentPath);

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
