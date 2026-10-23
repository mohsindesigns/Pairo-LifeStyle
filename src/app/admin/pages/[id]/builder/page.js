import { notFound } from "next/navigation";
import Link from "next/link";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import PageBuilder from "@/components/admin/builder/PageBuilder";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";

export default async function BuilderPage({ params }) {
  const { id } = await params;
  
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return notFound();
  }

  // The builder edits the page, so it needs pages.edit (checked before any page data is loaded).
  if (!can(session.user, "pages.edit")) {
    return (
      <div className="wp-page">
        <div className="wp-notice wp-notice-error" role="alert" style={{ marginTop: 16 }}>
          <p>Sorry, you don&apos;t have permission to view this page.</p>
        </div>
      </div>
    );
  }

  if (!mongoose.isValidObjectId(id)) {
    return notFound();
  }

  await dbConnect();
  const pageData = await Page.findById(id).lean();

  if (!pageData) {
    return notFound();
  }

  if (pageData.isDeleted) {
    return (
      <div className="wp-page">
        <div className="wp-notice wp-notice-warning" role="alert" style={{ marginTop: 16 }}>
          <p>This page is in the Trash. Restore it from <Link href="/admin/pages?status=trash">Pages → Trash</Link> before editing.</p>
        </div>
      </div>
    );
  }

  // Sanitize for client component
  const sanitizedPage = JSON.parse(JSON.stringify(pageData));

  return (
    <div className="wp-page min-h-screen overflow-x-clip">
      <PageBuilder initialPage={sanitizedPage} />
    </div>
  );
}
