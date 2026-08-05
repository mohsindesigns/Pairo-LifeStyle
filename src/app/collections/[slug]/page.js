import { notFound } from "next/navigation";
import { checkAndApplyRedirect } from "@/lib/redirect-resolver";
import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";
import { RESERVED_SLUGS } from "@/lib/redirect-resolver";
import { Suspense } from "react";
import dbConnect from "@/lib/db";
import Category from "@/models/Category";
import ShopContentClient from "@/app/shop/ShopContentClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  
  if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
    return {};
  }

  const currentPath = `/collections/${slug}`;
  await checkAndApplyRedirect(currentPath);

  await dbConnect();
  
  const category = await Category.findOne({ slug: slug, type: "product", isDeleted: { $ne: true } }).lean();
  if (!category) {
    return { title: "Category Not Found" };
  }

  if (category.status === "Draft") {
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/app/api/auth/[...nextauth]/route");
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isStaff) {
      return {
        title: "Category Not Found",
        robots: {
          index: false,
          follow: false
        }
      };
    }
  }

  const { metadata } = await resolveSEOMetadata({
    entity: category,
    type: "category",
    path: currentPath
  });
  return metadata;
}

export default async function DynamicCategoryCatcherPage({ params, searchParams }) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const typeSlug = resolvedSearchParams?.type;

  if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
    notFound();
  }

  const currentPath = `/collections/${slug}`;
  await checkAndApplyRedirect(currentPath);

  await dbConnect();

  const category = await Category.findOne({ slug: slug, type: "product", isDeleted: { $ne: true } }).lean();
  if (!category) {
    notFound();
  }

  if (category.status === "Draft") {
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/app/api/auth/[...nextauth]/route");
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isStaff) {
      notFound();
    }
  }

  const { structuredData } = await resolveSEOMetadata({
    entity: category,
    type: "category",
    path: currentPath
  });

  const { getProductsForShop } = await import("@/lib/products-server");
  const products = await getProductsForShop();

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(structuredData) }}
        />
      )}
      <Suspense fallback={
        <div className="container mx-auto px-4 py-40 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
            <p className="font-bold text-xl uppercase text-black/40 mt-4">Loading Catalog...</p>
          </div>
        </div>
      }>
        <ShopContentClient 
          initialCategory={category.slug} 
          initialType={typeSlug} 
          initialProducts={products} 
          categoryData={JSON.parse(JSON.stringify(category))} 
        />
      </Suspense>
    </>
  );
}
