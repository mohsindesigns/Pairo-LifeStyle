import { resolvePageSections } from "@/lib/page-data-resolver";
import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";
import { resolvePageAndTemplate } from "@/lib/page-cache";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { page } = await resolvePageAndTemplate("team", "about");
  
  const { metadata } = await resolveSEOMetadata({
    entity: page,
    type: "page",
    fallbackTitle: "Our Team | Pairo - Premium Craftsmanship",
    path: "/team"
  });

  return metadata;
}

export default async function TeamPage() {
  // First try to resolve "team" page, or fallback to "about" page so it never renders blank
  let { page, templateInfo } = await resolvePageAndTemplate("team", "about");

  if (!page || page.status !== "Published" || !page.sections?.length) {
    const aboutResult = await resolvePageAndTemplate("about", "about");
    if (aboutResult.page && aboutResult.page.status === "Published") {
      page = aboutResult.page;
      templateInfo = aboutResult.templateInfo;
    } else {
      redirect("/about");
    }
  }

  let resolvedSections = [];
  if (page.sections?.length > 0) {
    resolvedSections = await resolvePageSections(page.sections);
  }

  const sortedSections = JSON.parse(
    JSON.stringify(resolvedSections.sort((a, b) => (a.order || 0) - (b.order || 0)))
  );

  const { structuredData } = await resolveSEOMetadata({
    entity: page,
    type: "page",
    path: "/team"
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
