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
const EXPECTED_HEADER = ['country', 'state', 'postcode', 'city', 'rate', 'name', 'priority', 'compound', 'shipping'];

// Minimal CSV line parser — handles quoted fields with embedded commas/quotes.
function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function truthy(v) {
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

// POST /api/admin/tax/import — body: { classKey, csv, mode: 'replace' | 'append' }
// Parses a CSV rate table (same shape as /export) and writes it into the given class.
export async function POST(req) {
  try {
    if (!await requireSettings()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();

    const { classKey, csv, mode = 'replace' } = await req.json();
    if (!classKey) return NextResponse.json({ error: 'classKey is required.' }, { status: 400 });
    if (!csv || typeof csv !== 'string') return NextResponse.json({ error: 'csv text is required.' }, { status: 400 });

    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return NextResponse.json({ error: 'CSV file is empty.' }, { status: 400 });

    const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    const missing = EXPECTED_HEADER.filter(h => !header.includes(h));
    if (missing.length > 0) {
      return NextResponse.json({ error: `CSV is missing expected column(s): ${missing.join(', ')}. Expected header: ${EXPECTED_HEADER.join(', ')}` }, { status: 400 });
    }
    const colIndex = Object.fromEntries(EXPECTED_HEADER.map(h => [h, header.indexOf(h)]));

    const parsedRows = [];
    const errors = [];
    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i]);
      const rate = Number(fields[colIndex.rate]);
      if (Number.isNaN(rate) || rate < 0 || rate > 100) {
        errors.push(`Row ${i + 1}: invalid rate "${fields[colIndex.rate]}" (must be 0-100).`);
        continue;
      }
      parsedRows.push({
        country: (fields[colIndex.country] || '').trim().toUpperCase(),
        state: (fields[colIndex.state] || '').trim().toUpperCase(),
        postcode: (fields[colIndex.postcode] || '').trim(),
        city: (fields[colIndex.city] || '').trim(),
        rate,
        name: (fields[colIndex.name] || 'Tax').trim(),
        priority: Number(fields[colIndex.priority]) || 1,
        compound: truthy(fields[colIndex.compound]),
        shipping: truthy(fields[colIndex.shipping]),
      });
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: `Import failed with ${errors.length} row error(s):\n${errors.slice(0, 10).join('\n')}` }, { status: 400 });
    }
    if (parsedRows.length === 0) {
      return NextResponse.json({ error: 'No valid rate rows found in CSV.' }, { status: 400 });
    }

    const settings = await TaxSettings.findOne({ tenantId: TENANT_ID });
    if (!settings) return NextResponse.json({ error: 'Tax settings not found — open the Tax settings page first.' }, { status: 404 });

    const taxClass = settings.taxClasses.find(c => c.key === classKey);
    if (!taxClass) return NextResponse.json({ error: 'Tax class not found.' }, { status: 404 });

    taxClass.rates = mode === 'append' ? [...taxClass.rates, ...parsedRows] : parsedRows;
    await settings.save();

    return NextResponse.json({ success: true, settings: settings.toObject(), imported: parsedRows.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
