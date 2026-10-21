import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import { can } from "@/lib/rbac";
import { orderLookupQuery } from "@/lib/orderLookup";
import { sendSizeConfirmationForOrder } from "@/lib/sizeConfirmationService";

// Send the "please confirm your jacket size" email for an order. The product
// size charts are included automatically; an extra image URL is optional.
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();

  try {
    const order = await orderLookupQuery(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!order.customer?.email) {
      return NextResponse.json({ error: "This order has no customer email on file" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const rawUrl = (body.sizeChartImageUrl || "").trim();
    if (rawUrl && !/^https?:\/\//i.test(rawUrl) && !rawUrl.startsWith("/")) {
      return NextResponse.json({ error: "Size chart image must be a full http(s) URL" }, { status: 400 });
    }
    const sizeChartImageUrl = rawUrl.startsWith("/")
      ? `${(process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "")}${rawUrl}`
      : rawUrl || undefined;

    const confirmation = await sendSizeConfirmationForOrder(order, {
      sentBy: session.user.name || session.user.email,
      auto: false,
      sizeChartImageUrl,
    });

    return NextResponse.json({ success: true, confirmation });
  } catch (err) {
    console.error("[Size Confirmation Send Error]", err);
    return NextResponse.json({ error: err.message || "Failed to send size confirmation" }, { status: 500 });
  }
}
