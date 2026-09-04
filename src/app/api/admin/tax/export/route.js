import { NextResponse } from 'next/server';
import dbConnect        from '@/lib/db';
import TaxSettings      from '@/models/TaxSettings';
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
const HEADER = ['Country', 'State', 'Postcode', 'City', 'Rate', 'Name', 'Priority', 'Compound', 'Shipping'];

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// GET /api/admin/tax/export?classKey=standard — downloads that class's rate table as CSV.
export async function GET(req) {
  try {
    if (!await requireSettings()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const classKey = searchParams.get('classKey');
    if (!classKey) return NextResponse.json({ error: 'classKey is required.' }, { status: 400 });

    const settings = await TaxSettings.findOne({ tenantId: TENANT_ID }).lean();
    const taxClass = settings?.taxClasses?.find(c => c.key === classKey);
    if (!taxClass) return NextResponse.json({ error: 'Tax class not found.' }, { status: 404 });

    const lines = [HEADER.join(',')];
    for (const row of (taxClass.rates || [])) {
      lines.push([
        row.country, row.state, row.postcode, row.city, row.rate, row.name,
        row.priority, row.compound ? '1' : '0', row.shipping ? '1' : '0',
      ].map(csvEscape).join(','));
    }

    const csv = lines.join('\n');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="tax-rates-${classKey}.csv"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
