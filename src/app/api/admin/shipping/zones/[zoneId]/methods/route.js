import { NextResponse } from 'next/server';
import mongoose        from 'mongoose';
import dbConnect      from '@/lib/db';
import ShippingZone   from '@/models/ShippingZone';
import ShippingMethod from '@/models/ShippingMethod';
import { getServerSession } from 'next-auth';
import { authOptions }      from '@/app/api/auth/[...nextauth]/route';
import { can }              from '@/lib/rbac';

async function requireSettings() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return null;
  if (!can(session.user, 'settings.manage')) return null;
  return session;
}

const TENANT_ID = 'DEFAULT_STORE';

export async function GET(req, { params }) {
  try {
    if (!await requireSettings()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const { zoneId } = await params;
    const methods = await ShippingMethod.find({ zoneId, tenantId: TENANT_ID }).sort({ sortOrder: 1 }).lean();
    return NextResponse.json({ success: true, methods });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    if (!await requireSettings()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const { zoneId } = await params;
    if (!mongoose.Types.ObjectId.isValid(zoneId)) {
      return NextResponse.json({ error: 'Invalid zone id.' }, { status: 400 });
    }
    const zoneExists = await ShippingZone.exists({ _id: zoneId, tenantId: TENANT_ID });
    if (!zoneExists) return NextResponse.json({ error: 'Shipping zone not found.' }, { status: 404 });

    const body = await req.json();
    const { name, description, provider, settings, conditions, status, sortOrder, activeFrom, activeUntil } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'Method name is required.' }, { status: 400 });
    if (!provider) return NextResponse.json({ error: 'Provider is required.' }, { status: 400 });
    const method = await ShippingMethod.create({ tenantId: TENANT_ID, zoneId, name: name.trim(), description: description ?? '', provider, settings: settings ?? {}, conditions: conditions ?? [], status: status ?? 'Active', sortOrder: sortOrder ?? 0, activeFrom: activeFrom || null, activeUntil: activeUntil || null });
    return NextResponse.json({ success: true, method }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    if (!await requireSettings()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const { zoneId } = await params;
    if (!mongoose.Types.ObjectId.isValid(zoneId)) {
      return NextResponse.json({ error: 'Invalid zone id.' }, { status: 400 });
    }
    const body = await req.json();
    const { id, name, description, provider, settings, conditions, status, sortOrder, activeFrom, activeUntil } = body;
    if (!id) return NextResponse.json({ error: 'Method id is required.' }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ error: 'Method name is required.' }, { status: 400 });
    const method = await ShippingMethod.findOneAndUpdate(
      { _id: id, zoneId, tenantId: TENANT_ID },
      { $set: { name: name.trim(), description, provider, settings, conditions, status, sortOrder, activeFrom: activeFrom || null, activeUntil: activeUntil || null } },
      { new: true, runValidators: true }
    );
    if (!method) return NextResponse.json({ error: 'Method not found.' }, { status: 404 });
    return NextResponse.json({ success: true, method });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    if (!await requireSettings()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const { zoneId } = await params;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Method id is required.' }, { status: 400 });
    const result = await ShippingMethod.findOneAndDelete({ _id: id, zoneId, tenantId: TENANT_ID });
    if (!result) return NextResponse.json({ error: 'Method not found.' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Method deleted.' });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
