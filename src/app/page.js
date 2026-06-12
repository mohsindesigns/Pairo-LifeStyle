import { resolvePageSections } from "@/lib/page-data-resolver";
import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";
import { resolvePageAndTemplate } from "@/lib/page-cache";

// Dynamic mode removed to inherit layout caching

export async function generateMetadata() {
  const { page } = await resolvePageAndTemplate("home", "home");
  
  const { metadata } = resolveSEOMetadata({
    entity: page,
    type: "page",
    fallbackTitle: "Pairo | Premium Handcrafted Shearling Jackets",
    fallbackDesc: "Experience the ultimate warmth and luxury with Pairo's handcrafted shearling jackets.",
    path: "/"
  });

  return metadata;
}

export default async function Home() {
  console.time('resolvePageAndTemplate');
  const { page, templateInfo } = await resolvePageAndTemplate("home", "home");
  console.timeEnd('resolvePageAndTemplate');
  
  let resolvedSections = [];
  if (page.sections?.length > 0) {
    console.time('resolvePageSections');
    resolvedSections = await resolvePageSections(page.sections);
    console.timeEnd('resolvePageSections');
  }

  // Ensure sections are sorted correctly
  const sortedSections = JSON.parse(
    JSON.stringify(resolvedSections.sort((a, b) => (a.order || 0) - (b.order || 0)))
  );

  // Generate dynamic Schema structured data
  const seoRes = resolveSEOMetadata({
    entity: page,
    type: "page",
    path: "/"
  });
  
  let structuredData = seoRes?.structuredData;
  if (!structuredData) {
    structuredData = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Pairo",
      "url": "https://pairolifestyle.com",
      "logo": "https://pairolifestyle.com/logo.png"
    };
  }

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
