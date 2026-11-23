import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import { isReservedPath } from "@/lib/redirect-resolver";
import { buildPageCopy, copySlugCandidate } from "../../page-copy";

/**
 * POST /api/admin/pages/:id/duplicate
 * Copies a page (sections, SEO, template) as a new non-system Draft titled "<title> (Copy)"
 * with a unique slug ("<slug>-copy", "<slug>-copy-2", …). Trashed pages can't be duplicated.
 */
export async function POST(req, { params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "pages.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Page not found" }, { status: 404 });

  await dbConnect();
  try {
    const source = await Page.findById(id).lean();
    if (!source) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    if (source.isDeleted) {
      return NextResponse.json({ error: "Restore this page from the Trash before duplicating it" }, { status: 400 });
    }

    // Checked against ALL pages (trashed included) because the slug index is unique.
    let attempt = 1;
    let slug = copySlugCandidate(source.slug, attempt);
    while (isReservedPath(slug) || (await Page.exists({ slug }))) {
      attempt++;
      if (attempt > 200) return NextResponse.json({ error: "Could not find a free slug for the copy" }, { status: 409 });
      slug = copySlugCandidate(source.slug, attempt);
    }

    const copy = await Page.create({
      ...buildPageCopy(source, slug, () => randomUUID()),
      createdBy: session.user.id,
      updatedBy: session.user.id
    });

    await logAction(req, session, "CREATE_PAGE", "page", {
      after: copy,
      message: `Duplicated page "${source.title}" as "${copy.title}"`
    });

    return NextResponse.json(copy, { status: 201 });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: "A page with this slug already exists. Try again." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
