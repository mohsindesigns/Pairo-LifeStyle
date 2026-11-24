import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import AbandonedCart from "@/models/AbandonedCart";
import Product from "@/models/Product";
import Order from "@/models/Order";
import Discount from "@/models/Discount";
import { checkRateLimit } from "@/lib/rateLimit";
import { hashRecoveryToken, isWellFormedRecoveryToken, RECOVERY_TOKEN_TTL_MS } from "@/lib/abandonedCartRecovery";
import { resolveVariantForItem } from "@/lib/productPricing";
import { isSoldOut } from "@/lib/stock";

export const dynamic = "force-dynamic";

const MAX_LINE_QUANTITY = 20;

// Every way a link can be unusable (unknown, expired, already ordered, trashed, malformed) answers the same, so the
// response never tells a guesser anything.
const notFound = () => NextResponse.json({ success: false, error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
const ok = (body) => NextResponse.json({ success: true, ...body }, { headers: { "Cache-Control": "no-store" } });

/**
 * Rebuilds a shopper's cart from an abandoned-cart email link (`/checkout?recover=<token>`), so it works on a device
 * or browser that never had the cart. Returns ONLY what is needed to refill the cart: current product details
 * re-read from the catalogue (never the stored snapshot's prices) and the voucher code if it is still usable.
 * It never returns the shopper's email, name, address or phone.
 */
export async function GET(req) {
  try {
    const rateCheck = await checkRateLimit(req, { limit: 30, window: 60, keyPrefix: "CHECKOUT_RECOVER" });
    if (!rateCheck.success) {
      return NextResponse.json({ success: false, error: "rate_limited" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(rateCheck.resetIn || 60) } });
    }

    const token = new URL(req.url).searchParams.get("token");
    if (!isWellFormedRecoveryToken(token)) return notFound();

    await dbConnect();
    const hash = hashRecoveryToken(token);
    const cart = await AbandonedCart.findOne({ "recoveryTokens.hash": hash, isDeleted: { $ne: true } })
      .select("+recoveryTokens items status createdAt contact.email recoveryEmail.voucherCode")
      .lean();
    if (!cart || cart.status !== "active") return notFound();

    const entry = (cart.recoveryTokens || []).find((t) => t.hash === hash);
    if (!entry || Date.now() - new Date(entry.createdAt).getTime() > RECOVERY_TOKEN_TTL_MS) return notFound();

    // Ordered from another device/session since this cart was snapshotted: there is nothing left to recover.
    const email = String(cart.contact?.email || "").trim();
    if (email) {
      const ordered = await Order.exists({
        "customer.email": { $in: [...new Set([email, email.toLowerCase()])] },
        createdAt: { $gte: cart.createdAt },
      });
      if (ordered) return notFound();
    }

    const lines = Array.isArray(cart.items) ? cart.items : [];
    const productIds = [...new Set(lines.map((l) => String(l.productId || "")).filter((id) => mongoose.isValidObjectId(id)))];
    const products = productIds.length
      ? await Product.find({ _id: { $in: productIds }, isDeleted: { $ne: true }, status: "Published" })
          .select("name slug price compareAtPrice sku image images stock manageStock productType variantCombinations attributes corporateGifting.enabled")
          .lean()
      : [];
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const items = [];
    let dropped = 0;
    for (const line of lines) {
      const product = byId.get(String(line.productId || ""));
      const selectedOptions = line.selectedOptions && typeof line.selectedOptions === "object" ? line.selectedOptions : {};
      // Gifting products and made-to-measure lines need picked items / measurements that are not stored: not restorable.
      if (!product || line.custom || product.productType === "gifting" || product.corporateGifting?.enabled) { dropped++; continue; }

      let price = product.price;
      let compareAtPrice = product.compareAtPrice;
      let image = (product.images && product.images[0]) || product.image || line.image || "";
      let sku = product.sku;
      let available = !isSoldOut(product);
      let stock = product.manageStock === false ? Infinity : Number(product.stock) || 0;

      if (product.variantCombinations?.length) {
        // A variable product's line must match a real variant (that is where its price/stock/image live).
        const variant = resolveVariantForItem(product, { selectedOptions });
        if (!variant) { dropped++; continue; }
        if (variant.price !== undefined && variant.price !== null) price = variant.price;
        if (variant.compareAtPrice !== undefined && variant.compareAtPrice !== null) compareAtPrice = variant.compareAtPrice;
        if (variant.image) image = variant.image;
        if (variant.sku) sku = variant.sku;
        if (product.manageStock !== false) {
          stock = Number(variant.stock) || 0;
          available = stock > 0;
        }
      }
      if (!available || !(Number(price) >= 0)) { dropped++; continue; }

      const quantity = Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.floor(Number(line.quantity) || 1), Number.isFinite(stock) ? stock : MAX_LINE_QUANTITY));
      items.push({
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
        quantity,
      });
    }

    // The voucher the email promised, only while it can still be used (it is also re-validated when applied).
    let voucherCode = null;
    const code = cart.recoveryEmail?.voucherCode;
    if (code && items.length > 0) {
      const now = new Date();
      const discount = await Discount.findOne({ code, isActive: true, isDeleted: { $ne: true } })
        .select("usageLimit usageCount startDate endDate")
        .lean();
      const usable = discount
        && !(discount.usageLimit && (discount.usageCount || 0) >= discount.usageLimit)
        && !(discount.endDate && new Date(discount.endDate) < now)
        && !(discount.startDate && new Date(discount.startDate) > now);
      if (usable) voucherCode = code;
    }

    return ok({ items, dropped, voucherCode });
  } catch (error) {
    console.error("[Checkout Recover Error]", error);
    return notFound();
  }
}
