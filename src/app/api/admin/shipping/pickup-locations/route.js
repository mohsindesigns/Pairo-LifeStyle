import { NextResponse }  from 'next/server';
import dbConnect         from '@/lib/db';
import PickupLocation    from '@/models/PickupLocation';
import { getServerSession } from 'next-auth';
import { authOptions }      from '@/app/api/auth/[...nextauth]/route';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) {
    return null;
  }
  return session;
}

const TENANT_ID = 'DEFAULT_STORE';

// ─── GET /api/admin/shipping/pickup-locations ─────────────────────────────────
export async function GET(req) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await dbConnect();

  const locations = await PickupLocation
    .find({ tenantId: TENANT_ID })
    .sort({ sortOrder: 1 })
    .lean();

  return NextResponse.json({ success: true, locations });
}

// ─── POST /api/admin/shipping/pickup-locations ────────────────────────────────
export async function POST(req) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await dbConnect();

  const body = await req.json();
  const location = await PickupLocation.create({ tenantId: TENANT_ID, ...body });

  return NextResponse.json({ success: true, location }, { status: 201 });
}

// ─── PUT /api/admin/shipping/pickup-locations ─────────────────────────────────
export async function PUT(req) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await dbConnect();

  const body = await req.json();
  const { id, ...rest } = body;

  if (!id) return NextResponse.json({ error: 'Location id is required.' }, { status: 400 });

  const location = await PickupLocation.findOneAndUpdate(
    { _id: id, tenantId: TENANT_ID },
    { $set: rest },
    { new: true, runValidators: true }
  );

  if (!location) return NextResponse.json({ error: 'Location not found.' }, { status: 404 });

  return NextResponse.json({ success: true, location });
}

// ─── DELETE /api/admin/shipping/pickup-locations ──────────────────────────────
export async function DELETE(req) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Location id is required.' }, { status: 400 });

  const result = await PickupLocation.findOneAndDelete({ _id: id, tenantId: TENANT_ID });
  if (!result) return NextResponse.json({ error: 'Location not found.' }, { status: 404 });

  return NextResponse.json({ success: true, message: 'Pickup location deleted.' });
}
