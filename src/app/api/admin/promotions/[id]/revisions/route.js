import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Promotion from "@/models/Promotion";
import PromotionRevision from "@/models/PromotionRevision";
import HistoryService from "@/lib/promotionEngine/HistoryService";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac";

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
    const revisions = await PromotionRevision.find({ promotionId: id }).sort({ version: -1 });
    return NextResponse.json(revisions);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
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
    const { version } = await req.json();
    const revision = await PromotionRevision.findOne({ promotionId: id, version });

    if (!revision) {
      return NextResponse.json({ error: "Revision not found" }, { status: 404 });
    }

    const oldPromo = await Promotion.findById(id);
    if (!oldPromo) {
      return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
    }

    // Restore the snapshot's content, but keep the LIVE usage/analytics counters
    // and Stripe linkage as they are now — a rollback undoes configuration
    // changes (title, conditions, actions, etc.), it must never rewind how many
    // times a code has actually been redeemed or orphan an already-synced
    // Stripe Coupon/PromotionCode.
    const { usageLimits, analytics, stripeCouponId, stripePromotionCodeId, stripeSyncStatus, stripeSyncError, stripeSyncKey, ...restoredFields } = revision.snapshot;

    const updated = await Promotion.findByIdAndUpdate(id, {
      $set: {
        ...restoredFields,
        usageLimits: oldPromo.usageLimits,
        analytics: oldPromo.analytics,
        stripeCouponId: oldPromo.stripeCouponId,
        stripePromotionCodeId: oldPromo.stripePromotionCodeId,
        stripeSyncStatus: oldPromo.stripeSyncStatus,
        stripeSyncError: oldPromo.stripeSyncError,
        stripeSyncKey: oldPromo.stripeSyncKey,
      }
    }, { new: true });

    // Log the rollback action
    await HistoryService.logAction('ROLLBACK', id, {
        adminName: session.user.name || session.user.email,
        metadata: { version }
    }, [{ field: 'version', oldValue: 'current', newValue: version }]);

    // Snapshot the restored state as a new revision so "current version" isn't
    // stale and future edits diff against what's actually live now.
    await HistoryService.recordRevision(updated, {
      adminName: session.user.name || session.user.email,
      summary: `Rolled back to version ${version}`
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
