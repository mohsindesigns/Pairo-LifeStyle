import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import ShippingZone from '@/models/ShippingZone';
import ShippingMethod from '@/models/ShippingMethod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { can } from '@/lib/rbac';
import { buildZoneCopy, buildMethodCopy, isCatchAllZone } from '../../../copy-helpers';

// POST /api/admin/shipping/zones/[zoneId]/duplicate
// Copies a zone (Inactive, "(Copy)") together with all of its shipping methods.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isStaff || !can(session.user, 'settings.manage')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await dbConnect();
    const { zoneId } = await params;
    if (!mongoose.Types.ObjectId.isValid(zoneId)) return NextResponse.json({ error: 'Invalid zone id.' }, { status: 400 });

    const source = await ShippingZone.findById(zoneId).lean();
    if (!source) return NextResponse.json({ error: 'Zone not found.' }, { status: 404 });
    if (isCatchAllZone(source)) {
      return NextResponse.json({ error: 'The catch-all zone can\'t be duplicated — a store has exactly one. Duplicate a regular zone instead.' }, { status: 400 });
    }

    const maxSort = await ShippingZone.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    const zone = await ShippingZone.create(buildZoneCopy(source, (maxSort?.sortOrder ?? -1) + 1));

    const methods = await ShippingMethod.find({ zoneId }).sort({ sortOrder: 1 }).lean();
    const copies = methods.length
      ? await ShippingMethod.insertMany(methods.map((m) => buildMethodCopy(m, zone._id, { keepName: true })))
      : [];

    return NextResponse.json({
      success: true,
      zone: {
        ...zone.toObject(),
        methodCount: copies.length,
        methodSummary: copies.map((m) => ({ _id: m._id, name: m.name, status: m.status, provider: m.provider })),
        isCatchAll: false,
      },
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
