import { notFound } from "next/navigation";
import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import PageBuilder from "@/components/admin/builder/PageBuilder";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function BuilderPage({ params }) {
  const { id } = await params;
  
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return notFound();
  }

  await dbConnect();
  const pageData = await Page.findById(id).lean();

  if (!pageData) {
    return notFound();
  }

  // Sanitize for client component
  const sanitizedPage = JSON.parse(JSON.stringify(pageData));

  return (
    <div className="min-h-screen bg-[#f0f0f1] p-2 sm:p-4 overflow-x-clip">
      <PageBuilder initialPage={sanitizedPage} />
    </div>
  );
}
