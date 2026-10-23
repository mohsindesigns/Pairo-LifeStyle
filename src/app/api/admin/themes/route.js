import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Theme from "@/models/Theme";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import mongoose from "mongoose";
import { slugifyThemeName, themeSlugCandidate } from "./theme-copy";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "settings.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const themes = await Theme.find({}).sort({ isSystem: -1, createdAt: -1 }).lean();
    return NextResponse.json(themes);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!can(session.user, "settings.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    const data = await req.json();
    const { action, id, ...config } = data;

    if (action === 'ACTIVATE') {
      // Check the target exists first, so a bad id can never leave the store without an active theme.
      if (!mongoose.isValidObjectId(id) || !(await Theme.exists({ _id: id }))) {
        return NextResponse.json({ error: "Theme not found" }, { status: 404 });
      }
      // 1. Deactivate every other theme
      await Theme.updateMany({ _id: { $ne: id } }, { isActive: false });

      // 2. Activate the target theme
      const theme = await Theme.findByIdAndUpdate(id, { isActive: true }, { new: true }).lean();

      await logAction(req, session, 'ACTIVATE_THEME', 'theme', { after: theme });
      return NextResponse.json(theme);
    }

    // Create a new theme. It is never active or a system theme on creation (use ACTIVATE / seeding).
    const { isActive, isSystem, _id, createdAt, updatedAt, __v, createdBy, slug: rawSlug, ...fields } = config;
    const name = typeof fields.name === "string" ? fields.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Theme name is required" }, { status: 400 });
    if (name.length > 100) return NextResponse.json({ error: "Theme name is too long (max 100 characters)" }, { status: 400 });

    const baseSlug = slugifyThemeName(rawSlug || name);
    let attempt = 1;
    let slug = themeSlugCandidate(baseSlug, attempt);
    while (await Theme.exists({ slug })) {
      attempt++;
      if (attempt > 200) return NextResponse.json({ error: "Could not find a free slug for this theme" }, { status: 409 });
      slug = themeSlugCandidate(baseSlug, attempt);
    }

    const newTheme = await Theme.create({
      ...fields,
      name,
      slug,
      isActive: false,
      isSystem: false,
      createdBy: session.user.id
    });

    await logAction(req, session, 'CREATE_THEME', 'theme', { after: newTheme });
    return NextResponse.json(newTheme.toJSON(), { status: 201 });
  } catch (error) {
    console.error("THEMES API 500 ERROR:", error);
    if (error?.code === 11000) return NextResponse.json({ error: "A theme with this slug already exists" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!can(session.user, "settings.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    const data = await req.json();
    const { id, config, name } = data;

    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    if (!config || typeof config !== "object") return NextResponse.json({ error: "Theme settings are missing" }, { status: 400 });

    // Safety: Ensure it's not a system theme we are trying to manually edit
    const targetTheme = await Theme.findById(id);
    if (!targetTheme) return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    if (targetTheme.isSystem) return NextResponse.json({ error: "System themes cannot be directly modified. Duplicate it to customize." }, { status: 400 });

    const update = { config };
    if (name !== undefined) {
      const cleanName = typeof name === "string" ? name.trim() : "";
      if (!cleanName) return NextResponse.json({ error: "Theme name is required" }, { status: 400 });
      if (cleanName.length > 100) return NextResponse.json({ error: "Theme name is too long (max 100 characters)" }, { status: 400 });
      update.name = cleanName;
    }

    const updatedTheme = await Theme.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();

    await logAction(req, session, 'UPDATE_THEME', 'theme', { before: targetTheme.toObject(), after: updatedTheme });
    return NextResponse.json(updatedTheme);
  } catch (error) {
    console.error("THEMES API PUT ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

