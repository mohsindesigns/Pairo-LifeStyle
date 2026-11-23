import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import { sendAbandonedCartRecoveryEmails } from "@/lib/abandonedCartService";

export const dynamic = "force-dynamic";

// POST /api/admin/abandoned-carts/scan : "Check for abandoned carts now" (what the scheduler does every 5 minutes).
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(can(session.user, "orders.update") || can(session.user, "orders.edit"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const summary = await sendAbandonedCartRecoveryEmails({ trigger: "manual" });
    return NextResponse.json({ success: true, scanned: summary.scanned, sent: summary.sent, failed: summary.failed, disabled: !!summary.disabled });
  } catch (err) {
    console.error("[/api/admin/abandoned-carts/scan]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
