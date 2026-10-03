import { NextResponse } from 'next/server';
import { shippingService } from '@/services/shipping/ShippingService';
import dbConnect from '@/lib/db';
import SiteConfig from '@/models/SiteConfig';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/shipping/calculate
 * Quick public status check for checkout to see if shipping module is enabled.
 */
export async function GET() {
  try {
    await dbConnect();
    const config = await SiteConfig.findOne({ key: 'main' }).select('commerce').lean();
    const shippingEnabled = config?.commerce?.shippingEnabled !== false;
    return NextResponse.json({
      success: true,
      shippingEnabled,
      currency: config?.commerce?.storeCurrency ?? 'USD'
    });
  } catch (error) {
    return NextResponse.json({ success: true, shippingEnabled: true, currency: 'USD' });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const config = await SiteConfig.findOne({ key: 'main' }).select('commerce').lean();
    const shippingEnabled = config?.commerce?.shippingEnabled !== false;
    const currency = config?.commerce?.storeCurrency ?? 'USD';

    if (!shippingEnabled) {
      return NextResponse.json({
        success: true,
        shippingEnabled: false,
        zone: null,
        rates: [
          {
            methodId: 'free-delivery',
            methodName: 'Free Delivery',
            provider: 'FREE_SHIPPING',
            cost: 0,
            currency,
            description: 'Free delivery on all orders'
          }
        ],
        currency
      });
    }

    const body = await req.json();
    const { address, subtotal, items } = body;

    if (!address || typeof subtotal !== 'number') {
      return NextResponse.json(
        { error: 'address and subtotal are required.' },
        { status: 400 }
      );
    }

    const result = await shippingService.getRatesForAddress(
      address,
      subtotal,
      items ?? []
    );

    return NextResponse.json({ success: true, ...result });

  } catch (error) {
    console.error('[/api/shipping/calculate]', error);
    return NextResponse.json({ error: 'Failed to calculate shipping rates.' }, { status: 500 });
  }
}
