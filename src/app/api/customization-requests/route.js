import dbConnect from "@/lib/db";
import Order from "@/models/Order";
import mongoose from "mongoose";
import { sendCustomOrderConfirmation, sendAdminCustomOrderNotification } from "@/lib/email";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await dbConnect();

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { customer, product, customizations, additionalNotes } = body;

    // ── Validation ────────────────────────────────────────────────────
    if (!customer?.name || !customer?.email) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 }
      );
    }

    if (!product?.name) {
      return NextResponse.json(
        { error: "Product information is required." },
        { status: 400 }
      );
    }

    const tenantId = "DEFAULT_STORE";

    // ── Safe order number generation ──────────────────────────────────
    const count = await Order.countDocuments({ tenantId });
    const orderNumber = `PAI-${1000 + count + 1}`;

    // ── Safe productId handling ───────────────────────────────────────
    // product.id may be a valid ObjectId string or undefined — handle both
    let productId = undefined;
    if (product.id && mongoose.Types.ObjectId.isValid(product.id)) {
      productId = new mongoose.Types.ObjectId(product.id);
    }

    // ── Build customization sub-document ─────────────────────────────
    const customizationData = {
      enabled: true,
      leatherColor:      customizations?.leatherColor      || "",
      leatherColorNote:  customizations?.leatherColorNote  || "",
      leatherType:       customizations?.leatherType       || "",
      leatherTypeNote:   customizations?.leatherTypeNote   || "",
      innerLining:       customizations?.innerLining       || "",
      innerLiningNote:   customizations?.innerLiningNote   || "",
      hardwareColor:     customizations?.hardwareColor     || "",
      hardwareColorNote: customizations?.hardwareColorNote || "",
      fur: {
        type:       customizations?.fur?.type      || "None",
        typeNote:   customizations?.fur?.typeNote  || "",
        color:      customizations?.fur?.color     || "",
        placement:  customizations?.fur?.placement || [],
        density:    customizations?.fur?.density   || "",
        removable:  customizations?.fur?.removable ?? null,
      },
      artwork: {
        leftChest:  customizations?.artwork?.leftChest  || null,
        rightChest: customizations?.artwork?.rightChest || null,
        leftArm:    customizations?.artwork?.leftArm    || null,
        rightArm:   customizations?.artwork?.rightArm   || null,
        back:       customizations?.artwork?.back       || null,
        other:      customizations?.artwork?.other      || null,
      },
    };

    // ── Create Order ──────────────────────────────────────────────────
    const newOrder = await Order.create({
      tenantId,
      orderNumber,
      status: "Pending",
      items: [
        {
          ...(productId ? { productId } : {}),
          name:            product.name,
          slug:            product.slug || "",
          image:           product.image || product.images?.[0] || "",
          priceAtPurchase: Number(product.price) || 0,
          quantity:        1,
          customization:   customizationData,
        },
      ],
      financials: {
        subtotal:     Number(product.price) || 0,
        shippingCost: 0,
        tax:          0,
        discountTotal: 0,
        total:        Number(product.price) || 0,
        currency:     "USD",
      },
      payment: {
        method: "Custom Inquiry",
        status: "Pending",
      },
      customer: {
        email:   customer.email,
        isGuest: true,
      },
      shippingAddress: {
        fullName: customer.name,
        street:   "Custom Design Inquiry",
        city:     "",
        zip:      "",
        country:  "",
        phone:    customer.phone || "",
      },
      customerNote: additionalNotes || "",
    });

    // ── Emails (errors are non-fatal) ─────────────────────────────────
    try {
      await sendCustomOrderConfirmation(newOrder);
    } catch (e) {
      console.error("[CustomizationRequest] Customer confirmation email failed:", e.message);
    }

    try {
      await sendAdminCustomOrderNotification(newOrder);
    } catch (e) {
      console.error("[CustomizationRequest] Admin notification email failed:", e.message);
    }

    return NextResponse.json(
      { success: true, orderNumber: newOrder.orderNumber },
      { status: 201 }
    );
  } catch (err) {
    console.error("[CustomizationRequest POST] Unhandled error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error." },
      { status: 500 }
    );
  }
}
