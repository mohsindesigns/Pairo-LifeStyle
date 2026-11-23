import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import { getAbandonedCartSettings, saveAbandonedCartSettings, validateAbandonedCartSettings } from "@/lib/abandonedCartSettings";

export const dynamic = "force-dynamic";

const canEdit = (user) => can(user, "orders.update") || can(user, "orders.edit");

// GET /api/admin/abandoned-carts/settings
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ success: true, settings: await getAbandonedCartSettings() });
}

// PUT /api/admin/abandoned-carts/settings   body: { enabled, idleMinutes, maxAgeHours }
export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const check = validateAbandonedCartSettings(body);
  if (!check.ok) return NextResponse.json({ error: check.errors[0], errors: check.errors }, { status: 400 });

  try {
    const before = await getAbandonedCartSettings();
    await saveAbandonedCartSettings(check.settings);
    await logAction(req, session, "UPDATE_ABANDONED_CART_SETTINGS", "abandoned-carts", { before, after: check.settings, message: "Abandoned cart email settings updated" });
    return NextResponse.json({ success: true, settings: check.settings });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
