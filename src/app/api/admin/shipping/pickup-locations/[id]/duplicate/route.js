import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import PickupLocation from '@/models/PickupLocation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { can } from '@/lib/rbac';
import { buildPickupCopy } from '../../../copy-helpers';

// POST /api/admin/shipping/pickup-locations/[id]/duplicate -> Inactive "(Copy)" location.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isStaff || !can(session.user, 'settings.manage')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await dbConnect();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

    const source = await PickupLocation.findById(id).lean();
    if (!source) return NextResponse.json({ error: 'Location not found.' }, { status: 404 });

    const maxSort = await PickupLocation.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    const location = await PickupLocation.create(buildPickupCopy(source, (maxSort?.sortOrder ?? -1) + 1));
    return NextResponse.json({ success: true, location }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
