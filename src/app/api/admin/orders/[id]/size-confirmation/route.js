import crypto from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import SizeConfirmation from "@/models/SizeConfirmation";
import { can } from "@/lib/rbac";
import { sendSizeConfirmationEmail, getFromAddress } from "@/lib/email";

// Send the "please confirm your jacket size" email for an order.
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();

  try {
    const order = await Order.findById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!order.customer?.email) {
      return NextResponse.json({ error: "This order has no customer email on file" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const sizeChartImageUrl = (body.sizeChartImageUrl || process.env.SIZE_CHART_IMAGE_URL || "").trim() || undefined;
    if (sizeChartImageUrl && !/^https?:\/\//i.test(sizeChartImageUrl) && !sizeChartImageUrl.startsWith("/")) {
      return NextResponse.json({ error: "Size chart image must be a full http(s) URL" }, { status: 400 });
    }
    const absoluteChartUrl = sizeChartImageUrl?.startsWith("/")
      ? `${(process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "")}${sizeChartImageUrl}`
      : sizeChartImageUrl;

    // Our own Message-ID so replies can be matched back via In-Reply-To.
    const fromMatch = getFromAddress().match(/@([^>\s]+)/);
    const domain = fromMatch ? fromMatch[1] : "pairolifestyle.com";
    const messageId = `<sizeconf-${crypto.randomBytes(12).toString("hex")}@${domain}>`;

    const sent = await sendSizeConfirmationEmail(order, { sizeChartImageUrl: absoluteChartUrl, messageId });

    const confirmation = await SizeConfirmation.create({
      orderId: order._id,
      orderNumber: String(order.orderNumber),
      customerName: order.shippingAddress?.fullName || "",
      customerEmail: order.customer.email,
      subject: sent.subject,
      messageId: sent.messageId,
      sizeChartImageUrl: absoluteChartUrl,
      sentBy: session.user.name || session.user.email,
    });

    order.timeline.push({
      status: order.status,
      message: `Size confirmation emailed to ${order.customer.email}.`,
      source: "Admin",
    });
    await order.save();

    return NextResponse.json({ success: true, confirmation });
  } catch (err) {
    console.error("[Size Confirmation Send Error]", err);
    return NextResponse.json({ error: err.message || "Failed to send size confirmation" }, { status: 500 });
  }
}
