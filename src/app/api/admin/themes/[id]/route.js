import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Theme from "@/models/Theme";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  await dbConnect();
  try {
    const theme = await Theme.findById(params.id).lean();
    if (!theme) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(theme);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "settings.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const data = await req.json();
    const before = await Theme.findById(params.id).lean();
    
    if (before.isSystem) {
        return NextResponse.json({ error: "System themes cannot be modified. Duplicate to customize." }, { status: 403 });
    }

    const theme = await Theme.findByIdAndUpdate(params.id, data, { new: true });
    await logAction(req, session, 'UPDATE_THEME', 'theme', { before, after: theme });
    return NextResponse.json(theme);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "settings.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const theme = await Theme.findById(params.id);
    if (theme.isSystem) return NextResponse.json({ error: "Cannot delete system themes" }, { status: 403 });
    if (theme.isActive) return NextResponse.json({ error: "Cannot delete active theme" }, { status: 403 });

    await theme.deleteOne();
    await logAction(req, session, 'DELETE_THEME', 'theme', { before: theme });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
