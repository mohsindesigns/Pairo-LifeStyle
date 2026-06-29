import { notFound } from "next/navigation";
import { resolvePageSections } from "@/lib/page-data-resolver";
import { checkAndApplyRedirect } from "@/lib/redirect-resolver";
import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";
import { RESERVED_SLUGS } from "@/lib/redirect-resolver";
import { resolvePageAndTemplate } from "@/lib/page-cache";
import { Suspense } from "react";
import dbConnect from "@/lib/db";
import Category from "@/models/Category";
import ShopContentClient from "../shop/ShopContentClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  
  if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
    return {};
  }

  const currentPath = `/${slug}`;
  await checkAndApplyRedirect(currentPath);

  await dbConnect();
  
  // 1. Check if category slug
  const category = await Category.findOne({ slug: slug, type: "product", isDeleted: { $ne: true } }).lean();
  if (category) {
    const { metadata } = resolveSEOMetadata({
      entity: category,
      type: "category",
      path: currentPath
    });
    return metadata;
  }

  // 2. Check if custom page
  const { page } = await resolvePageAndTemplate(slug, "default");
  
  if (!page || page.status !== "Published") {
    return { title: "Page Not Found" };
  }

  const { metadata } = resolveSEOMetadata({
    entity: page,
    type: "page",
    path: currentPath
  });

  return metadata;
}

export default async function CatchAllCMSPage({ params, searchParams }) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const typeSlug = resolvedSearchParams?.type;

  if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
    notFound();
  }

  const currentPath = `/${slug}`;
  await checkAndApplyRedirect(currentPath);

  await dbConnect();

  // 1. Try to find as category page first
  const category = await Category.findOne({ slug: slug, type: "product", isDeleted: { $ne: true } }).lean();
  if (category) {
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
        <ShopContentClient initialCategory={category.slug} initialType={typeSlug} />
      </Suspense>
    );
  }

  // 2. Try to find as custom CMS page
  const { page, templateInfo } = await resolvePageAndTemplate(slug, "default");

  if (!page || page.status !== "Published") {
    notFound();
  }

  let resolvedSections = [];
  if (page.sections?.length > 0) {
    resolvedSections = await resolvePageSections(page.sections);
  }

  // Ensure sections are sorted correctly
  const sortedSections = JSON.parse(
    JSON.stringify(resolvedSections.sort((a, b) => (a.order || 0) - (b.order || 0)))
  );

  const { structuredData } = resolveSEOMetadata({
    entity: page,
    type: "page",
    path: currentPath
  });

  const TemplateComponent = templateInfo.component;

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(structuredData) }}
        />
      )}
      <TemplateComponent page={page} sections={sortedSections} />
    </>
  );
}
