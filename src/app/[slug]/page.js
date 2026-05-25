import { notFound } from "next/navigation";
import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import SectionRenderer from "@/components/common/SectionRenderer";
import { resolvePageSections } from "@/lib/page-data-resolver";
import { checkAndApplyRedirect } from "@/lib/redirect-resolver";
import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";
import { RESERVED_SLUGS } from "@/lib/redirect-resolver";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  
  if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
    return {};
  }

  const currentPath = `/${slug}`;
  await checkAndApplyRedirect(currentPath);

  await dbConnect();
  const page = await Page.findOne({ slug: slug.toLowerCase(), status: "Published" }).lean();
  if (!page) return { title: "Page Not Found" };

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

  await dbConnect();
  const page = await Page.findOne({ slug: slug.toLowerCase(), status: "Published" }).lean();

  if (!page) {
    notFound();
  }

  let resolvedSections = [];
  if (page.sections?.length > 0) {
    resolvedSections = await resolvePageSections(page.sections);
  }

  // Ensure sections are sorted correctly
  const sortedSections = JSON.parse(JSON.stringify(resolvedSections.sort((a, b) => a.order - b.order)));

  const { structuredData } = resolveSEOMetadata({
    entity: page,
    type: "page",
    path: currentPath
  });

  return (
    <div className="flex flex-col min-h-screen">
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(structuredData) }}
        />
      )}
      <SectionRenderer sections={sortedSections} />
    </div>
  );
}
