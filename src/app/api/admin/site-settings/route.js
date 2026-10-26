import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import SiteConfig from "@/models/SiteConfig";
import { can } from "@/lib/rbac";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "settings.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    let config = await SiteConfig.findOne({ key: 'main' }).lean();
    if (!config) {
      // Auto-create default if missing
      config = await SiteConfig.create({
        key: 'main',
        brand: { name: 'Pairo', tagline: 'Premium Shearling', footerBrandName: 'PAIRO', copyrightText: 'PAIRO — ALL RIGHTS RESERVED © 2026', privacyUrl: '#', termsUrl: '#' },
        headerConfig: { logoUrl: '', navItems: [], megaCategoryIds: [], topOffers: ['Welcome to Pairo'] },
        footerConfig: { logoUrl: '', newsletterHeading: 'Elite List', newsletterPlaceholder: 'JOIN THE LIST', footerCategoryIds: [], footerBlogIds: [], footerCustomLinks: [], footerCustomLinksHeading: 'Information' },
        socialLinks: [
          { platform: 'facebook', url: '', enabled: false },
          { platform: 'instagram', url: '', enabled: false },
          { platform: 'twitter', url: '', enabled: false },
          { platform: 'linkedin', url: '', enabled: false },
          { platform: 'youtube', url: '', enabled: false },
          { platform: 'tiktok', url: '', enabled: false },
        ]
      });
      config = config.toObject();
    }
    if (!config.popup) {
      config.popup = {
        enabled: false,
        bannerUrl: '',
        badgeText: '',
        title: '',
        description: '',
        buttonLabel: '',
        buttonLink: '',
        openInNewTab: false,
        delaySeconds: 1,
        frequency: 'session',
      };
    }
    return NextResponse.json(JSON.parse(JSON.stringify(config)));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "settings.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const body = await req.json();
    // Strip mongo internals
    const { _id, __v, createdAt, updatedAt, ...cleanBody } = body;

    // The page sends back the whole config it loaded. The abandoned-cart recovery settings (and the scheduler's last-run
    // record) live inside `commerce` but belong to the Recovery emails page: writing the page's possibly stale copy
    // would silently undo a change another admin just made there (for example switching the emails back on). So
    // `commerce` is saved key by key, and that one key is never written from here.
    const { commerce, ...rest } = cleanBody;
    const changes = { ...rest };
    if (commerce && typeof commerce === 'object' && !Array.isArray(commerce)) {
      for (const [key, value] of Object.entries(commerce)) {
        if (key === 'abandonedCart') continue;
        changes[`commerce.${key}`] = value;
      }
    }

    const updated = await SiteConfig.findOneAndUpdate(
      { key: 'main' },
      { $set: changes },
      { upsert: true, new: true, runValidators: false }
    );

    revalidatePath('/', 'layout');

    return NextResponse.json(JSON.parse(JSON.stringify(updated.toObject())));
  } catch (error) {
    console.error("[SiteSettings PUT]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
// Trigger HMR for schema updates
