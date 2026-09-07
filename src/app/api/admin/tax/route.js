import { NextResponse } from 'next/server';
import dbConnect        from '@/lib/db';
import TaxSettings      from '@/models/TaxSettings';
import ShippingZone     from '@/models/ShippingZone';
import { COUNTRIES }    from '@/lib/countries';
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

function defaultTaxClasses() {
  return [
    { key: 'standard', name: 'Standard', isDefault: true, rates: [] },
    { key: 'reduced-rate', name: 'Reduced Rate', isDefault: false, rates: [] },
    { key: 'zero-rate', name: 'Zero Rate', isDefault: false, rates: [] },
  ];
}

function resolveCountryCode(value) {
  if (!value) return '';
  const v = String(value).trim();
  if (v.length === 2) return v.toUpperCase();
  const match = COUNTRIES.find(c => c.name.toLowerCase() === v.toLowerCase());
  return match ? match.code : '';
}

// Best-effort, non-destructive migration from the old defaultTaxRate/taxRules/
// zonalRules shape into the new tax-classes shape, so upgrading this schema
// doesn't silently discard whatever an admin had already configured.
async function migrateLegacyTaxSettings(doc) {
  const standardRows = [];

  if (typeof doc.defaultTaxRate === 'number' && doc.defaultTaxRate > 0) {
    standardRows.push({
      country: '', state: '', postcode: '', city: '',
      rate: doc.defaultTaxRate,
      name: doc.taxLabel || 'Tax',
      priority: 1,
      compound: false,
      shipping: !!doc.applyToShipping,
    });
  }

  for (const rule of (doc.taxRules || [])) {
    const row = { country: '', state: '', postcode: '', city: '', rate: rule.rate, name: rule.name || doc.taxLabel || 'Tax', priority: (rule.priority ?? 0) + 2, compound: false, shipping: !!doc.applyToShipping };
    if (rule.rateType === 'country') {
      const code = resolveCountryCode(rule.region);
      if (!code) { console.warn(`[TaxSettings migration] Skipping unrecognized country "${rule.region}" from legacy tax rule "${rule.name}".`); continue; }
      row.country = code;
    } else if (rule.rateType === 'state') {
      row.state = (rule.region || '').toUpperCase();
    } else if (rule.rateType === 'city') {
      row.city = rule.region || '';
    }
    standardRows.push(row);
  }

  if (doc.zonalRules?.length) {
    for (const zr of doc.zonalRules) {
      if (!zr.enabled) continue;
      try {
        const zone = await ShippingZone.findById(zr.zoneId).lean();
        const countryRule = zone?.matchRules?.find(r => r.type === 'country');
        const stateRule = zone?.matchRules?.find(r => r.type === 'state' || r.type === 'province');
        if (countryRule?.values?.length) {
          for (const v of countryRule.values) {
            const code = resolveCountryCode(v);
            if (!code) { console.warn(`[TaxSettings migration] Skipping unrecognized country "${v}" from legacy zonal rule for zone "${zr.zoneName}".`); continue; }
            standardRows.push({ country: code, state: '', postcode: '', city: '', rate: zr.rate, name: `${zr.zoneName || 'Zone'} Tax`, priority: 3, compound: false, shipping: !!doc.applyToShipping });
          }
        } else if (stateRule?.values?.length) {
          for (const v of stateRule.values) {
            standardRows.push({ country: '', state: v.toUpperCase(), postcode: '', city: '', rate: zr.rate, name: `${zr.zoneName || 'Zone'} Tax`, priority: 3, compound: false, shipping: !!doc.applyToShipping });
          }
        } else {
          console.warn(`[TaxSettings migration] Zonal rule for zone "${zr.zoneName}" had no country/state coverage rule to convert — skipped.`);
        }
      } catch (err) {
        console.warn(`[TaxSettings migration] Failed to resolve zone ${zr.zoneId} for zonal rule conversion:`, err.message);
      }
    }
  }

  const taxClasses = [
    { key: 'standard', name: 'Standard', isDefault: true, rates: standardRows },
    { key: 'reduced-rate', name: 'Reduced Rate', isDefault: false, rates: [] },
    { key: 'zero-rate', name: 'Zero Rate', isDefault: false, rates: [] },
  ];

  const updated = await TaxSettings.findOneAndUpdate(
    { tenantId: TENANT_ID },
    {
      $set: { taxClasses },
      $unset: { taxLabel: 1, defaultTaxRate: 1, taxRules: 1, zonalRules: 1, applyToShipping: 1 },
    },
    { new: true }
  ).lean();

  return updated;
}

export async function GET(req) {
  try {
    if (!await requireSettings()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();

    let doc = await TaxSettings.findOne({ tenantId: TENANT_ID }).lean();

    if (!doc) {
      const created = await TaxSettings.create({
        tenantId: TENANT_ID,
        enabled: false,
        calculationMethod: 'exclusive',
        taxRoundingMode: 'round',
        priceDisplaySuffix: '',
        taxClasses: defaultTaxClasses(),
      });
      doc = created.toObject();
    } else if (!doc.taxClasses || doc.taxClasses.length === 0) {
      doc = await migrateLegacyTaxSettings(doc);
    }

    return NextResponse.json({ success: true, settings: doc });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    if (!await requireSettings()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const body = await req.json();
    const { enabled, calculationMethod, taxRoundingMode, priceDisplaySuffix, taxClasses } = body;

    if (!Array.isArray(taxClasses) || taxClasses.length === 0) {
      return NextResponse.json({ error: 'At least one tax class is required.' }, { status: 400 });
    }
    const keys = new Set();
    for (const cls of taxClasses) {
      if (!cls.key?.trim() || !cls.name?.trim()) {
        return NextResponse.json({ error: 'Every tax class needs a name.' }, { status: 400 });
      }
      if (keys.has(cls.key)) {
        return NextResponse.json({ error: `Duplicate tax class key: ${cls.key}` }, { status: 400 });
      }
      keys.add(cls.key);
      for (const row of (cls.rates || [])) {
        if (typeof row.rate !== 'number' || row.rate < 0 || row.rate > 100) {
          return NextResponse.json({ error: `Invalid rate in class "${cls.name}" — must be between 0 and 100.` }, { status: 400 });
        }
      }
    }
    if (!taxClasses.some(c => c.isDefault)) {
      taxClasses[0].isDefault = true;
    }

    const settings = await TaxSettings.findOneAndUpdate(
      { tenantId: TENANT_ID },
      {
        $set: {
          enabled: enabled ?? false,
          calculationMethod: calculationMethod ?? 'exclusive',
          taxRoundingMode: taxRoundingMode ?? 'round',
          priceDisplaySuffix: priceDisplaySuffix ?? '',
          taxClasses,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    return NextResponse.json({ success: true, settings });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
