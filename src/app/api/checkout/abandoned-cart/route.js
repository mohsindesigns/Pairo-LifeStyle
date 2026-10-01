import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import AbandonedCart from "@/models/AbandonedCart";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * Autosaves a snapshot of an in-progress checkout (cart + whatever contact/shipping fields
 * the shopper has typed so far) so the admin can see — and potentially follow up on — a real
 * cart abandonment, not just an empty analytics number. Called on a debounce from the
 * checkout page once the shopper has started entering contact details; upserts by
 * `sessionKey` (the page's idempotencyKey) so one visit produces one evolving record.
 */
export async function POST(req) {
  try {
    // The checkout page debounces autosave calls to one per 2s, so continuous form-filling for
    // over a minute could brush right up against a tight limit — give it headroom.
    const rateCheck = await checkRateLimit(req, { limit: 60, window: 90, keyPrefix: "ABANDONED_CART" });
    if (!rateCheck.success) {
      return NextResponse.json({ success: false }, { status: 429 });
    }

    await dbConnect();
    const body = await req.json().catch(() => ({}));
    const { sessionKey, items, cartSubtotal, cartTotal, contact, shippingAddress } = body;

    if (!sessionKey) {
      return NextResponse.json({ error: "sessionKey is required" }, { status: 400 });
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "";

    // Match on sessionKey ALONE, not also status: "active" — if the order already completed
    // in the brief window before this debounced autosave landed (status is now "recovered"),
    // filtering on status too would miss the existing doc and upsert would try to INSERT a
    // second document with the same sessionKey, colliding with its unique index and throwing
    // on what should be a harmless no-op. status/orderId are never touched here — only
    // checkoutFulfillment.js's recovery update owns that transition.
    await AbandonedCart.findOneAndUpdate(
      { sessionKey },
      {
        $set: {
          items: Array.isArray(items) ? items.slice(0, 50).map(i => ({
            productId: i.id || i._id || i.productId || undefined,
            name: i.name,
            image: i.image,
            price: i.price,
            quantity: i.quantity,
            selectedOptions: i.selectedOptions || null,
          })) : [],
          cartSubtotal: Number(cartSubtotal) || 0,
          cartTotal: Number(cartTotal) || 0,
          contact: {
            email: contact?.email || "",
            firstName: contact?.firstName || "",
            lastName: contact?.lastName || "",
            phone: contact?.phone || "",
          },
          shippingAddress: {
            fullName: shippingAddress?.fullName || "",
            street: shippingAddress?.street || "",
            city: shippingAddress?.city || "",
            state: shippingAddress?.state || "",
            zip: shippingAddress?.zip || "",
            country: shippingAddress?.country || "",
            phone: shippingAddress?.phone || "",
          },
          ipAddress,
          userAgent,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    // Never let an autosave failure interrupt checkout — this is a best-effort admin
    // convenience, not part of the purchase flow itself.
    console.error("[Abandoned Cart Autosave Error]", error);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
