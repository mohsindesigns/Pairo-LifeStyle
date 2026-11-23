import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SiteConfig from '@/models/SiteConfig';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { can } from '@/lib/rbac';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function requirePermission(action = 'manage') {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.isStaff) {
    return null;
  }
  if (action === 'view') {
    if (!can(session.user, 'settings.view') && !can(session.user, 'settings.manage') && !can(session.user, 'settings.edit')) {
      return null;
    }
  } else {
    if (!can(session.user, 'settings.manage') && !can(session.user, 'settings.edit')) {
      return null;
    }
  }
  return session;
}

// ─── GET /api/admin/shipping/settings ──────────────────────────────────────────
export async function GET(req) {
  try {
    if (!await requirePermission('view')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await dbConnect();

    const config = await SiteConfig.findOne({ key: 'main' }).select('commerce').lean();
    const shippingEnabled = config?.commerce?.shippingEnabled !== false;

    return NextResponse.json({
      success: true,
      shippingEnabled,
      commerce: config?.commerce || {}
    });
  } catch (error) {
    console.error('[/api/admin/shipping/settings GET]', error);
    return NextResponse.json({ error: error.message || 'Failed to load shipping settings' }, { status: 500 });
  }
}

// ─── PUT /api/admin/shipping/settings ──────────────────────────────────────────
export async function PUT(req) {
  try {
    if (!await requirePermission('manage')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await dbConnect();

    const body = await req.json();
    const { shippingEnabled } = body;

    if (typeof shippingEnabled !== 'boolean') {
      return NextResponse.json({ error: 'shippingEnabled must be a boolean' }, { status: 400 });
    }

    const updatedConfig = await SiteConfig.findOneAndUpdate(
      { key: 'main' },
      { $set: { 'commerce.shippingEnabled': shippingEnabled } },
      { new: true, upsert: true }
    ).select('commerce').lean();

    return NextResponse.json({
      success: true,
      shippingEnabled: updatedConfig?.commerce?.shippingEnabled !== false,
      message: `Shipping module ${shippingEnabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('[/api/admin/shipping/settings PUT]', error);
    return NextResponse.json({ error: error.message || 'Failed to update shipping settings' }, { status: 500 });
  }
}
