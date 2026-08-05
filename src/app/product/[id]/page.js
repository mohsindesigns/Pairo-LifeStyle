import Image from "next/image";
import { Star, ChevronRight, ScrollText } from "lucide-react";
import ProductSection from "@/components/home/ProductSection";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import "@/models/Category";
import "@/models/SizeChart";
import Link from "next/link";
import ClientProductActions from "@/components/product/ClientProductActions";
import ClientTabSystem from "@/components/product/ClientTabSystem";
import ProductMainSection from "@/components/product/ProductMainSection";
import ProductProcessSection from "@/components/product/ProductProcessSection";
import { checkAndApplyRedirect } from "@/lib/redirect-resolver";
import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";
import Review from "@/models/Review";
import mongoose from "mongoose";
import { permanentRedirect, notFound } from "next/navigation";
import { getProductPrimaryCategorySlug } from "@/lib/routes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const paramId = resolvedParams.id;

  const currentPath = `/product/${paramId}`;
  await checkAndApplyRedirect(currentPath);

  await dbConnect();

  const isMongoId = mongoose.isValidObjectId(paramId);
  const queryOr = [
    { slug: paramId }
  ];
  if (/^\d+$/.test(paramId)) {
    queryOr.push({ id: parseInt(paramId) });
  }
  if (isMongoId) {
    queryOr.push({ _id: paramId });
  }

  const product = await Product.findOne({
    $or: queryOr,
    isDeleted: { $ne: true }
  }).populate({
    path: 'categories',
    populate: { path: 'sizeChart' }
  }).populate({
    path: 'primaryCategory',
    populate: { path: 'sizeChart' }
  }).populate('sizeChart').lean();

  if (!product) return { title: "Product Not Found" };

  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("@/app/api/auth/[...nextauth]/route");
  const session = await getServerSession(authOptions);

  if (product.status === "Draft") {
    if (!session || !session.user?.isStaff) {
      return {
        title: "Product Not Found",
        robots: {
          index: false,
          follow: false
        }
      };
    }
  }

  if (product.slug !== paramId) {
    const paramsQuery = new URLSearchParams(resolvedSearchParams);
    const queryString = paramsQuery.toString();
    const destUrl = queryString ? `/product/${product.slug}?${queryString}` : `/product/${product.slug}`;
    permanentRedirect(destUrl);
  }

  const reviews = await Review.find({
    productId: product._id,
    status: "Approved",
    isDeleted: { $ne: true }
  }).limit(5).lean();

  const { metadata } = await resolveSEOMetadata({
    entity: product,
    type: "product",
    path: currentPath,
    reviews
  });

  return metadata;
}

export default async function ProductDetailPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const paramId = resolvedParams.id;

  const currentPath = `/product/${paramId}`;
  await checkAndApplyRedirect(currentPath);

  await dbConnect();

  const isMongoId = mongoose.isValidObjectId(paramId);
  const queryOr = [
    { slug: paramId }
  ];
  if (/^\d+$/.test(paramId)) {
    queryOr.push({ id: parseInt(paramId) });
  }
  if (isMongoId) {
    queryOr.push({ _id: paramId });
  }

  const product = await Product.findOne({
    $or: queryOr,
    isDeleted: { $ne: true }
  })
    .populate({
      path: 'categories',
      populate: { path: 'sizeChart' }
    })
    .populate({
      path: 'primaryCategory',
      populate: { path: 'sizeChart' }
    })
    .populate('sizeChart')
    .lean();

  if (!product) {
    notFound();
  }

  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("@/app/api/auth/[...nextauth]/route");
  const session = await getServerSession(authOptions);

  if (product.status === "Draft") {
    if (!session || !session.user?.isStaff) {
      notFound();
    }
  }

  if (product.slug !== paramId) {
    const paramsQuery = new URLSearchParams(resolvedSearchParams);
    const queryString = paramsQuery.toString();
    const destUrl = queryString ? `/product/${product.slug}?${queryString}` : `/product/${product.slug}`;
    permanentRedirect(destUrl);
  }

  // Get primary category info for breadcrumbs
  // Only use populated objects (have .slug/.name). If populate didn't resolve (deleted cat), skip to next.
  const primaryCategory = (() => {
    const candidate = product.primaryCategory || (product.categories && product.categories[0]);
    if (candidate && typeof candidate === 'object' && candidate.slug && candidate.name) return candidate;
    // Try the rest of categories[] if first was unpopulated
    if (product.categories) {
      for (const cat of product.categories) {
        if (cat && typeof cat === 'object' && cat.slug && cat.name) return cat;
      }
    }
    return null;
  })();

  const { getAltTextMap } = await import("@/lib/mediaUsage");
  const allUrls = [
    ...(product.images || []),
    product.image,
    ...(product.variantCombinations || []).map(v => v.image)
  ].filter(Boolean);

  const relatedProducts = await Product.find({
    isDeleted: { $ne: true },
    status: 'Published'
  }).populate('categories').populate('primaryCategory').limit(4).lean();

  relatedProducts.forEach(rp => {
    allUrls.push(...(rp.images || []), rp.image);
  });

  const altMap = await getAltTextMap(allUrls);
  product.imageAlts = altMap;
  relatedProducts.forEach(rp => {
    rp.imageAlts = altMap;
  });

  const sanitizedProduct = JSON.parse(JSON.stringify(product));
  const sanitizedRelated = JSON.parse(JSON.stringify(relatedProducts));

  const reviews = await Review.find({
    productId: product._id,
    status: "Approved",
    isDeleted: { $ne: true }
  }).limit(5).lean();

  const { structuredData } = await resolveSEOMetadata({
    entity: product,
    type: "product",
    path: currentPath,
    reviews
  });

  return (
    <div className="bg-white min-h-screen font-sans overflow-x-visible">
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(structuredData) }}
        />
      )}
      <div className="container mx-auto px-2 sm:px-4 md:px-8 py-2 md:py-4">

        <ProductMainSection product={sanitizedProduct} />

        <ClientTabSystem product={sanitizedProduct} />

        {/* Narrative Section */}
        {product.narrative?.content && (
          <div className="mt-10 md:mt-16 bg-white border border-border rounded-[var(--radius,0px)] p-6 md:p-12 overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-48 -mt-48 transition-all group-hover:bg-primary/[0.08]" />
            <div className="max-w-3xl relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-primary text-white rounded-[var(--radius,0px)]"><ScrollText className="w-4 h-4" /></div>
                <span className="text-[9px] font-medium uppercase tracking-[0.25em] text-primary/60">{product.narrative.title || "The Story"}</span>
              </div>
              <p className="text-[22px] md:text-[30px] font-medium heading-font uppercase tracking-wider mb-6 leading-[1.2] text-primary">
                {product.name} <br />
                <span className="text-primary/30 font-normal">Masterpiece Narrative</span>
              </p>
              <div className="text-sm md:text-base text-primary/70 leading-relaxed font-normal" dangerouslySetInnerHTML={{ __html: product.narrative.content.replace(/\n/g, '<br/>') }} />
            </div>
          </div>
        )}
      </div>

      {/* Process section — full-width with its own container */}
      <ProductProcessSection />

      <div className="border-t border-black/5">
        <ProductSection title="Related Products" products={sanitizedRelated} />
      </div>
    </div>
  );
}
