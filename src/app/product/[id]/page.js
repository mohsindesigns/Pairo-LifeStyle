import { permanentRedirect } from "next/navigation";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import "@/models/Category";
import mongoose from "mongoose";
import Link from "next/link";
import { getProductPrimaryCategorySlug } from "@/lib/routes";

export const dynamic = "force-dynamic";

async function getRedirectUrl(paramId, resolvedSearchParams) {
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

  if (product) {
    const categorySlugRaw = getProductPrimaryCategorySlug(product);
    const categorySlug = categorySlugRaw === 'uncategorized' ? 'shop' : categorySlugRaw;
    
    const paramsQuery = new URLSearchParams(resolvedSearchParams);
    const queryString = paramsQuery.toString();
    
    return queryString 
      ? `/${categorySlug}/${product.slug}?${queryString}`
      : `/${categorySlug}/${product.slug}`;
  }
  
  return null;
}

export async function generateMetadata({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const paramId = resolvedParams.id;
  
  const destUrl = await getRedirectUrl(paramId, resolvedSearchParams);
  if (destUrl) {
    permanentRedirect(destUrl);
  }
  
  return { title: "Product Not Found" };
}

export default async function ProductRedirectPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const paramId = resolvedParams.id;
  
  const destUrl = await getRedirectUrl(paramId, resolvedSearchParams);
  if (destUrl) {
    permanentRedirect(destUrl);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
       <h1 className="text-lg font-medium heading-font uppercase text-primary">Product Not Found</h1>
       <Link href="/" className="text-[10px] font-medium uppercase tracking-widest underline underline-offset-4 text-primary/70 hover:text-primary transition-colors">Return Home</Link>
    </div>
  );
}
