import { notFound } from "next/navigation";
import { resolvePageSections } from "@/lib/page-data-resolver";
import { checkAndApplyRedirect } from "@/lib/redirect-resolver";
import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";
import { RESERVED_SLUGS } from "@/lib/redirect-resolver";
import { resolvePageAndTemplate } from "@/lib/page-cache";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  
  if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
    return {};
  }

  const currentPath = `/${slug}`;
  await checkAndApplyRedirect(currentPath);

  const { page } = await resolvePageAndTemplate(slug, "default");
  
  // If it's a dynamic custom page, we require it to exist and be published
  if (!page || page.status !== "Published") {
    return { title: "Page Not Found" };
  }

  const { metadata } = resolveSEOMetadata({
    entity: page,
    type: "page",
    path: currentPath
  });

  return metadata;
}

export default async function CatchAllCMSPage({ params }) {
  const { slug } = await params;

  if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
    notFound();
  }

  const currentPath = `/${slug}`;
  await checkAndApplyRedirect(currentPath);

  const { page, templateInfo } = await resolvePageAndTemplate(slug, "default");

  if (!page || page.status !== "Published") {
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
    path: currentPath
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
