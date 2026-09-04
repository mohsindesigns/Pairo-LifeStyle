import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import CustomJacketInquiry from "@/models/CustomJacketInquiry";
import Order from "@/models/Order";
import { can } from "@/lib/rbac";
import crypto from "crypto";

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "orders.update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await dbConnect();

  try {
    const body = await req.json().catch(() => ({}));
    const amount = Number(body.quoteAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "A valid quote amount is required" }, { status: 400 });
    }
    const currency = (body.currency || "USD").toUpperCase();

    const inquiry = await CustomJacketInquiry.findById(id);
    if (!inquiry) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    if (inquiry.orderId) {
      return NextResponse.json({ error: "This inquiry has already been converted to an order" }, { status: 409 });
    }

    const tenantId = inquiry.tenantId || "DEFAULT_STORE";
    const count = await Order.countDocuments({ tenantId });
    const orderNumber = `PAI-${1000 + count + 1}`;
    const idempotencyKey = `custom-jacket-${crypto.randomUUID()}`;

    const order = await Order.create({
      tenantId,
      orderNumber,
      status: "Pending",
      items: [
        {
          name: `Custom ${inquiry.jacketType || "Jacket"}`,
          quantity: 1,
          priceAtPurchase: amount,
        },
      ],
      financials: {
        subtotal: amount,
        shippingCost: 0,
        tax: 0,
        discountTotal: 0,
        total: amount,
        currency,
      },
      payment: {
        method: "Custom Order",
        status: "Pending",
      },
      customer: {
        email: inquiry.email,
        isGuest: true,
      },
      shippingAddress: {
        fullName: `${inquiry.firstName} ${inquiry.lastName}`.trim(),
        street: "",
        city: inquiry.city || "",
        zip: "",
        country: inquiry.country || "",
        phone: inquiry.phone || "",
      },
      customerNote: inquiry.additionalNotes || "",
      customJacketInquiryId: inquiry._id,
      customJacketSnapshot: {
        jacketType: inquiry.jacketType,
        gender: inquiry.gender,
        preferredLeather: inquiry.preferredLeather,
        preferredColor: inquiry.preferredColor,
        size: inquiry.size,
        budget: inquiry.budget,
        deadline: inquiry.deadline,
        referenceImages: inquiry.referenceImages || [],
        additionalNotes: inquiry.additionalNotes || "",
      },
      idempotencyKey,
      timeline: [
        {
          status: "Pending",
          message: `Order created from Custom Jacket Inquiry with a quoted price of ${currency} ${amount.toLocaleString()}.`,
          source: "Admin",
        },
      ],
    });

    inquiry.orderId = order._id;
    inquiry.status = "Converted";
    if (body.adminNotes !== undefined) inquiry.adminNotes = body.adminNotes;
    await inquiry.save();

    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (err) {
    console.error("[CustomJacketInquiry Convert Error]", err);
    return NextResponse.json({ error: err.message || "Conversion failed" }, { status: 500 });
  }
}
