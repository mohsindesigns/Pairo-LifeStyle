import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Promotion from "@/models/Promotion";
import { NextResponse } from "next/server";
import HistoryService from "@/lib/promotionEngine/HistoryService";
import { cache } from "@/lib/cache";

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await dbConnect();
  try {
    const data = await req.json();
    const oldPromo = await Promotion.findById(id);
    if (!oldPromo) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const promotion = await Promotion.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    
    // Track History
    const diff = HistoryService.generateDiff(oldPromo.toObject(), promotion.toObject());
    if (diff.length > 0) {
        await HistoryService.recordRevision(promotion, { adminName: session.user.name || session.user.email });
        await HistoryService.logAction('UPDATE', id, { adminName: session.user.name || session.user.email }, diff);
    }

    // Invalidate Cache
    await cache.clearActivePromotionCache();
    
    return NextResponse.json(promotion);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await dbConnect();
  try {
    const data = await req.json();
    const promotion = await Promotion.findByIdAndUpdate(id, { $set: data }, { new: true });
    
    if (!promotion) {
      return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
    }

    await cache.clearActivePromotionCache();
    
    return NextResponse.json(promotion);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await dbConnect();
  try {
    // Instead of hard delete, we archive
    const promotion = await Promotion.findByIdAndUpdate(id, { adminStatus: 'Archived' }, { new: true });
    
    if (!promotion) {
      return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
    }

    await cache.clearActivePromotionCache();
    
    return NextResponse.json({ success: true, message: "Promotion archived successfully" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
