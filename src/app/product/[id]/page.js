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

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  await dbConnect();
  
  const currentPath = `/product/${resolvedParams.id}`;
  await checkAndApplyRedirect(currentPath);

  const product = await Product.findOne({ 
    $or: [
      { id: parseInt(resolvedParams.id) || -1 },
      { slug: resolvedParams.id }
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
  
  const numericId = parseInt(paramId);
  if (!isNaN(numericId)) {
    product = await Product.findOne({ id: numericId, isDeleted: { $ne: true } })
      .populate('categories')
      .lean();
  }
  
  if (!product) {
    product = await Product.findOne({ slug: paramId, isDeleted: { $ne: true } })
      .populate('categories')
      .lean();
  }

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
         <h1 className="text-2xl font-black heading-font uppercase">Product Not Found</h1>
         <Link href="/" className="text-[10px] font-bold uppercase tracking-widest underline underline-offset-4">Return Home</Link>
      </div>
    );
  }

  const renderStars = (rating, size = "w-3 h-3") => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star 
          key={i} 
          className={`${size} ${i < Math.floor(rating || 5) ? 'fill-[#FFC633] text-[#FFC633]' : 'fill-black/5 text-black/5'}`} 
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
    <div className="bg-white min-h-screen font-sans overflow-x-hidden">
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(structuredData) }}
        />
      )}
      <div className="container mx-auto px-4 sm:px-6 md:px-16 py-4 md:py-8">
        <nav className="flex items-center gap-2 mb-6 text-[10px] md:text-xs font-bold uppercase tracking-[0.1em] text-black/30 border-b border-black/5 pb-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <Link href="/" className="hover:text-black transition-colors shrink-0">Home</Link>
          <ChevronRight className="w-2.5 h-2.5 opacity-40 shrink-0" />
          <Link href="/shop" className="hover:text-black transition-colors shrink-0">Shop</Link>
          <ChevronRight className="w-2.5 h-2.5 opacity-40 shrink-0" />
          <span className="text-black font-semibold tracking-normal truncate">{product.name}</span>
        </nav>

        <ProductMainSection product={sanitizedProduct} />

        <ClientTabSystem product={sanitizedProduct} />

        {/* Narrative Section */}
        {product.narrative?.content && (
          <div className="mt-16 md:mt-24 bg-[#F9F9F9] rounded-[40px] p-8 md:p-20 overflow-hidden relative group">
             <div className="absolute top-0 right-0 w-96 h-96 bg-black/5 rounded-full blur-3xl -mr-48 -mt-48 transition-all group-hover:bg-black/[0.08]" />
             <div className="max-w-3xl relative z-10">
                <div className="flex items-center gap-3 mb-6">
                   <div className="p-3 bg-black text-white rounded-2xl"><ScrollText className="w-5 h-5" /></div>
                   <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-black/40">{product.narrative.title || "The Story"}</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-bold heading-font uppercase tracking-tight mb-8 leading-[1.1]">
                   {product.name} <br/> 
                   <span className="text-black/20">Masterpiece Narrative</span>
                </h2>
                <div className="text-lg md:text-xl text-black/60 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: product.narrative.content.replace(/\n/g, '<br/>') }} />
             </div>
          </div>
        )}
      </div>

      <div className="mt-16 border-t border-black/5 pt-12 md:pt-20">
        <ProductSection title="Related Products" products={sanitizedRelated} />
      </div>
    </div>
  );
}
