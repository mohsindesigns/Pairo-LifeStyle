import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Theme from "@/models/Theme";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import { buildThemeCopy, themeCopySlugCandidate } from "../../theme-copy";

/**
 * POST /api/admin/themes/:id/duplicate  { name? }
 * Copies a theme's colours/typography as a new, inactive, non-system theme.
 * Name defaults to "<name> (Copy)"; the slug is made unique ("-copy", "-copy-2", …).
 */
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "settings.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Theme not found" }, { status: 404 });

  await dbConnect();
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (name.length > 100) return NextResponse.json({ error: "Theme name is too long (max 100 characters)" }, { status: 400 });

    const source = await Theme.findById(id).lean();
    if (!source) return NextResponse.json({ error: "Theme not found" }, { status: 404 });

    let attempt = 1;
    let slug = themeCopySlugCandidate(source.slug, attempt);
    while (await Theme.exists({ slug })) {
      attempt++;
      if (attempt > 200) return NextResponse.json({ error: "Could not find a free slug for the copy" }, { status: 409 });
      slug = themeCopySlugCandidate(source.slug, attempt);
    }

    const copy = await Theme.create({ ...buildThemeCopy(source, { name, slug }), createdBy: session.user.id });
    await logAction(req, session, "CREATE_THEME", "theme", { after: copy, message: `Duplicated theme "${source.name}" as "${copy.name}"` });
    return NextResponse.json(copy.toJSON(), { status: 201 });
  } catch (error) {
    if (error?.code === 11000) return NextResponse.json({ error: "A theme with this slug already exists. Try again." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
