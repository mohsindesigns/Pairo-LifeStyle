import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const categorySlug = resolvedParams.category;
  
  const paramsQuery = new URLSearchParams(resolvedSearchParams);
  const queryString = paramsQuery.toString();
  
  const destUrl = queryString ? `/${categorySlug}?${queryString}` : `/${categorySlug}`;
  permanentRedirect(destUrl);
}

export default async function ShopCategoryRedirectPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const categorySlug = resolvedParams.category;
  
  const paramsQuery = new URLSearchParams(resolvedSearchParams);
  const queryString = paramsQuery.toString();
  
  const destUrl = queryString ? `/${categorySlug}?${queryString}` : `/${categorySlug}`;
  permanentRedirect(destUrl);
}
