import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import SectionRenderer from "@/components/common/SectionRenderer";
import { resolvePageSections } from "@/lib/page-data-resolver";
import SiteConfig from "@/models/SiteConfig";
import { resolveSEOMetadata } from "@/lib/seo-resolver";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  await dbConnect();
  const homePage = await Page.findOne({ slug: 'home' }).lean();
  
  const { metadata } = resolveSEOMetadata({
    entity: homePage || {},
    type: "page",
    fallbackTitle: "Pairo | Premium Handcrafted Shearling Jackets",
    fallbackDesc: "Experience the ultimate warmth and luxury with Pairo's handcrafted shearling jackets.",
    path: "/"
  });

  return metadata;
}

export default async function Home() {
  await dbConnect();
  
  let pageData = null;
  let sections = [];

  try {
    // 1. Try to fetch the dynamic Home Page
    pageData = await Page.findOne({ slug: 'home', status: 'Published' }).lean();
    
    if (pageData && pageData.sections?.length > 0) {
      // 2. Resolve dynamic data for sections (Products, Categories, etc.)
      sections = await resolvePageSections(pageData.sections);
    } else {
      // 3. FALLBACK: Build the legacy structure dynamically if DB record is missing
      const siteConfig = await SiteConfig.findOne({ key: 'main' }).lean();
      
      // Temporary fallback sections mirroring the old layout
      sections = [
        { id: 'h1', type: 'hero_slider', enabled: true, order: 0, config: { slides: siteConfig?.hero?.slides || [], brand: siteConfig?.brand, labels: siteConfig?.hero?.labels } },
        { id: 'p1', type: 'product_grid', enabled: true, order: 1, config: { title: "NEW ARRIVALS", limit: 8 } },
        { id: 'm1', type: 'feature_marquee', enabled: true, order: 2, config: { items: [{text: "Premium Store"}] } },
        { id: 'p2', type: 'product_grid', enabled: true, order: 3, config: { title: "TOP SELLING", limit: 8 } },
        { id: 'b1', type: 'banner_feature', enabled: true, order: 4, config: { title: "Limited Edition" } },
        { id: 'c1', type: 'category_showcase', enabled: true, order: 5, config: { title: "Shop Collections" } },
        { id: 'bg1', type: 'blog_grid', enabled: true, order: 6, config: { title: "Our Journal" } },
        { id: 't1', type: 'testimonials', enabled: true, order: 7, config: { title: "Customer Reviews" } },
      ];
      
      // Still need to resolve data for these fallback sections
      sections = await resolvePageSections(sections);
    }
  } catch (error) {
    console.error("Home Page Load Error:", error);
  }

  // Ensure sections are sorted correctly
  const sortedSections = JSON.parse(JSON.stringify(sections.sort((a, b) => a.order - b.order)));

  // Generate dynamic Schema structured data
  let structuredData = null;
  if (pageData) {
    const seoRes = resolveSEOMetadata({
      entity: pageData,
      type: "page",
      path: "/"
    });
    structuredData = seoRes.structuredData;
  }
  if (!structuredData) {
    structuredData = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Pairo",
      "url": "https://pairo.store",
      "logo": "https://pairo.store/logo.png"
    };
  }

  return (
    <div className="flex flex-col min-h-screen">
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
      <SectionRenderer sections={sortedSections} />
    </div>
  );
}
