import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import SectionRenderer from "@/components/common/SectionRenderer";
import { notFound } from "next/navigation";
import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";
import { resolvePageSections } from "@/lib/page-data-resolver";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  await dbConnect();
  const page = await Page.findOne({ slug: "about" }).lean();
  if (!page) return { title: "About Us" };

  const { metadata } = resolveSEOMetadata({
    entity: page,
    type: "page",
    path: "/about"
  });

  return metadata;
}

export default async function AboutPage() {
  await dbConnect();
  const page = await Page.findOne({ slug: "about", status: "Published" }).lean();

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
    path: "/about"
  });

  return (
    <main className="bg-white">
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(structuredData) }}
        />
      )}
      <SectionRenderer sections={sortedSections} />
    </main>
  );
}
