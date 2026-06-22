import Image from "next/image";
import { Star, Plus, Minus, ShoppingBag, ShieldCheck, RefreshCw, Truck, ChevronRight, FileText, HelpCircle, User, Check, Zap, Layers, ScrollText, Award } from "lucide-react";
import ProductSection from "@/components/home/ProductSection";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import "@/models/Category"; // Register schema so populate('categories') works
import Link from "next/link";
import ClientProductActions from "@/components/product/ClientProductActions";
import ClientTabSystem from "@/components/product/ClientTabSystem";
import ProductMainSection from "@/components/product/ProductMainSection";
import { getOptimizedImage, getCloudinarySrcSet } from "@/lib/cloudinary";
import { checkAndApplyRedirect } from "@/lib/redirect-resolver";
import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";
import Review from "@/models/Review";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  await dbConnect();
  
  const currentPath = `/product/${resolvedParams.id}`;
  await checkAndApplyRedirect(currentPath);

  const idOrSlug = resolvedParams.id;
  const isMongoId = mongoose.isValidObjectId(idOrSlug);
  const product = await Product.findOne({ 
    $or: [
      { _id: isMongoId ? idOrSlug : new mongoose.Types.ObjectId() },
      { id: /^\d+$/.test(idOrSlug) ? parseInt(idOrSlug) : -1 },
      { slug: idOrSlug }
    ]
  }).lean();

  if (!product) return { title: "Product Not Found" };

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

export default async function ProductDetailPage({ params }) {
  const resolvedParams = await params;
  const { id: paramId } = resolvedParams;
  
  const currentPath = `/product/${paramId}`;
  await checkAndApplyRedirect(currentPath);

  await dbConnect();
  let product;
  
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

  product = await Product.findOne({ 
    $or: queryOr,
    isDeleted: { $ne: true } 
  })
    .populate('categories')
    .lean();

  if (product) {
    const { getAltTextMap } = await import("@/lib/mediaUsage");
    const allUrls = [
      ...(product.images || []),
      product.image,
      ...(product.variantCombinations || []).map(v => v.image)
    ].filter(Boolean);
    const altMap = await getAltTextMap(allUrls);
    product.imageAlts = altMap;
  }
  
  // Removed hard Published check to allow previews
  
  const relatedProducts = await Product.find({ 
    isDeleted: { $ne: true },
    status: 'Published' 
  }).limit(4).lean();

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
         <h1 className="text-lg font-medium heading-font uppercase text-primary">Product Not Found</h1>
         <Link href="/" className="text-[10px] font-medium uppercase tracking-widest underline underline-offset-4 text-primary/70 hover:text-primary transition-colors">Return Home</Link>
      </div>
    );
  }

  const renderStars = (rating, size = "w-3 h-3") => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star 
          key={i} 
          className={`${size} ${i < Math.floor(rating || 0) ? 'fill-primary text-primary' : 'fill-black/5 text-black/5'}`} 
        />
      );
    }
    return stars;
  };

  // Standard Pricing Logic:
  // product.price = Sale/Current Price (What they pay)
  // product.compareAtPrice = Regular/Original Price (What it was)
  const { getAltTextMap } = await import("@/lib/mediaUsage");
  const allUrls = [];
  if (product) {
    allUrls.push(...(product.images || []), product.image);
  }
  relatedProducts.forEach(rp => {
    allUrls.push(...(rp.images || []), rp.image);
  });
  const altMap = await getAltTextMap(allUrls);
  if (product) product.imageAlts = altMap;
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
        <nav className="flex items-center gap-2 mb-6 text-[10px] md:text-[11px] font-medium uppercase tracking-wider text-primary/60 border-b border-black/5 pb-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <Link href="/" className="hover:text-primary transition-colors shrink-0">Home</Link>
          <ChevronRight className="w-2.5 h-2.5 opacity-40 shrink-0" />
          <Link href="/shop" className="hover:text-primary transition-colors shrink-0">Shop</Link>
          <ChevronRight className="w-2.5 h-2.5 opacity-40 shrink-0" />
          <span className="text-primary font-medium tracking-normal truncate">{product.name}</span>
        </nav>

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
