import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import SectionRenderer from "@/components/common/SectionRenderer";
import { notFound } from "next/navigation";

export async function generateMetadata() {
  await dbConnect();
  const page = await Page.findOne({ slug: "contact" }).lean();
  if (!page) return { title: "Contact Us - Pairo" };

  return {
    title: page.seo?.title || "Contact Us - Pairo",
    description: page.seo?.description || "Get in touch with Pairo support and sales.",
    openGraph: {
      title: page.seo?.ogTitle || page.seo?.title,
      description: page.seo?.ogDescription || page.seo?.description,
      images: page.seo?.ogImage ? [{ url: page.seo.ogImage }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: page.seo?.twitterTitle || page.seo?.title,
      description: page.seo?.twitterDescription || page.seo?.description,
      images: [page.seo?.twitterImage || page.seo?.ogImage].filter(Boolean),
    },
  };
}

export default async function ContactPage() {
  await dbConnect();
  const page = await Page.findOne({ slug: "contact", status: "Published" }).lean();

  if (!page) {
    notFound();
  }

  const sanitizedSections = JSON.parse(JSON.stringify(page.sections || []));

  return (
    <main className="bg-white min-h-screen">
      <SectionRenderer sections={sanitizedSections} />
    </main>
  );
}
