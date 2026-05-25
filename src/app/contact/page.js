import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import SectionRenderer from "@/components/common/SectionRenderer";
import { notFound } from "next/navigation";
import { resolveSEOMetadata, escapeJsonLd } from "@/lib/seo-resolver";
import { resolvePageSections } from "@/lib/page-data-resolver";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  await dbConnect();
  const page = await Page.findOne({ slug: "contact" }).lean();
  if (!page) return { title: "Contact Us - Pairo" };

  const { metadata } = resolveSEOMetadata({
    entity: page,
    type: "page",
    path: "/contact"
  });

  return metadata;
}

export default async function ContactPage() {
  await dbConnect();
  const page = await Page.findOne({ slug: "contact", status: "Published" }).lean();

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
    path: "/contact"
  });

  return (
    <main className="bg-white min-h-screen">
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
