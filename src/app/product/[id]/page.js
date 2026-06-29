import Image from "next/image";
import { Star, ChevronRight, ScrollText } from "lucide-react";
import ProductSection from "@/components/home/ProductSection";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import "@/models/Category"; 
import Link from "next/link";
import ClientProductActions from "@/components/product/ClientProductActions";
import ClientTabSystem from "@/components/product/ClientTabSystem";
import ProductMainSection from "@/components/product/ProductMainSection";
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
  }).populate('categories').populate('primaryCategory').lean();

  if (!product) return { title: "Product Not Found" };

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

  const { metadata } = resolveSEOMetadata({
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
    .populate('categories')
    .populate('primaryCategory')
    .lean();

  if (!product) {
    notFound();
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

  const { structuredData } = resolveSEOMetadata({
    entity: product,
    type: "product",
    path: currentPath,
    reviews
  });

  return (
    <div className="bg-white min-h-screen font-sans">
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(structuredData) }}
        />
      )}
      <div className="container mx-auto px-4 sm:px-6 md:px-16 py-4 md:py-8">

        <ProductMainSection product={sanitizedProduct} />

        <ClientTabSystem product={sanitizedProduct} />

        {/* Narrative Section */}
        {product.narrative?.content && (
          <div className="mt-16 md:mt-24 bg-white border border-border rounded-[var(--radius,0px)] p-8 md:p-16 overflow-hidden relative group">
             <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-48 -mt-48 transition-all group-hover:bg-primary/[0.08]" />
             <div className="max-w-3xl relative z-10">
                <div className="flex items-center gap-3 mb-6">
                   <div className="p-2.5 bg-primary text-white rounded-[var(--radius,0px)]"><ScrollText className="w-4 h-4" /></div>
                   <span className="text-[9px] font-medium uppercase tracking-[0.25em] text-primary/60">{product.narrative.title || "The Story"}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-medium heading-font uppercase tracking-wider mb-6 leading-[1.2] text-primary">
                   {product.name} <br/> 
                   <span className="text-primary/30 font-normal">Masterpiece Narrative</span>
                </h2>
                <div className="text-sm md:text-base text-primary/70 leading-relaxed font-normal" dangerouslySetInnerHTML={{ __html: product.narrative.content.replace(/\n/g, '<br/>') }} />
             </div>
          </div>
        )}
      </div>

      <div className="border-t border-black/5">
        <ProductSection title="Related Products" products={sanitizedRelated} />
      </div>
    </div>
  );
}
