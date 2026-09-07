import { NextResponse } from 'next/server';
import mongoose        from 'mongoose';
import dbConnect      from '@/lib/db';
import ShippingZone   from '@/models/ShippingZone';
import ShippingMethod from '@/models/ShippingMethod';
import { getServerSession } from 'next-auth';
import { authOptions }      from '@/app/api/auth/[...nextauth]/route';
import { can }              from '@/lib/rbac';

async function requireSettings(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return null;
  if (!can(session.user, 'settings.manage')) return null;
  return session;
}

const TENANT_ID = 'DEFAULT_STORE';
const CATCH_ALL_NAME = 'Locations not covered by your other zones';

// Every store must always have exactly one zone with no coverage rules — it's
// the fallback that catches addresses no other zone matches. Without it,
// customers outside every defined zone silently see zero shipping options.
async function ensureCatchAllZone() {
  const existing = await ShippingZone.findOne({ tenantId: TENANT_ID, matchRules: { $size: 0 } });
  if (existing) return existing;

  const maxSort = await ShippingZone.findOne({ tenantId: TENANT_ID }).sort({ sortOrder: -1 }).select('sortOrder').lean();
  return ShippingZone.create({
    tenantId: TENANT_ID,
    name: CATCH_ALL_NAME,
    description: 'Automatically matches any address not covered by another zone.',
    priority: 0,
    sortOrder: (maxSort?.sortOrder ?? 0) + 1,
    status: 'Active',
    matchRules: [],
  });
}

export async function GET(req) {
  try {
    if (!await requireSettings()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();

    await ensureCatchAllZone();

    const zones = await ShippingZone.find({ tenantId: TENANT_ID }).sort({ sortOrder: 1 }).lean();
    const counts = await ShippingMethod.aggregate([
      { $match: { tenantId: TENANT_ID } },
      { $group: { _id: '$zoneId', count: { $sum: 1 } } }
    ]);
    const countMap = Object.fromEntries(counts.map(c => [c._id.toString(), c.count]));
    const result = zones.map(z => ({
      ...z,
      methodCount: countMap[z._id.toString()] ?? 0,
      isCatchAll: (z.matchRules?.length ?? 0) === 0,
    }));
    return NextResponse.json({ success: true, zones: result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    if (!await requireSettings()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const body = await req.json();
    const { name, description, priority, sortOrder, status, matchRules } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'Zone name is required.' }, { status: 400 });

    // Only one zone may act as the wildcard/catch-all (empty matchRules) —
    // otherwise which one wins is ambiguous and hard for an admin to reason about.
    if (!matchRules || matchRules.length === 0) {
      const existingCatchAll = await ShippingZone.findOne({ tenantId: TENANT_ID, matchRules: { $size: 0 } });
      if (existingCatchAll) {
        return NextResponse.json({ error: `"${existingCatchAll.name}" is already your catch-all zone. Add at least one coverage rule to create a more specific zone.` }, { status: 400 });
      }
    }

    const maxSort = await ShippingZone.findOne({ tenantId: TENANT_ID }).sort({ sortOrder: -1 }).select('sortOrder').lean();
    const zone = await ShippingZone.create({
      tenantId: TENANT_ID,
      name: name.trim(),
      description: description ?? '',
      priority: priority ?? 0,
      sortOrder: sortOrder ?? ((maxSort?.sortOrder ?? -1) + 1),
      status: status ?? 'Active',
      matchRules: matchRules ?? [],
    });
    return NextResponse.json({ success: true, zone }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    if (!await requireSettings()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const body = await req.json();
    const { id, name, description, priority, sortOrder, status, matchRules } = body;
    if (!id) return NextResponse.json({ error: 'Zone id is required.' }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ error: 'Zone name is required.' }, { status: 400 });

    if (!matchRules || matchRules.length === 0) {
      const existingCatchAll = await ShippingZone.findOne({ tenantId: TENANT_ID, matchRules: { $size: 0 }, _id: { $ne: id } });
      if (existingCatchAll) {
        return NextResponse.json({ error: `"${existingCatchAll.name}" is already your catch-all zone. A store can only have one.` }, { status: 400 });
      }
    }

    const zone = await ShippingZone.findOneAndUpdate(
      { _id: id, tenantId: TENANT_ID },
      { $set: { name: name.trim(), description, priority, sortOrder, status, matchRules } },
      { new: true, runValidators: true }
    );
    if (!zone) return NextResponse.json({ error: 'Zone not found.' }, { status: 404 });
    return NextResponse.json({ success: true, zone });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Persists drag-and-drop reordering: { order: [zoneId, zoneId, ...] } in display order.
export async function PATCH(req) {
  try {
    if (!await requireSettings()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const { order } = await req.json();
    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: 'order must be a non-empty array of zone ids.' }, { status: 400 });
    }
    const invalid = order.find(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalid) return NextResponse.json({ error: `Invalid zone id: ${invalid}` }, { status: 400 });

    await ShippingZone.bulkWrite(
      order.map((id, index) => ({
        updateOne: {
          filter: { _id: id, tenantId: TENANT_ID },
          update: { $set: { sortOrder: index } },
        },
      }))
    );

    const zones = await ShippingZone.find({ tenantId: TENANT_ID }).sort({ sortOrder: 1 }).lean();
    return NextResponse.json({ success: true, zones });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    if (!await requireSettings()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Zone id is required.' }, { status: 400 });
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid zone id.' }, { status: 400 });

    const target = await ShippingZone.findOne({ _id: id, tenantId: TENANT_ID }).lean();
    if (!target) return NextResponse.json({ error: 'Zone not found.' }, { status: 404 });

    // Never allow deleting the store's only catch-all zone — that would leave
    // any address outside all other zones with zero shipping options.
    if ((target.matchRules?.length ?? 0) === 0) {
      const otherCatchAlls = await ShippingZone.countDocuments({ tenantId: TENANT_ID, matchRules: { $size: 0 }, _id: { $ne: id } });
      if (otherCatchAlls === 0) {
        return NextResponse.json({ error: 'This is your only catch-all zone — every store needs one so customers outside all other zones can still check out. Create another catch-all zone first if you want to remove this one.' }, { status: 400 });
      }
    }

    await ShippingMethod.deleteMany({ zoneId: id, tenantId: TENANT_ID });
    await ShippingZone.deleteOne({ _id: id, tenantId: TENANT_ID });
    return NextResponse.json({ success: true, message: 'Zone and its methods deleted.' });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
