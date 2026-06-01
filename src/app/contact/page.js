import { resolvePageSections } from "@/lib/page-data-resolver";
import { notFound } from "next/navigation";
import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";
import { resolvePageAndTemplate } from "@/lib/page-cache";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { page } = await resolvePageAndTemplate("contact", "contact");
  
  const { metadata } = resolveSEOMetadata({
    entity: page,
    type: "page",
    fallbackTitle: "Contact Us - Pairo",
    path: "/contact"
  });

  return metadata;
}

export default async function ContactPage() {
  const { page, templateInfo } = await resolvePageAndTemplate("contact", "contact");

  if (page.status !== "Published") {
    notFound();
  }

  let resolvedSections = [];
  if (page.sections?.length > 0) {
    resolvedSections = await resolvePageSections(page.sections);
  }

  // Ensure sections are sorted correctly
  const sortedSections = JSON.parse(
    JSON.stringify(resolvedSections.sort((a, b) => (a.order || 0) - (b.order || 0)))
  );

  const { structuredData } = resolveSEOMetadata({
    entity: page,
    type: "page",
    path: "/contact"
  });

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
