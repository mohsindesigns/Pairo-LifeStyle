import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Promotion from "@/models/Promotion";
import { NextResponse } from "next/server";
import HistoryService from "@/lib/promotionEngine/HistoryService";
import Validator from "@/lib/promotionEngine/Validator";
import { syncPromotionToStripe } from "@/lib/promotionEngine/StripeSync";
import { can } from "@/lib/rbac";
import { buildPromotionCopy, promotionCopyCode } from "@/components/admin/promotions/promotionCopy";

// POST: copy a promotion as a new Draft — "(Copy)" title, a unique "<CODE>-COPY[-N]" code
// (automatic promotions stay code-less), usage counters and analytics reset.
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "promotions.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
  }

  await dbConnect();
  try {
    const source = await Promotion.findById(id).lean();
    if (!source) return NextResponse.json({ error: "Promotion not found" }, { status: 404 });

    let code;
    if (typeof source.code === "string" && source.code.trim()) {
      for (let n = 1; n <= 100; n++) {
        const candidate = promotionCopyCode(source.code, n);
        if (!(await Promotion.exists({ code: candidate }))) { code = candidate; break; }
      }
      if (!code) {
        return NextResponse.json({ error: `Could not find a free copy code for "${source.code}".` }, { status: 400 });
      }
    }

    const data = buildPromotionCopy(source, code);
    const validation = Validator.validate(data);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.errors[0]?.message || "Invalid promotion configuration", errors: validation.errors }, { status: 400 });
    }

    const promotion = await Promotion.create(data);
    const adminName = session.user.name || session.user.email;
    await HistoryService.recordRevision(promotion, { adminName, summary: `Duplicated from "${source.title}"` });
    await HistoryService.logAction("CREATE", promotion._id, { adminName, metadata: { duplicatedFrom: String(source._id) } });

    const stripeState = await syncPromotionToStripe(promotion);
    Object.assign(promotion, stripeState);
    await promotion.save();

    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    console.error("Promotion Duplicate Error:", error);
    if (error?.code === 11000) {
      return NextResponse.json({ error: "That coupon code is already used by another promotion." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
