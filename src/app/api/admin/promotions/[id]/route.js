import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Promotion from "@/models/Promotion";
import { NextResponse } from "next/server";
import HistoryService from "@/lib/promotionEngine/HistoryService";
import { syncPromotionToStripe, deactivatePromotionStripeCode } from "@/lib/promotionEngine/StripeSync";
import { cache } from "@/lib/cache";
import { can } from "@/lib/rbac";

// Fields the server owns — never let a client set them via the request body. Otherwise a
// staff user could reset a coupon's used-count (usageLimits.currentTotalUses), forge its
// analytics, or hijack its Stripe linkage. (tenantId is intentionally left writable.)
function stripServerManagedFields(data) {
  if (!data || typeof data !== "object") return data;
  const { _id, analytics, stripeCouponId, stripePromotionCodeId, stripeSyncStatus, stripeSyncError, stripeSyncKey, createdAt, updatedAt, ...safe } = data;
  if (safe.usageLimits && typeof safe.usageLimits === "object") {
    const { currentTotalUses, ...restUsage } = safe.usageLimits;
    safe.usageLimits = restUsage;
  }
  return safe;
}

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "promotions.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();
  try {
    const promotion = await Promotion.findById(id);
    if (!promotion) {
      return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
    }
    return NextResponse.json(promotion);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "promotions.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();
  try {
    const data = await req.json();
    const oldPromo = await Promotion.findById(id);
    if (!oldPromo) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const promotion = await Promotion.findByIdAndUpdate(id, stripServerManagedFields(data), { new: true, runValidators: true });

    // Track History
    const diff = HistoryService.generateDiff(oldPromo.toObject(), promotion.toObject());
    if (diff.length > 0) {
        await HistoryService.recordRevision(promotion, { adminName: session.user.name || session.user.email });
        await HistoryService.logAction('UPDATE', id, { adminName: session.user.name || session.user.email }, diff);
    }

    const stripeState = await syncPromotionToStripe(promotion);
    Object.assign(promotion, stripeState);
    await promotion.save();

    // Invalidate Cache
    await cache.clearActivePromotionCache();

    return NextResponse.json(promotion);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "promotions.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();
  try {
    const data = await req.json();
    const oldPromo = await Promotion.findById(id);
    if (!oldPromo) return NextResponse.json({ error: "Promotion not found" }, { status: 404 });

    const promotion = await Promotion.findByIdAndUpdate(id, { $set: stripServerManagedFields(data) }, { new: true });

    // Track History — same as PUT, so a Pause/Activate toggle (or any other
    // partial update) leaves an audit trail instead of silently changing a
    // live, customer-facing promotion with no record of who/when.
    const diff = HistoryService.generateDiff(oldPromo.toObject(), promotion.toObject());
    if (diff.length > 0) {
      await HistoryService.recordRevision(promotion, { adminName: session.user.name || session.user.email });
      await HistoryService.logAction('UPDATE', id, { adminName: session.user.name || session.user.email }, diff);
    }

    const stripeState = await syncPromotionToStripe(promotion);
    Object.assign(promotion, stripeState);
    await promotion.save();

    await cache.clearActivePromotionCache();

    return NextResponse.json(promotion);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "promotions.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();
  try {
    // Instead of hard delete, we archive
    const promotion = await Promotion.findByIdAndUpdate(id, { adminStatus: 'Archived' }, { new: true });

    if (!promotion) {
      return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
    }

    await deactivatePromotionStripeCode(promotion);
    await cache.clearActivePromotionCache();
    
    return NextResponse.json({ success: true, message: "Promotion archived successfully" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
