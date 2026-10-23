import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Promotion from "@/models/Promotion";
import PromotionRevision from "@/models/PromotionRevision";
import PromotionCustomerUsage from "@/models/PromotionCustomerUsage";
import { NextResponse } from "next/server";
import HistoryService from "@/lib/promotionEngine/HistoryService";
import Validator from "@/lib/promotionEngine/Validator";
import { syncPromotionToStripe, deactivatePromotionStripeCode } from "@/lib/promotionEngine/StripeSync";
import { cache } from "@/lib/cache";
import { can } from "@/lib/rbac";

// Fields the server owns — never let a client set them via the request body. Otherwise a
// staff user could reset a coupon's used-count (usageLimits.currentTotalUses), forge its
// analytics, or hijack its Stripe linkage.
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

    const safeData = stripServerManagedFields(data);

    // Server-side enforcement — see the matching comment in the promotions list POST route.
    // The admin editor's client-side Validator check is easy to bypass.
    const validation = Validator.validate({ ...oldPromo.toObject(), ...safeData });
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.errors[0]?.message || "Invalid promotion configuration", errors: validation.errors }, { status: 400 });
    }

    const promotion = await Promotion.findByIdAndUpdate(id, safeData, { new: true, runValidators: true });

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
  const adminName = session.user.name || session.user.email;
  try {
    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get('permanent') === '1';

    if (permanent) {
      // Permanent delete is only allowed from the Trash (an already-archived promotion),
      // so a live promotion can never be hard-deleted in one step.
      const existing = await Promotion.findById(id);
      if (!existing) {
        return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
      }
      if (existing.adminStatus !== 'Archived') {
        return NextResponse.json({ error: "Move the promotion to Trash before deleting it permanently." }, { status: 409 });
      }

      await deactivatePromotionStripeCode(existing);
      await Promotion.deleteOne({ _id: id });

      // Revision snapshots and per-customer usage counters only make sense for an existing
      // promotion, so they go with it. The audit log is kept as the permanent record, with a
      // DELETE entry describing what was removed. Orders keep their own appliedPromotions copy.
      await PromotionRevision.deleteMany({ promotionId: id });
      await PromotionCustomerUsage.deleteMany({ promotionId: id });
      await HistoryService.logAction('DELETE', id, {
        adminName,
        metadata: { title: existing.title, code: existing.code || null }
      });

      await cache.clearActivePromotionCache();
      return NextResponse.json({ success: true, message: "Promotion deleted permanently" });
    }

    // Default: soft delete (move to Trash) by archiving
    const oldPromo = await Promotion.findById(id);
    if (!oldPromo) {
      return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
    }
    const promotion = await Promotion.findByIdAndUpdate(id, { adminStatus: 'Archived' }, { new: true });

    if (oldPromo.adminStatus !== 'Archived') {
      await HistoryService.logAction('ARCHIVE', id, { adminName }, [
        { field: 'adminStatus', oldValue: oldPromo.adminStatus, newValue: 'Archived' }
      ]);
    }

    await deactivatePromotionStripeCode(promotion);
    await cache.clearActivePromotionCache();
    
    return NextResponse.json({ success: true, message: "Promotion archived successfully" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
