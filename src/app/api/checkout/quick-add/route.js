import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import { checkRateLimit } from "@/lib/rateLimit";
import { isSoldOut } from "@/lib/stock";

export const dynamic = "force-dynamic";

// Every way this can fail (bad id, rate limited, not found, not eligible, sold out) answers the same generic
// shape — same quiet-failure posture as /api/checkout/recover — so a shopper's browser never sees a scary error,
// it just silently does nothing (see CartContext's `buy` effect).
const fail = () => NextResponse.json({ success: false }, { headers: { "Cache-Control": "no-store" } });
const ok = (item) => NextResponse.json({ success: true, item }, { headers: { "Cache-Control": "no-store" } });

/**
 * Adds ONE product (quantity 1) to a shopper's cart from a Google Merchant "Cart or checkout page URL" link
 * (`/checkout?buy=<id>`, where `<id>` is the product's feed `<g:id>` — its Mongo _id, see src/app/feed.xml's
 * <g:id>). Re-reads the product fresh from the catalogue (never trusts anything the feed/ad URL implies about
 * price or stock) and returns the same cart-item shape /api/checkout/recover builds, so the client can hand it
 * straight to addToCart. A bare id can't carry a specific size/color (feed.xml emits one id per product, not per
 * variant — a known limitation, not fixed here), so a variable product defaults to its first in-stock
 * combination, in stored (variantCombinations) order.
 *
 * This is deliberately separate from the recovery-link machinery: no token, no AbandonedCart — just a live
 * product lookup, public and unauthenticated like any other add-to-cart action.
 */
export async function GET(req) {
  try {
    const rateCheck = await checkRateLimit(req, { limit: 60, window: 60, keyPrefix: "QUICK_ADD" });
    if (!rateCheck.success) return fail();

    const id = new URL(req.url).searchParams.get("id");
    if (!mongoose.isValidObjectId(id)) return fail();

    await dbConnect();
    const product = await Product.findOne({ _id: id, isDeleted: { $ne: true }, status: "Published" })
      .select("name slug price compareAtPrice sku image images stock manageStock productType variantCombinations attributes corporateGifting.enabled")
      .lean();
    if (!product) return fail();

    // Gifting products need picked items/logos; made-to-measure needs measurements. Neither is carried by a bare
    // product id, so neither is quick-addable from an ad link.
    if (product.productType === "gifting" || product.corporateGifting?.enabled) return fail();

    let price = product.price;
    let compareAtPrice = product.compareAtPrice;
    let image = (product.images && product.images[0]) || product.image || "";
    let sku = product.sku;
    const selectedOptions = {};

    if (product.variantCombinations?.length) {
      // No size/color to honor from a bare id: default to the first combination (in stored order) that still has
      // stock, or simply the first one when this product doesn't track stock at all.
      const variant = product.manageStock === false
        ? product.variantCombinations[0]
        : product.variantCombinations.find((vc) => (Number(vc?.stock) || 0) > 0);
      if (!variant) return fail(); // every combination sold out

      if (variant.price !== undefined && variant.price !== null) price = variant.price;
      if (variant.compareAtPrice !== undefined && variant.compareAtPrice !== null) compareAtPrice = variant.compareAtPrice;
      if (variant.image) image = variant.image;
      if (variant.sku) sku = variant.sku;

      // Map the chosen combination's title back to { AttrName: value } — the same shape
      // productPricing.resolveVariantForItem / stock.buildVariantTitle expect — so this line resolves back to
      // this SAME variant later (price re-check at checkout, stock re-check at payment).
      const attributeNames = (product.attributes || []).map((a) => a.name);
      const parts = typeof variant.title === "string" ? variant.title.split(" / ") : [];
      if (parts.length === attributeNames.length) {
        attributeNames.forEach((name, i) => { selectedOptions[name] = parts[i]; });
      }
    } else if (isSoldOut(product)) {
      return fail();
    }

    if (!(Number(price) >= 0)) return fail();

    return ok({
      id: String(product._id),
      productId: String(product._id),
      name: product.name,
      slug: product.slug || "",
      price,
      compareAtPrice: compareAtPrice ?? undefined,
      image,
      images: image ? [image] : [],
      sku: sku || undefined,
      productType: product.productType,
      attributes: product.attributes || [],
      selectedOptions,
      quantity: 1,
    });
  } catch (error) {
    console.error("[Checkout Quick-Add Error]", error);
    return fail();
  }
}
