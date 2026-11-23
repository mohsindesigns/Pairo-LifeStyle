import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import { sendRecoveryEmailNow } from "@/lib/abandonedCartService";

export const dynamic = "force-dynamic";

// POST /api/admin/abandoned-carts/<cartId>/send : "Send now" for one cart (ignores the quiet period; may re-send).
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(can(session.user, "orders.update") || can(session.user, "orders.edit"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Cart not found" }, { status: 404 });

  try {
    const result = await sendRecoveryEmailNow(id, { staffId: session.user.id });
    if (result.reason === "not-found") return NextResponse.json({ error: result.error }, { status: 404 });
    if (!result.sent) {
      const message = result.reason === "order-exists" ? "This shopper already placed an order, so no recovery email was sent." : result.error || "The email could not be sent.";
      return NextResponse.json({ success: false, error: message, result }, { status: result.reason === "order-exists" ? 409 : 502 });
    }
    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("[/api/admin/abandoned-carts/[id]/send]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
