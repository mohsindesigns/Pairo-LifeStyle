import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Theme from "@/models/Theme";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";

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
      // 1. Deactivate all themes first
      await Theme.updateMany({}, { isActive: false });
      
      // 2. Activate the target theme
      const theme = await Theme.findByIdAndUpdate(id, { isActive: true }, { new: true }).lean();
      
      await logAction(req, session, 'ACTIVATE_THEME', 'theme', { after: theme });
      return NextResponse.json(theme);
    }

    // Create new theme from scratch or duplicate
    const newTheme = await Theme.create({
      ...config,
      createdBy: session.user.id
    });
    
    await logAction(req, session, 'CREATE_THEME', 'theme', { after: newTheme });
    return NextResponse.json(newTheme.toJSON(), { status: 201 });
  } catch (error) {
    console.error("THEMES API 500 ERROR:", error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!can(session.user, "settings.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    const data = await req.json();
    const { id, config } = data;

    // Safety: Ensure it's not a system theme we are trying to manually edit
    const targetTheme = await Theme.findById(id);
    if (!targetTheme) return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    if (targetTheme.isSystem) return NextResponse.json({ error: "System themes cannot be directly modified." }, { status: 400 });

    const updatedTheme = await Theme.findByIdAndUpdate(id, { config }, { new: true }).lean();
    
    await logAction(req, session, 'UPDATE_THEME', 'theme', { after: updatedTheme });
    return NextResponse.json(updatedTheme);
  } catch (error) {
    console.error("THEMES API PUT ERROR:", error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}

