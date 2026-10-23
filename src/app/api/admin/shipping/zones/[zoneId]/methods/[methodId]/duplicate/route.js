import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import ShippingMethod from '@/models/ShippingMethod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { can } from '@/lib/rbac';
import { buildMethodCopy } from '../../../../../copy-helpers';

// POST /api/admin/shipping/zones/[zoneId]/methods/[methodId]/duplicate -> Inactive "(Copy)" in the same zone.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isStaff || !can(session.user, 'settings.manage')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await dbConnect();
    const { zoneId, methodId } = await params;
    if (!mongoose.Types.ObjectId.isValid(zoneId) || !mongoose.Types.ObjectId.isValid(methodId)) {
      return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
    }
    const source = await ShippingMethod.findOne({ _id: methodId, zoneId }).lean();
    if (!source) return NextResponse.json({ error: 'Method not found.' }, { status: 404 });

    const method = await ShippingMethod.create(buildMethodCopy(source, source.zoneId));
    return NextResponse.json({ success: true, method }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
