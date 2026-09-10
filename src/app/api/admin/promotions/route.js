import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Promotion from "@/models/Promotion";
import { NextResponse } from "next/server";
import HistoryService from "@/lib/promotionEngine/HistoryService";
import { syncPromotionToStripe } from "@/lib/promotionEngine/StripeSync";
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

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "promotions.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const tenantId = searchParams.get('tenantId') || "DEFAULT_STORE";
    
    const query = { 
        tenantId,
        adminStatus: { $ne: 'Archived' } 
    };
    
    if (status && status !== 'All') {
      query.adminStatus = status;
    }

    const promotions = await Promotion.find(query).sort({ priority: -1, createdAt: -1 });
    return NextResponse.json(promotions);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "promotions.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();
  try {
    const data = await req.json();
    
    if (!data.title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Ensure tenantId is present (Mandatory for SaaS Hardening)
    const promotionData = {
        ...stripServerManagedFields(data),
        tenantId: data.tenantId || "DEFAULT_STORE"
    };

    const promotion = await Promotion.create(promotionData);

    // Initial History
    await HistoryService.recordRevision(promotion, {
        adminName: session.user.name || session.user.email,
        summary: "Initial Creation"
    });
    await HistoryService.logAction('CREATE', promotion._id, {
        adminName: session.user.name || session.user.email
    });

    const stripeState = await syncPromotionToStripe(promotion);
    Object.assign(promotion, stripeState);
    await promotion.save();

    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    console.error("Promotion Create Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: toggle adminStatus of a single promotion (Active ↔ Draft)
export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "promotions.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await dbConnect();
  try {
    const { promotionId, adminStatus } = await req.json();
    if (!promotionId || !adminStatus) {
      return NextResponse.json({ error: "promotionId and adminStatus required" }, { status: 400 });
    }
    const oldPromo = await Promotion.findById(promotionId);
    if (!oldPromo) {
      return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
    }
    const promotion = await Promotion.findByIdAndUpdate(promotionId, { $set: { adminStatus } }, { new: true });

    const diff = HistoryService.generateDiff(oldPromo.toObject(), promotion.toObject());
    if (diff.length > 0) {
      await HistoryService.recordRevision(promotion, { adminName: session.user.name || session.user.email });
      await HistoryService.logAction('UPDATE', promotionId, { adminName: session.user.name || session.user.email }, diff);
    }

    const stripeState = await syncPromotionToStripe(promotion);
    Object.assign(promotion, stripeState);
    await promotion.save();

    await cache.clearActivePromotionCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: bulk-deactivate ALL active automatic promotions (fixes the surprise-discount bug)
export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "promotions.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await dbConnect();
  try {
    const affected = await Promotion.find({ isAutomatic: true, adminStatus: "Active" }).select("_id title");

    const result = await Promotion.updateMany(
      { isAutomatic: true, adminStatus: "Active" },
      { $set: { adminStatus: "Draft" } }
    );

    await cache.clearActivePromotionCache();

    for (const promo of affected) {
      try {
        await HistoryService.logAction('UPDATE', promo._id, { adminName: session.user.name || session.user.email }, [
          { field: 'adminStatus', oldValue: 'Active', newValue: 'Draft' }
        ]);
      } catch (e) {
        console.error("[Bulk Deactivate Audit Log Error]", e);
      }
    }

    return NextResponse.json({
      success: true,
      deactivated: result.modifiedCount,
      message: `${result.modifiedCount} automatic promotion(s) deactivated.`
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

