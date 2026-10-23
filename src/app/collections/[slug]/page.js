import { notFound } from "next/navigation";
import { checkAndApplyRedirect } from "@/lib/redirect-resolver";
import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";
import { RESERVED_SLUGS } from "@/lib/redirect-resolver";
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
      {/* No Suspense here: this route is force-dynamic and its products are loaded before rendering, so a
          "Loading Catalog..." fallback only ever flashed on screen before the real list streamed in. */}
      <ShopContentClient 
        initialCategory={category.slug} 
        initialType={typeSlug} 
        initialProducts={products} 
        categoryData={JSON.parse(JSON.stringify(category))} 
      />
    </>
  );
}
