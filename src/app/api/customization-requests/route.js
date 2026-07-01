import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import { sendCustomOrderConfirmation, sendAdminCustomOrderNotification } from "@/lib/email";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await dbConnect();
    const body = await req.json();

    const { customer, product, customizations, additionalNotes } = body;

    if (!customer?.name || !customer?.email) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    const tenantId = "DEFAULT_STORE";

    // Generate standard order number
    const count = await Order.countDocuments({ tenantId });
    const orderNumber = `PAI-${1000 + count + 1}`;

    const newOrder = await Order.create({
      tenantId,
      orderNumber,
      status: "Pending",
      items: [{
        productId: product.id,
        name: product.name,
        slug: product.slug || "",
        image: product.image || "",
        priceAtPurchase: product.price || 0,
        quantity: 1,
        customization: {
          enabled: true,
          ...customizations
        }
      }],
      financials: {
        subtotal: product.price || 0,
        shippingCost: 0,
        tax: 0,
        discountTotal: 0,
        total: product.price || 0,
        currency: "USD"
      },
      payment: {
        method: "Custom Inquiry",
        status: "Pending"
      },
      customer: {
        email: customer.email,
        isGuest: true
      },
      shippingAddress: {
        fullName: customer.name,
        street: "Custom Design Inquiry",
        city: "",
        zip: "",
        country: "",
        phone: customer.phone || ""
      },
      customerNote: additionalNotes || "Submitted via Customize Product flow"
    });

    // Send confirmation emails (handling errors gracefully so API response succeeds)
    try {
      await sendCustomOrderConfirmation(newOrder);
    } catch (e) {
      console.error("[Customization API] Failed to send customer confirmation email:", e);
    }

    try {
      await sendAdminCustomOrderNotification(newOrder);
    } catch (e) {
      console.error("[Customization API] Failed to send admin notification email:", e);
    }

    return NextResponse.json({ success: true, orderNumber: newOrder.orderNumber }, { status: 201 });
  } catch (err) {
    console.error("[CustomizationRequest POST]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

