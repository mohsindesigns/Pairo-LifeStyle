import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import { syncSizeConfirmationReplies } from "@/lib/sizeConfirmationInbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Checks the support mailbox for new customer replies. ?force=1 bypasses the throttle.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const force = new URL(req.url).searchParams.get("force") === "1";
  const result = await syncSizeConfirmationReplies({ force });
  return NextResponse.json({ success: !result.error, ...result });
}
